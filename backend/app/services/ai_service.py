import os
import json
import base64
import requests
from typing import List, Dict, Any
import fitz  # PyMuPDF
from ..config import settings

# Conditionally import Gemini (only used if a real API key is provided)
GEMINI_AVAILABLE = False
try:
    import google.generativeai as genai
    import PIL.Image
    key = settings.GEMINI_API_KEY or ""
    if key and not key.startswith("AIzaSyYour") and len(key) > 20:
        genai.configure(api_key=key)
        GEMINI_AVAILABLE = True
        print("✓ Gemini API configured successfully.")
    else:
        print("⚠ No valid Gemini API key found — routing all AI calls to Ollama (llama3.2).")
except ImportError:
    print("⚠ google-generativeai not installed — routing all AI calls to Ollama.")


# ──────────────────────────────────────────────
# TEXT EXTRACTION
# ──────────────────────────────────────────────

def extract_text_from_pdf(pdf_path: str) -> str:
    """Extracts text from a PDF using PyMuPDF (fitz)."""
    text = ""
    try:
        doc = fitz.open(pdf_path)
        for page in doc:
            text += page.get_text()
        doc.close()
        print(f"✓ PDF extracted: {len(text)} chars from {os.path.basename(pdf_path)}")
    except Exception as e:
        print(f"✗ PDF extraction error [{os.path.basename(pdf_path)}]: {e}")
    return text


def extract_text_from_docx(docx_path: str) -> str:
    """Extracts text from a DOCX file by parsing the XML."""
    text = ""
    try:
        import zipfile
        import xml.etree.ElementTree as ET
        with zipfile.ZipFile(docx_path, "r") as z:
            with z.open("word/document.xml") as f:
                root = ET.parse(f).getroot()
                for para in root.iter("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}p"):
                    parts = []
                    for run in para.iter("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}r"):
                        for t in run.iter("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}t"):
                            if t.text:
                                parts.append(t.text)
                    if parts:
                        text += " ".join(parts) + "\n"
        print(f"✓ DOCX extracted: {len(text)} chars from {os.path.basename(docx_path)}")
    except Exception as e:
        print(f"✗ DOCX extraction error [{os.path.basename(docx_path)}]: {e}")
    return text


def extract_text_from_file(file_path: str) -> str:
    """Routes extraction by file extension."""
    ext = file_path.lower().rsplit(".", 1)[-1]
    if ext == "pdf":
        return extract_text_from_pdf(file_path)
    elif ext in ("docx", "doc"):
        return extract_text_from_docx(file_path)
    return ""


# ──────────────────────────────────────────────
# JSON PARSING
# ──────────────────────────────────────────────

def parse_json_response(text: str) -> Dict[str, Any]:
    """Strips markdown fences and parses JSON from an LLM response."""
    raw = text.strip()
    if "```json" in raw:
        raw = raw.split("```json", 1)[1].split("```", 1)[0].strip()
    elif "```" in raw:
        raw = raw.split("```", 1)[1].split("```", 1)[0].strip()
    try:
        return json.loads(raw)
    except json.JSONDecodeError as e:
        print(f"✗ JSON parse error: {e}\nRaw response (first 500 chars): {text[:500]}")
        return {}


# ──────────────────────────────────────────────
# AI ENGINE CALLS
# ──────────────────────────────────────────────

def call_ollama(prompt: str, model: str, images: List[str] = None) -> Dict[str, Any]:
    """Calls local Ollama and expects a JSON response."""
    url = f"{settings.OLLAMA_HOST}/api/generate"
    payload = {
        "model": model,
        "prompt": prompt,
        "stream": False,
        "format": "json",
    }
    if images:
        payload["images"] = images

    print(f"→ Calling Ollama model [{model}] at {url} ...")
    try:
        response = requests.post(url, json=payload, timeout=90)
        response.raise_for_status()
        result = response.json()
        raw = result.get("response", "{}")
        print(f"✓ Ollama responded ({len(raw)} chars)")
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return parse_json_response(raw)
    except requests.exceptions.ConnectionError:
        print("✗ Cannot reach Ollama — is it running? (ollama serve)")
        raise
    except requests.exceptions.Timeout:
        print("✗ Ollama timed out after 90s.")
        raise


