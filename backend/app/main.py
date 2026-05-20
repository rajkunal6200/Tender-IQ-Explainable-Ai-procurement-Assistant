from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect
from sqlalchemy.orm import Session
from typing import List
import uvicorn
import shutil
import os
import uuid
import datetime

import hashlib

def calculate_hash(file_path):
    sha256_hash = hashlib.sha256()
    with open(file_path, "rb") as f:
        for byte_block in iter(lambda: f.read(4096), b""):
            sha256_hash.update(byte_block)
    return sha256_hash.hexdigest()

from .database import engine, get_db, Base
from .models import models
from .services import ai_service
from .config import settings

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Resume Evaluator API")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = settings.UPLOAD_DIR
os.makedirs(UPLOAD_DIR, exist_ok=True)

def ensure_sqlite_schema():
    if not settings.DATABASE_URL.startswith("sqlite:///"):
        return

    db_file = settings.DATABASE_URL.replace("sqlite:///", "")
    if not os.path.exists(db_file):
        return

    inspector = inspect(engine)
    if not inspector.has_table("tenders"):
        return

    existing_columns = {col["name"] for col in inspector.get_columns("tenders")}
    required_columns = {
        "description_text",
        "experience_summary",
        "target_skills_json",
        "ai_summary",
        "score_weights",
    }
    if not required_columns.issubset(existing_columns):
        backup_path = f"{db_file}.bak"
        if not os.path.exists(backup_path):
            os.rename(db_file, backup_path)
        print(f"Outdated SQLite DB schema detected. Backed up old database to {backup_path} and recreating schema.")

ensure_sqlite_schema()
Base.metadata.create_all(bind=engine)


def serialize_tender(tender: models.Tender):
    return {
        "id": tender.id,
        "title": tender.title,
        "department": tender.department,
        "upload_date": tender.upload_date.isoformat() if tender.upload_date else None,
        "status": tender.status,
        "value": tender.value,
        "required_docs": tender.required_docs or [],
        "is_signed": tender.is_signed,
        "signed_by": tender.signed_by,
        "signed_at": tender.signed_at.isoformat() if tender.signed_at else None,
        "description_text": tender.description_text,
        "experience_summary": tender.experience_summary,
        "target_skills_json": tender.target_skills_json,
        "ai_summary": tender.ai_summary,
        "score_weights": tender.score_weights,
    }


def serialize_criterion(criterion: models.Criterion):
    return {
        "id": criterion.id,
        "tender_id": criterion.tender_id,
        "category": criterion.category,
        "name": criterion.name,
        "threshold": criterion.threshold,
        "mandatory": criterion.mandatory,
        "source_page": criterion.source_page,
        "source_text": criterion.source_text,
    }


def serialize_bidder(bidder: models.Bidder):
    return {
        "id": bidder.id,
        "tender_id": bidder.tender_id,
        "name": bidder.name,
        "status": bidder.status,
        "match_score": bidder.match_score,
        "hidden_talent_score": bidder.hidden_talent_score,
        "future_potential_score": bidder.future_potential_score,
        "learning_ability_score": bidder.learning_ability_score,
        "authenticity_score": bidder.authenticity_score,
        "passion_score": bidder.passion_score,
        "team_compatibility": bidder.team_compatibility,
        "is_disqualified": bidder.is_disqualified,
        "disqualification_reason": bidder.disqualification_reason,
        "documents": bidder.documents or [],
        "file_hashes": bidder.file_hashes or {},
        "checklist_status": bidder.checklist_status or {},
        "parsed_profile": bidder.parsed_profile,
        "resume_text": bidder.resume_text,
    }


def serialize_evaluation(evaluation: models.Evaluation):
    return {
        "id": evaluation.id,
        "bidder_id": evaluation.bidder_id,
        "criterion_id": evaluation.criterion_id,
        "verdict": evaluation.verdict,
        "confidence": evaluation.confidence,
        "match_type": evaluation.match_type,
        "extracted_value": evaluation.extracted_value,
        "reasoning": evaluation.reasoning,
        "source_page": evaluation.source_page,
        "source_document": evaluation.source_document,
        "evidence_snippet": evaluation.evidence_snippet,
        "action_required": evaluation.action_required,
    }


def serialize_audit_log(audit: models.AuditLog):
    return {
        "id": audit.id,
        "timestamp": audit.timestamp.isoformat() if audit.timestamp else None,
        "user": audit.user,
        "action": audit.action,
        "entity": audit.entity,
        "details": audit.details,
        "type": audit.type,
    }

