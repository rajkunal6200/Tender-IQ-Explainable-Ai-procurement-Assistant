import { useState, useEffect } from 'react';
import { Upload, CheckCircle, Loader, Edit3, Trash2, FileText, Briefcase, DollarSign, Users } from 'lucide-react';
import { api } from '../utils/api';

export default function TenderUpload({ search }) {
  const [tenders, setTenders] = useState([]);
  const [criteria, setCriteria] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [activeTab, setActiveTab] = useState('all');
  const [dragOver, setDragOver] = useState(false);
  const [extractionLogs, setExtractionLogs] = useState([]);

  // Form states
  const [jobTitle, setJobTitle] = useState('Senior Full-Stack Engineer');
  const [department, setDepartment] = useState('Engineering');
  const [salaryRange, setSalaryRange] = useState('$130,000 - $160,000');

  const extractionSteps = [
    "Reading job description document...",
    "OCR Engine: Analyzing document layout...",
    "Identifying core qualification requirements...",
    "Extracting Technical Skills...",
    "Extracting Experience levels...",
    "Extracting Education & Certifications...",
    "Verification complete. Requirements parsed."
  ];

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await api.getTenders();
        setTenders(data);
        if (data.length > 0) {
          const critData = await api.getCriteria(data[0].id);
          setCriteria(critData);
        }
      } catch (error) {
        console.error("Error fetching job descriptions:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleUpload = async (file) => {
    if (!file) return;
    if (!jobTitle.trim() || !department.trim() || !salaryRange.trim()) {
      alert("Please fill in Job Title, Department, and Salary Range first.");
      return;
    }
    setUploading(true);
    setProgress(15);
    setExtractionLogs(["Initializing AI requirement extraction..."]);

    // Animate logging progress
    let logIndex = 0;
    const interval = setInterval(() => {
      if (logIndex < extractionSteps.length) {
        setExtractionLogs(prev => [...prev, extractionSteps[logIndex]]);
        setProgress(prev => Math.min(90, prev + 12));
        logIndex++;
      } else {
        clearInterval(interval);
      }
    }, 600);
    
    try {
      const result = await api.createTender({
        title: jobTitle,
        department: department,
        value: salaryRange,
        file: file
      });
      
      clearInterval(interval);
      setExtractionLogs(prev => [...prev, "AI analysis complete. Job criteria successfully stored in database."]);
      setProgress(100);
      setTimeout(() => {
        setUploading(false);
        api.getTenders().then(setTenders);
        if (result.id) api.getCriteria(result.id).then(setCriteria);
      }, 1000);
    } catch (error) {
      clearInterval(interval);
      console.error("Job Upload failed:", error);
      setExtractionLogs(prev => [...prev, "Error: Requirement extraction failed. Please verify API configurations."]);
      setUploading(false);
    }
  };

  const onFileChange = (e) => {
    const file = e.target.files[0];
    handleUpload(file);
  };

  const filtered = activeTab === 'all' 
    ? criteria 
    : criteria.filter(c => c.category.toLowerCase() === activeTab.toLowerCase());

  if (loading) return <div className="fade-in" style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}>Loading Job Descriptions...</div>;

  return (
    <div className="fade-in">
      {/* Upload and Form Section */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="section-header">
          <div>
            <div className="section-title">Upload Job Description</div>
            <div className="section-subtitle">Define job metadata and upload the Job Description PDF or DOCX to auto-extract match criteria</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginTop: 16, marginBottom: 24 }}>
          {/* Metadata Inputs */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="criterion-field">
              <label style={{ fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Briefcase size={14} style={{ color: '#6366f1' }}/> Job Title
              </label>
              <input 
                type="text" 
                value={jobTitle} 
                onChange={e => setJobTitle(e.target.value)} 
                placeholder="e.g. Senior Software Engineer"
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 6,
                  padding: '10px 12px',
                  color: '#f8fafc',
                  fontSize: '0.85rem',
                  outline: 'none',
                  marginTop: 6
                }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="criterion-field">
                <label style={{ fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Users size={14} style={{ color: '#06b6d4' }}/> Department / Team
                </label>
                <input 
                  type="text" 
                  value={department} 
                  onChange={e => setDepartment(e.target.value)} 
                  placeholder="e.g. Engineering"
                  style={{
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 6,
                    padding: '10px 12px',
                    color: '#f8fafc',
                    fontSize: '0.85rem',
                    outline: 'none',
                    marginTop: 6,
                    width: '100%'
                  }}
                />
              </div>

              <div className="criterion-field">
                <label style={{ fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <DollarSign size={14} style={{ color: '#10b981' }}/> Salary Range
                </label>
                <input 
                  type="text" 
                  value={salaryRange} 
                  onChange={e => setSalaryRange(e.target.value)} 
                  placeholder="e.g. $130k - $160k"
                  style={{
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 6,
                    padding: '10px 12px',
                    color: '#f8fafc',
                    fontSize: '0.85rem',
                    outline: 'none',
                    marginTop: 6,
                    width: '100%'
                  }}
                />
              </div>
            </div>
          </div>

          {/* Drag & Drop zone */}
          <div
            className={`upload-zone ${dragOver ? 'dragover' : ''}`}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { 
              e.preventDefault(); 
              setDragOver(false); 
              if (e.dataTransfer.files.length > 0) handleUpload(e.dataTransfer.files[0]); 
            }}
            onClick={() => document.getElementById('tender-file-input').click()}
            style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: 160 }}
          >
            <input 
              id="tender-file-input" 
              type="file" 
              style={{ display: 'none' }} 
              onChange={onFileChange}
              accept=".pdf,.docx"
            />
            <div className="upload-zone-icon"><Upload size={32} /></div>
            <div className="upload-zone-text" style={{ fontSize: '0.85rem', fontWeight: 600 }}>Drag & drop JD document here, or click to browse</div>
            <div className="upload-zone-hint" style={{ fontSize: '0.7rem' }}>Supports PDF, DOCX — Max 50MB</div>
          </div>
        </div>

        {uploading && (
          <div style={{ marginTop: 20 }} className="fade-in">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>AI analysis in progress...</span>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#6366f1' }}>{progress}%</span>
            </div>
            <div className="progress-bar" style={{ marginBottom: 16 }}><div className="progress-fill" style={{ width: `${Math.min(100, progress)}%` }} /></div>
            
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
              {uploading && progress < 100 && <div className="pulse" style={{ width: 4, height: 10, background: '#6366f1', display: 'inline-block', marginLeft: 16 }} />}
            </div>
          </div>
        )}
      </div>

      {/* Extracted Checklist */}
      {tenders.length > 0 && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="section-header">
            <div className="section-title">Required Candidate Documents</div>
            <div className="section-subtitle">AI-identified mandatory files matching this job profile</div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 16 }}>
            {tenders[0].required_docs?.map((doc, idx) => (
              <div key={idx} className="badge badge-purple" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderRadius: 8, fontWeight: 600, fontSize: '0.75rem' }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#6366f1' }}></div>
                {doc}
              </div>
            ))}
            {(!tenders[0].required_docs || tenders[0].required_docs.length === 0) && (
              <div className="section-subtitle">No specific document constraints extracted.</div>
            )}
          </div>
        </div>
      )}

      {/* Existing Jobs */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="section-header">
          <div className="section-title">Active Job Openings</div>
        </div>
        <div className="table-container">
          <table>
            <thead><tr><th>Job ID</th><th>Position Title</th><th>Department</th><th>Salary Budget</th><th>Status</th></tr></thead>
            <tbody>
              {tenders.filter(t => !search || t.title.toLowerCase().includes(search.toLowerCase()) || t.id.toLowerCase().includes(search.toLowerCase()) || t.department.toLowerCase().includes(search.toLowerCase())).map(t => (
                <tr key={t.id}>
                  <td style={{ fontFamily: 'JetBrains Mono', fontSize: '0.75rem', color: '#6366f1' }}>{t.id}</td>
                  <td style={{ fontWeight: 600, color: '#f1f5f9' }}>{t.title}</td>
                  <td>{t.department}</td>
                  <td style={{ fontWeight: 600, color: '#10b981' }}>{t.value}</td>
                  <td><span className="badge badge-green">Evaluated</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Extracted Criteria */}
      <div className="card">
        <div className="section-header">
          <div className="section-title">Extracted Job Requirements</div>
        </div>

        <div className="tabs">
          {['all', 'technical skills', 'experience', 'education/certifications'].map(tab => (
            <button key={tab} className={`tab ${activeTab.toLowerCase() === tab.toLowerCase() ? 'active' : ''}`} onClick={() => setActiveTab(tab)}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        <div className="table-container">
          <table>
            <thead><tr><th>Category</th><th>Requirement Criterion</th><th>Target Level / Threshold</th><th>Impact</th><th>Source Location</th></tr></thead>
            <tbody>
              {filtered.map(c => {
                const isTech = c.category.toLowerCase().includes('tech');
                const isExp = c.category.toLowerCase().includes('exp');
                const badgeColor = isTech ? 'badge-cyan' : isExp ? 'badge-purple' : 'badge-yellow';
                return (
                  <tr key={c.id}>
                    <td><span className={`badge ${badgeColor}`}>{c.category}</span></td>
                    <td style={{ fontWeight: 600, color: '#f1f5f9' }}>{c.name}</td>
                    <td style={{ fontFamily: 'JetBrains Mono', fontSize: '0.8rem', color: '#818cf8' }}>{c.threshold}</td>
                    <td>
                      {c.mandatory ? (
                        <span className="badge badge-red" style={{ fontWeight: 800 }}>MANDATORY</span>
                      ) : (
                        <span className="badge badge-gray">PREFERRED</span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', color: '#94a3b8' }}>
                        <FileText size={12}/> Page {c.source_page}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', color: '#64748b', padding: 24 }}>No qualifications extracted for this category.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