def call_gemini(prompt_parts: List[Any]) -> Dict[str, Any]:
    """Calls Gemini multimodal model."""
    if not GEMINI_AVAILABLE:
        raise ValueError("Gemini not configured.")
    model = genai.GenerativeModel(settings.GEMINI_MODEL)
    print("→ Calling Gemini ...")
    response = model.generate_content(prompt_parts)
    return parse_json_response(response.text)


def _call_ai(prompt: str, images_b64: List[str] = None) -> Dict[str, Any]:
    """
    Single dispatch: tries Gemini first (if configured), falls back to Ollama.
    For vision tasks Ollama uses the vision model; otherwise text model.
    """
    has_images = bool(images_b64)

    if GEMINI_AVAILABLE:
        try:
            parts = [prompt]
            if has_images:
                for b64 in images_b64:
                    img_data = base64.b64decode(b64)
                    import io
                    parts.append(PIL.Image.open(io.BytesIO(img_data)))
            result = call_gemini(parts)
            if result and result.get("evaluations"):
                return result
            print("⚠ Gemini returned incomplete AI result, falling back to Ollama.")
        except Exception as e:
            print(f"✗ Gemini failed: {e} — falling back to Ollama")

    # Ollama path
    model = settings.OLLAMA_VISION_MODEL if has_images else settings.OLLAMA_TEXT_MODEL
    result = call_ollama(prompt, model, images_b64 if has_images else None)
    if not result or not result.get("evaluations"):
        print("⚠ Ollama returned incomplete AI result.")
    return result


def _fallback_evaluate(criteria: List[Dict[str, Any]], doc_text: str, bidder_files: List[str]) -> Dict[str, Any]:
    """Heuristic fallback when the AI evaluator is unavailable or returns invalid data."""
    text = doc_text.lower()
    doc_name = os.path.basename(bidder_files[0]) if bidder_files else "resume"
    evaluations = []

    for criterion in criteria:
        criterion_id = criterion.get("id") or "unknown"
        name = criterion.get("name", "").strip()
        keyword = name.lower()
        verdict = "review"
        confidence = "low"
        extracted_value = "N/A"
        evidence_snippet = ""

        if keyword and keyword in text:
            verdict = "eligible"
            confidence = "medium"
            extracted_value = name
            start = text.find(keyword)
            evidence_snippet = text[max(0, start - 40):start + len(keyword) + 40].strip()
        elif any(word in text for word in ["experience", "years", "bachelor", "master", "degree"]):
            verdict = "review"
            confidence = "low"
            extracted_value = "possible match"
        else:
            verdict = "ineligible"
            confidence = "low"
            extracted_value = "not found"

        evaluations.append({
            "criterion_id": criterion_id,
            "verdict": verdict,
            "reasoning": f"Fallback heuristic evaluation for '{name}'.",
            "extracted_value": extracted_value,
            "confidence": confidence,
            "source_page": 1,
            "source_document": doc_name,
            "evidence_snippet": evidence_snippet,
            "action_required": "Review the candidate's resume and improve keyword coverage."
        })

    checklist = {"Resume": "found"}
    if "cover letter" in text:
        checklist["Cover Letter"] = "found"
    else:
        checklist["Cover Letter"] = "missing"

    return {"evaluations": evaluations, "checklist": checklist}


# ──────────────────────────────────────────────
# PUBLIC API
# ──────────────────────────────────────────────

def extract_criteria_from_tender(file_path: str) -> Dict[str, Any]:
    """
    Reads a job-description PDF/DOCX and extracts structured evaluation criteria.
    Returns: {"criteria": [...], "required_docs": [...]}
    """
    text = extract_text_from_file(file_path)
    if not text.strip():
        print(f"⚠ No text found in file: {file_path}")
        return {"criteria": [], "required_docs": ["Resume"]}

    print(f"✓ Extracted {len(text)} chars — sending to AI for criteria extraction ...")

    prompt = f"""You are an expert HR Recruiter and ATS Auditor. Analyze the following job description text and extract structured evaluation criteria.

Return ONLY a valid JSON object with this EXACT structure (no extra text, no markdown):
{{
  "criteria": [
    {{
      "category": "Technical Skills",
      "name": "React.js",
      "threshold": "3+ years of professional React experience",
      "mandatory": true,
      "source_page": 1,
      "source_text": "exact quote from document"
    }}
  ],
  "required_docs": ["Resume", "Cover Letter"]
}}

Rules:
- Extract ALL skills, experience requirements, education/certification requirements mentioned.
- Mark a criterion as mandatory=true if the job description uses words like "required", "must have", "essential".
- Mark mandatory=false for "preferred", "nice to have", "plus".
- Include at least 3-8 criteria.
- required_docs should list any documents explicitly requested (always include "Resume").

JOB DESCRIPTION:
{text[:8000]}
"""

    try:
        result = _call_ai(prompt)
        if result and result.get("criteria"):
            print(f"✓ Extracted {len(result['criteria'])} criteria from document.")
            return result
        else:
            print(f"⚠ AI returned empty/invalid criteria. Raw result: {result}")
            return {"criteria": [], "required_docs": ["Resume"]}
    except Exception as e:
        print(f"✗ AI extraction failed: {e}")
        return {"criteria": [], "required_docs": ["Resume"]}