@app.get("/")
async def root():
    return {"message": "Resume Evaluator API is running"}

@app.get("/tenders")
def get_tenders(db: Session = Depends(get_db)):
    return [serialize_tender(t) for t in db.query(models.Tender).all()]

@app.get("/tenders/{tender_id}/criteria")
def get_criteria(tender_id: str, db: Session = Depends(get_db)):
    return [serialize_criterion(c) for c in db.query(models.Criterion).filter(models.Criterion.tender_id == tender_id).all()]

@app.get("/bidders")
def get_bidders(db: Session = Depends(get_db)):
    return [serialize_bidder(b) for b in db.query(models.Bidder).all()]

@app.get("/evaluations/{bidder_id}")
def get_evaluations(bidder_id: str, db: Session = Depends(get_db)):
    return [serialize_evaluation(e) for e in db.query(models.Evaluation).filter(models.Evaluation.bidder_id == bidder_id).all()]

@app.get("/tenders/{tender_id}/summary")
def get_tender_summary(tender_id: str, db: Session = Depends(get_db)):
    tender = db.query(models.Tender).filter(models.Tender.id == tender_id).first()
    if not tender: raise HTTPException(404, "Tender not found")
    
    bidders = db.query(models.Bidder).filter(models.Bidder.tender_id == tender_id).all()
    criteria = db.query(models.Criterion).filter(models.Criterion.tender_id == tender_id).all()
    
    summary = []
    for bidder in bidders:
        evals = db.query(models.Evaluation).filter(models.Evaluation.bidder_id == bidder.id).all()
        # Create a map of criterion_id -> verdict
        verdicts = {e.criterion_id: e.verdict for e in evals}
        summary.append({
            "bidder_id": bidder.id,
            "name": bidder.name,
            "status": bidder.status,
            "match_score": bidder.match_score,
            "is_disqualified": bidder.is_disqualified,
            "disqualification_reason": bidder.disqualification_reason,
            "verdicts": verdicts
        })
    
    return {
        "tender_id": tender_id,
        "criteria": [{"id": c.id, "name": c.name, "mandatory": c.mandatory} for c in criteria],
        "required_docs": tender.required_docs,
        "is_signed": tender.is_signed,
        "signed_by": tender.signed_by,
        "bidders": summary
    }

@app.post("/tenders/{tender_id}/sign")
def sign_tender(tender_id: str, officer_name: str, db: Session = Depends(get_db)):
    tender = db.query(models.Tender).filter(models.Tender.id == tender_id).first()
    if not tender: raise HTTPException(404, "Tender not found")
    
    tender.is_signed = True
    tender.signed_by = officer_name
    tender.signed_at = datetime.datetime.utcnow()
    
    db.add(models.AuditLog(user=officer_name, action="sign-off", entity="Tender", details=f"Final evaluation signed off for {tender_id}.", type="action"))
    db.commit()
    return {"message": "Tender signed off successfully"}

@app.get("/audit")
def get_audit(db: Session = Depends(get_db)):
    return [serialize_audit_log(a) for a in db.query(models.AuditLog).order_by(models.AuditLog.timestamp.desc()).all()]

@app.put("/evaluations/{eval_id}")
def update_evaluation(eval_id: int, verdict: str, db: Session = Depends(get_db)):
    evaluation = db.query(models.Evaluation).filter(models.Evaluation.id == eval_id).first()
    if not evaluation:
        raise HTTPException(status_code=404, detail="Evaluation not found")
    
    old_verdict = evaluation.verdict
    evaluation.verdict = verdict
    
    # If a mandatory criterion is rejected, mark the bidder as disqualified
    bidder = db.query(models.Bidder).filter(models.Bidder.id == evaluation.bidder_id).first()
    criterion = db.query(models.Criterion).filter(models.Criterion.id == evaluation.criterion_id).first()
    
    if bidder and criterion:
        if verdict == "ineligible" and criterion.mandatory:
            bidder.is_disqualified = True
            bidder.disqualification_reason = f"Human override: Failed mandatory criterion {criterion.name}"
        elif verdict == "eligible" and criterion.mandatory:
            # Check if any OTHER mandatory criteria are failing before clearing disqualification
            other_fails = db.query(models.Evaluation).join(models.Criterion).filter(
                models.Evaluation.bidder_id == bidder.id,
                models.Criterion.mandatory == True,
                models.Evaluation.verdict == "ineligible",
                models.Evaluation.id != eval_id
            ).count()
            if other_fails == 0:
                bidder.is_disqualified = False
                bidder.disqualification_reason = None
        
        # Recalculate score
        evals = db.query(models.Evaluation).filter(models.Evaluation.bidder_id == bidder.id).all()
        eligible_count = sum(1 for e in evals if e.verdict == "eligible")
        if len(evals) > 0:
            bidder.match_score = (eligible_count / len(evals)) * 100
    
    # Log the human override
    audit = models.AuditLog(
        user="CRPF Officer", 
        action="approval" if verdict == "eligible" else "override", 
        entity=f"Eval {eval_id}", 
        details=f"Human override: Changed verdict from {old_verdict} to {verdict}. Updated bidder status.", 
        type="approval" if verdict == "eligible" else "alert"
    )
    db.add(audit)
    db.commit()
    return {"message": "Verdict updated"}

