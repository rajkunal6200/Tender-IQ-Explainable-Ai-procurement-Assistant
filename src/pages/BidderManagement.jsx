import { useState, useEffect } from 'react';
import { Users, CheckCircle, Loader, FileText, Eye, Download, Search, Briefcase, Trash2 } from 'lucide-react';
import { api } from '../utils/api';
import { downloadBlob, generateEvaluationReport } from '../utils/downloadUtils';

export default function BidderManagement({ search, onViewEvidence }) {
  const [bidders, setBidders] = useState([]);
  const [tenders, setTenders] = useState([]);
  const [selectedTender, setSelectedTender] = useState('');
  const [loading, setLoading] = useState(true);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [extractionLogs, setExtractionLogs] = useState([]);

  const parsingSteps = [
    "Analyzing applicant document package...",
    "OCR Engine: Extraction initiated...",
    "Extracted Contact Info: Candidate email and phone resolved.",
    "Extracted Work History: Found previous job roles and durations.",
    "Extracted Skills Matrix: Identified core tools and frameworks.",
    "Comparing extracted profile against target Job Description...",
    "Running qualification matches and calculating ATS scores...",
    "AI Parsing Complete. Candidate profile generated."
  ];

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [biddersData, tendersData] = await Promise.all([
          api.getBidders(),
          api.getTenders()
        ]);
        setBidders(biddersData);
        setTenders(tendersData);
        if (tendersData.length > 0) {
          setSelectedTender(tendersData[0].id);
        }
      } catch (error) {
        console.error("Error fetching candidates data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleUpload = async (fileList) => {
    if (!fileList || fileList.length === 0) return;
    if (!selectedTender) {
      alert("Please upload or select a Job Description first.");
      return;
    }
    setUploading(true);
    setProgress(15);
    setExtractionLogs(["Initializing multi-format AI resume parser..."]);
    
    const files = Array.from(fileList);
    
    // Animate logs
    let stepIndex = 0;
    const interval = setInterval(() => {
      if (stepIndex < parsingSteps.length) {
        setExtractionLogs(prev => [...prev, parsingSteps[stepIndex]]);
        setProgress(prev => Math.min(95, prev + 10));
        stepIndex++;
      } else {
        clearInterval(interval);
      }
    }, 500);

    try {
      // Auto-extract candidate name from file name
      const candidateFile = files.find(file => {
        const baseName = file.name.split('.')[0] || '';
        return !/^(resume|cv)$/i.test(baseName.trim());
      }) || files[0];
      let rawName = candidateFile.name.split('.')[0] || "New Candidate";
      // Clean up common resume keywords for clean display
      rawName = rawName
        .replace(/_resume|_cv|resume|cv/gi, "")
        .replace(/[-_]/g, " ")
        .trim();
      if (!rawName) rawName = "New Candidate";
      // Capitalize words
      const candidateName = rawName.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

      const result = await api.uploadBidder({
        tender_id: selectedTender,
        name: candidateName,
        files: files
      });
      
      clearInterval(interval);
      setExtractionLogs(prev => [...prev, "AI parsing and evaluation complete. Match score calculated!"]);
      setProgress(100);
      setTimeout(() => {
        setUploading(false);
        setBidders(prev => [result, ...prev]);
      }, 1000);
    } catch (error) {
      clearInterval(interval);
      console.error("Resume upload failed:", error);
      setExtractionLogs(prev => [...prev, "Error: Resume parsing failed. Check backend uvicorn and API configurations."]);
      setUploading(false);
    }
  };

  const onFileChange = (e) => {
    handleUpload(e.target.files);
  };

  const handleDownloadReport = async (candidate) => {
    try {
      // Fetch the candidate's evaluations dynamically first
      const evaluations = await api.getEvaluations(candidate.id);
      const reportContent = generateEvaluationReport(candidate, evaluations);
      downloadBlob(reportContent, `Resume_Evaluator_Report_${candidate.name.replace(/\s+/g, '_')}.txt`, 'text/plain');
    } catch (error) {
      console.error("Failed to export candidate report:", error);
      alert("Error exporting candidate report.");
    }
  };

  const handleDeleteBidder = async (bidder) => {
    if (!window.confirm(`Delete candidate ${bidder.name}? This removes their resume and evaluation data.`)) return;
    try {
      await api.deleteBidder(bidder.id);
      setBidders(prev => prev.filter(item => item.id !== bidder.id));
    } catch (error) {
      console.error("Failed to delete candidate:", error);
      alert("Error deleting candidate.");
    }
  };

  if (loading) return <div className="fade-in" style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}>Loading Candidates & Resumes...</div>;

  return (
    <div className="fade-in">
      {/* Upload Section */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="section-header" style={{ flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div className="section-title">Upload Candidate Resumes</div>
            <div className="section-subtitle">Select a target job opening and upload candidates' resumes (PDF, DOCX, or Images)</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Briefcase size={16} style={{ color: '#6366f1' }} />
            <select 
              className="filter-select" 
              value={selectedTender} 
              onChange={e => setSelectedTender(e.target.value)}
              style={{ minWidth: 260, fontSize: '0.85rem', padding: '8px 12px' }}
            >
              {tenders.map(t => (
                <option key={t.id} value={t.id}>{t.title} ({t.id})</option>
              ))}
              {tenders.length === 0 && <option value="">No Active Job Openings</option>}
            </select>
          </div>
        </div>

        <div
          className={`upload-zone ${dragOver ? 'dragover' : ''}`}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { 
            e.preventDefault(); 
            setDragOver(false); 
            if (e.dataTransfer.files.length > 0) handleUpload(e.dataTransfer.files); 
          }}
          onClick={() => document.getElementById('bidder-file-input').click()}
          style={{ minHeight: 150 }}
        >
          <input 
            id="bidder-file-input" 
            type="file" 
            style={{ display: 'none' }} 
            onChange={onFileChange}
            multiple
            accept=".pdf,.docx,.jpg,.png"
          />
          <div className="upload-zone-icon"><Users size={36} /></div>
          <div className="upload-zone-text" style={{ fontSize: '0.85rem', fontWeight: 600 }}>Drop candidate resumes here, or click to browse</div>
          <div className="upload-zone-hint" style={{ fontSize: '0.7rem' }}>Supports PDF, DOCX, JPEG, PNG — Multi-document supported (e.g. Resume + Cover Letter)</div>
        </div>

        {uploading && (
          <div style={{ marginTop: 24 }} className="fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>AI parsing in progress...</span>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6366f1' }}>{Math.round(progress)}%</span>
            </div>
            <div className="progress-bar" style={{ marginBottom: 16 }}>
              <div className="progress-fill" style={{ width: `${progress}%` }} />
            </div>
            
            <div style={{ 
              padding: 14, 
              background: 'rgba(0,0,0,0.3)', 
              borderRadius: 8, 
              border: '1px solid rgba(255,255,255,0.05)',
              fontFamily: 'JetBrains Mono',
              maxHeight: '140px',
              overflowY: 'auto'
            }}>
              {extractionLogs.map((log, i) => (
                <div key={i} style={{ fontSize: '0.7rem', color: i === extractionLogs.length - 1 ? '#6366f1' : '#64748b', marginBottom: 4, display: 'flex', gap: 8 }}>
                  <span style={{ color: '#4ade80' }}>&gt;</span>
                  {log}
                </div>
              ))}
              {uploading && <div className="pulse" style={{ width: 4, height: 10, background: '#6366f1', display: 'inline-block', marginLeft: 16 }} />}
            </div>
          </div>
        )}
      </div>

      {/* Candidates Header */}
      <div className="section-header" style={{ marginBottom: 16 }}>
        <div className="section-title">Evaluated Applicants</div>
        <span className="badge badge-purple" style={{ fontWeight: 600 }}>{bidders.length} candidates</span>
      </div>

      {/* Grid of Candidate Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 18, marginBottom: 24 }}>
        {bidders
          .filter(b => !search || b.name.toLowerCase().includes(search.toLowerCase()) || b.id.toLowerCase().includes(search.toLowerCase()))
          .map(bidder => {
            const overallScore = bidder.match_score || 0;
            const scoreColor = overallScore >= 80 ? '#10b981' : overallScore >= 60 ? '#f59e0b' : '#ef4444';
            return (
              <div className="card" key={bidder.id} style={{ position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#f1f5f9', marginBottom: 2 }}>{bidder.name}</div>
                      <div style={{ fontSize: '0.7rem', color: '#64748b', fontFamily: 'JetBrains Mono' }}>Applicant ID: {bidder.id}</div>
                    </div>
                    <span className={`badge ${bidder.status === 'parsed' ? 'badge-green' : 'badge-yellow'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.7rem' }}>
                      {bidder.status === 'parsed' ? <><CheckCircle size={10}/> Parsed</> : <><Loader size={10}/> Parsing</>}
                    </span>
                  </div>

                  {/* Applied Job Info */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.75rem', color: '#94a3b8', marginBottom: 14 }}>
                    <Briefcase size={12} style={{ color: '#818cf8' }}/>
                    <span>Applied to: <b>{bidder.tender_id}</b></span>
                  </div>

                  {/* Documents List */}
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ fontSize: '0.65rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6, fontWeight: 600 }}>Submitted Files</div>
                    {bidder.documents && bidder.documents.map((doc, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', background: 'rgba(255,255,255,0.02)', borderRadius: 6, marginBottom: 4, border: '1px solid rgba(255,255,255,0.04)' }}>
                        <FileText size={12} style={{ color: '#6366f1', flexShrink: 0 }} />
                        <span style={{ fontSize: '0.75rem', color: '#cbd5e1', flex: 1, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{doc}</span>
                        <span className={`badge ${doc.endsWith('.pdf') ? 'badge-purple' : 'badge-cyan'}`} style={{ fontSize: '0.55rem', padding: '1px 4px' }}>{doc.endsWith('.pdf') ? 'PDF' : 'DOCX'}</span>
                      </div>
                    ))}
                  </div>

                  {/* Match Score */}
                  {bidder.match_score !== null && (
                    <div style={{ marginBottom: 18 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span style={{ fontSize: '0.65rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>ATS Match Score</span>
                        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: scoreColor }}>{Math.round(overallScore)}% Match</span>
                      </div>
                      <div className="progress-bar" style={{ height: 6 }}>
                        <div className="progress-fill" style={{ width: `${overallScore}%`, background: scoreColor }} />
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <button 
                    className="btn btn-secondary btn-sm" 
                    style={{ flex: 1, fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                    onClick={() => onViewEvidence(bidder.id)}
                  >
                    <Eye size={12}/> Match Details
                  </button>
                  <button 
                    className="btn btn-primary btn-sm" 
                    style={{ flex: 1, fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }} 
                    onClick={() => handleDownloadReport(bidder)}
                  >
                    <Download size={12}/> Export Report
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    style={{ flex: 1, fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}
                    onClick={() => handleDeleteBidder(bidder)}
                  >
                    <Trash2 size={12}/> Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
  );
}