def evaluate_bidder_against_criteria(
    bidder_files: List[str], criteria: List[Dict[str, Any]]
) -> Dict[str, Any]:
    """
    Evaluates resume files against the provided criteria.
    Returns: {"evaluations": [...], "checklist": {...}}
    """
    if not criteria:
        print("⚠ No criteria provided — cannot evaluate bidder.")
        return {"evaluations": [], "checklist": {}}

    # Build the document content string
    doc_text = ""
    images_b64 = []

    for file_path in bidder_files:
        ext = file_path.lower().rsplit(".", 1)[-1]
        fname = os.path.basename(file_path)
        if ext == "pdf":
            text = extract_text_from_pdf(file_path)
            doc_text += f"\n\n=== PDF: {fname} ===\n{text[:6000]}"
        elif ext in ("docx", "doc"):
            text = extract_text_from_docx(file_path)
            doc_text += f"\n\n=== DOCX: {fname} ===\n{text[:6000]}"
        elif ext in ("jpg", "jpeg", "png"):
            try:
                with open(file_path, "rb") as img_f:
                    images_b64.append(base64.b64encode(img_f.read()).decode("utf-8"))
                doc_text += f"\n\n=== IMAGE: {fname} (attached) ==="
            except Exception as e:
                print(f"✗ Image load error [{fname}]: {e}")
        else:
            doc_text += f"\n\n=== FILE: {fname} (unsupported format, skipped) ==="

    criteria_json = json.dumps(criteria, indent=2)

    prompt = f"""You are an expert ATS (Applicant Tracking System) evaluator. Evaluate the candidate's resume against each job requirement.

CRITERIA TO EVALUATE:
{criteria_json}

CANDIDATE RESUME CONTENT:
{doc_text}

For each criterion, carefully read the resume and decide:
- "eligible": candidate clearly meets this requirement
- "ineligible": candidate clearly does NOT meet this requirement  
- "review": partial match or unclear — needs human review

Return ONLY a valid JSON object (no markdown, no extra text):
{{
  "evaluations": [
    {{
      "criterion_id": "<id from criteria>",
      "verdict": "eligible|ineligible|review",
      "reasoning": "Detailed explanation of why this verdict was given, referencing specific resume content",
      "extracted_value": "The actual value/years/skill found in the resume",
      "confidence": "high|medium|low",
      "source_page": 1,
      "source_document": "<filename>",
      "evidence_snippet": "Direct quote or paraphrase from the resume that proves or disproves this criterion",
      "action_required": "Constructive suggestion for the candidate to improve their chances"
    }}
  ],
  "checklist": {{
    "Resume": "found",
    "Cover Letter": "missing"
  }}
}}

Important:
- Include one evaluation entry for EVERY criterion in the list.
- Use the exact criterion id from the criteria list.
- Be specific and reference actual content from the resume.
"""

    print(f"→ Evaluating {len(criteria)} criteria against {len(bidder_files)} document(s)...")
    try:
        result = _call_ai(prompt, images_b64 if images_b64 else None)
        if result and result.get("evaluations") and len(result["evaluations"]) == len(criteria):
            print(f"✓ Got {len(result['evaluations'])} evaluations from AI.")
            return result
        print(f"⚠ AI returned incomplete evaluations. Falling back to heuristic evaluation. Raw: {result}")
        return _fallback_evaluate(criteria, doc_text, bidder_files)
    except Exception as e:
        print(f"✗ AI evaluation failed: {e} — using fallback heuristic evaluation.")
        return _fallback_evaluate(criteria, doc_text, bidder_files)