@app.post("/tenders/upload")
async def upload_tender(
    title: str = Form(...),
    department: str = Form(...),
    value: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    tender_id = f"T-{uuid.uuid4().hex[:4].upper()}"
    filename = file.filename or f"tender_{uuid.uuid4().hex}.pdf"
    file_path = os.path.join(UPLOAD_DIR, "tenders", f"{tender_id}_{filename}")
    os.makedirs(os.path.dirname(file_path), exist_ok=True)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    file_hash = calculate_hash(file_path)
    tender = models.Tender(id=tender_id, title=title, department=department, value=value, status="parsing", document_path=file_path, file_hash=file_hash)
    db.add(tender)
    db.commit()

    # AI Extraction
    ai_data = ai_service.extract_criteria_from_tender(file_path)
    tender.required_docs = ai_data.get("required_docs", [])
    db.commit()

    for i, c in enumerate(ai_data.get("criteria", [])):
        crit = models.Criterion(
            id=f"C-{tender_id}-{i}",
            tender_id=tender_id,
            category=c.get("category", "General"),
            name=c.get("name", "Unnamed"),
            threshold=c.get("threshold", "N/A"),
            mandatory=c.get("mandatory", True),
            source_page=c.get("source_page", 1),
            source_text=c.get("source_text", "")
        )
        db.add(crit)
    
    tender.status = "evaluated"
    db.add(models.AuditLog(user="System (AI)", action="extraction", entity=f"Tender {tender_id}", details=f"Extracted {len(ai_data.get('criteria', []))} criteria from document.", type="action"))
    db.commit()
    db.refresh(tender)
    return serialize_tender(tender)

@app.post("/bidders/upload")
async def upload_bidder(
    tender_id: str = Form(...),
    name: str = Form(...),
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db)
):
    bidder_id = f"B-{uuid.uuid4().hex[:4].upper()}"
    saved_files = []
    file_hashes = {}
    filenames: list[str] = []
    
    bidder_dir = os.path.join(UPLOAD_DIR, "bidders", bidder_id)
    os.makedirs(bidder_dir, exist_ok=True)
    
    for file in files:
        filename = file.filename or f"bidder_{uuid.uuid4().hex}.pdf"
        file_path = os.path.join(bidder_dir, filename)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        saved_files.append(file_path)
        file_hashes[filename] = calculate_hash(file_path)
        filenames.append(filename)
    
    bidder = models.Bidder(id=bidder_id, tender_id=tender_id, name=name, status="parsing", documents=filenames, file_hashes=file_hashes)
    db.add(bidder)
    db.commit()

    # Get tender criteria
    criteria = db.query(models.Criterion).filter(models.Criterion.tender_id == tender_id).all()
    criteria_dicts = [{"id": c.id, "category": c.category, "name": c.name, "threshold": c.threshold, "mandatory": c.mandatory} for c in criteria]
    
    # AI Evaluation
    ai_result = ai_service.evaluate_bidder_against_criteria(saved_files, criteria_dicts)
    evaluations_data = ai_result.get("evaluations", [])
    bidder.checklist_status = ai_result.get("checklist", {})
    
    total_criteria = len(evaluations_data)
    eligible_count = 0
    
    for res in evaluations_data:
        # Check if this criterion was mandatory
        criterion_obj = next((c for c in criteria if c.id == res.get("criterion_id")), None)
        is_mandatory = criterion_obj.mandatory if criterion_obj else False
        
        evaluation = models.Evaluation(
            bidder_id=bidder_id,
            criterion_id=res.get("criterion_id"),
            verdict=res.get("verdict", "review"),
            confidence=res.get("confidence", "low"),
            match_type=res.get("match_type", "semantic"),
            extracted_value=res.get("extracted_value", "N/A"),
            reasoning=res.get("reasoning", ""),
            source_page=res.get("source_page", 1),
            source_document=res.get("source_document", "Unknown"),
            evidence_snippet=res.get("evidence_snippet", ""),
            action_required=res.get("action_required", "")
        )
        db.add(evaluation)
        
        if res.get("verdict") == "eligible":
            eligible_count += 1
        elif res.get("verdict") == "ineligible" and is_mandatory:
            bidder.is_disqualified = True
            bidder.disqualification_reason = f"Failed mandatory criterion: {criterion_obj.name if criterion_obj else res.get('criterion_id')}"

    # Update bidder status and score
    bidder.status = "parsed"
    if total_criteria > 0:
        bidder.match_score = (eligible_count / total_criteria) * 100
    else:
        bidder.match_score = 100
        
    db.add(models.AuditLog(user="System (AI)", action="evaluation", entity=f"Bidder {bidder_id}", details=f"Evaluated {total_criteria} criteria. Result: {bidder.match_score}% match.", type="action"))
    db.commit()
    db.refresh(bidder)
    return serialize_bidder(bidder)

@app.delete("/tenders/{tender_id}")
def delete_tender(tender_id: str, db: Session = Depends(get_db)):
    tender = db.query(models.Tender).filter(models.Tender.id == tender_id).first()
    if not tender:
        raise HTTPException(status_code=404, detail="Tender not found")

    db.query(models.Evaluation).filter(models.Evaluation.bidder_id.in_(
        db.query(models.Bidder.id).filter(models.Bidder.tender_id == tender_id)
    )).delete(synchronize_session=False)
    db.query(models.Bidder).filter(models.Bidder.tender_id == tender_id).delete(synchronize_session=False)
    db.query(models.Criterion).filter(models.Criterion.tender_id == tender_id).delete(synchronize_session=False)
    db.delete(tender)

    db.add(models.AuditLog(user="system", action="delete", entity=f"Tender {tender_id}", details=f"Deleted tender and all related bidders, criteria and evaluations.", type="action"))
    db.commit()
    return {"message": f"Tender {tender_id} deleted successfully"}

@app.delete("/bidders/{bidder_id}")
def delete_bidder(bidder_id: str, db: Session = Depends(get_db)):
    bidder = db.query(models.Bidder).filter(models.Bidder.id == bidder_id).first()
    if not bidder:
        raise HTTPException(status_code=404, detail="Bidder not found")

    db.query(models.Evaluation).filter(models.Evaluation.bidder_id == bidder_id).delete(synchronize_session=False)
    db.delete(bidder)

    db.add(models.AuditLog(user="system", action="delete", entity=f"Bidder {bidder_id}", details=f"Deleted bidder and all related evaluations.", type="action"))
    db.commit()
    return {"message": f"Bidder {bidder_id} deleted successfully"}

@app.delete("/evaluations/{eval_id}")
def delete_evaluation(eval_id: int, db: Session = Depends(get_db)):
    evaluation = db.query(models.Evaluation).filter(models.Evaluation.id == eval_id).first()
    if not evaluation:
        raise HTTPException(status_code=404, detail="Evaluation not found")

    bidder = db.query(models.Bidder).filter(models.Bidder.id == evaluation.bidder_id).first()
    db.delete(evaluation)

    if bidder:
        remaining = db.query(models.Evaluation).filter(models.Evaluation.bidder_id == bidder.id).all()
        eligible_count = sum(1 for e in remaining if e.verdict == "eligible")
        bidder.match_score = (eligible_count / len(remaining)) * 100 if remaining else None

        mandatory_fails = db.query(models.Evaluation).join(models.Criterion).filter(
            models.Evaluation.bidder_id == bidder.id,
            models.Criterion.mandatory == True,
            models.Evaluation.verdict == "ineligible"
        ).count()
        bidder.is_disqualified = mandatory_fails > 0
        if not bidder.is_disqualified:
            bidder.disqualification_reason = None

    db.add(models.AuditLog(user="system", action="delete", entity=f"Evaluation {eval_id}", details=f"Deleted evaluation and recalculated bidder score.", type="action"))
    db.commit()
    return {"message": f"Evaluation {eval_id} deleted successfully"}

if __name__ == "__main__":
    uvicorn.run("backend.app.main:app", host="0.0.0.0", port=8000, reload=True)
