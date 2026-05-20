import { useState, useEffect, useMemo } from 'react';
import { CheckCircle, XCircle, AlertTriangle, FileText, ChevronDown, ChevronUp, ThumbsUp, ThumbsDown, Edit3, Download, Award, Briefcase, GraduationCap, Loader } from 'lucide-react';
import { api } from '../utils/api';
import { downloadBlob, generateEvaluationReport } from '../utils/downloadUtils';

export default function Evaluation({ search, preSelectedBidderId }) {
  const [bidders, setBidders] = useState([]);
  const [selectedBidder, setSelectedBidder] = useState(preSelectedBidderId || '');
  const [evaluations, setEvaluations] = useState([]);
  const [criteria, setCriteria] = useState([]);
  const [loading, setLoading] = useState(true);
  const [evalLoading, setEvalLoading] = useState(false);
  const [expandedCard, setExpandedCard] = useState(null);
  const [overrides, setOverrides] = useState({});

  useEffect(() => {
    const fetchBidders = async () => {
      try {
        const data = await api.getBidders();
        const parsedBidders = data.filter(b => b.status === 'parsed');
        setBidders(parsedBidders);
        if (preSelectedBidderId) {
          setSelectedBidder(preSelectedBidderId);
        } else if (parsedBidders.length > 0 && !selectedBidder) {
          setSelectedBidder(parsedBidders[0].id);
        }
      } catch (error) {
        console.error("Error fetching candidates:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchBidders();
  }, [preSelectedBidderId]);

  // Fetch evaluations and matching job criteria dynamically
  useEffect(() => {
    if (!selectedBidder) return;
    const fetchEvalsAndCriteria = async () => {
      setEvalLoading(true);
      try {
        const data = await api.getEvaluations(selectedBidder);
        setEvaluations(data);
        setOverrides({});

        // Fetch corresponding criteria for the candidate's applied job
        const candidate = bidders.find(b => b.id === selectedBidder);
        if (candidate) {
          const critData = await api.getCriteria(candidate.tender_id);
          setCriteria(critData);
        }
      } catch (error) {
        console.error("Error fetching evaluations / criteria:", error);
      } finally {
        setEvalLoading(false);
      }
    };
    fetchEvalsAndCriteria();
  }, [selectedBidder, bidders]);

  const getVerdict = (evalItem) => overrides[evalItem.id] || evalItem.verdict;

  const stats = useMemo(() => {
    const counts = { eligible: 0, review: 0, ineligible: 0 };
    evaluations.forEach(e => {
      const v = getVerdict(e);
      if (counts[v] !== undefined) counts[v]++;
    });
    return counts;
  }, [evaluations, overrides]);

  const handleOverride = async (evalId, newVerdict) => {
    try {
      setOverrides(prev => ({ ...prev, [evalId]: newVerdict }));
      await api.updateEvaluation(evalId, newVerdict);
      
      // Refresh candidate list in background to sync overall scores
      const updatedBidders = await api.getBidders();
      setBidders(updatedBidders.filter(b => b.status === 'parsed'));
    } catch (error) {
      console.error("Failed to save override:", error);
    }
  };

  const handleDownloadReport = () => {
    const bidder = bidders.find(b => b.id === selectedBidder);
    if (!bidder) return;
    const report = generateEvaluationReport(bidder, evaluations);
    downloadBlob(report, `Resume_Evaluator_Report_${bidder.name.replace(/\s+/g, '_')}.txt`, 'text/plain');
  };

  if (loading) return <div className="fade-in" style={{ display: 'flex', justifyContent: 'center', padding: '100px' }}>Loading ATS Evaluator...</div>;

  const selectedCandidateObj = bidders.find(b => b.id === selectedBidder);

  return (
    <div className="fade-in">
      {/* Selector and Summary Grid */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <select 
              className="filter-select" 
              value={selectedBidder} 
              onChange={e => setSelectedBidder(e.target.value)} 
              style={{ fontSize: '0.9rem', fontWeight: 600, minWidth: 200 }}
            >
              {bidders.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
            {selectedCandidateObj && (
              <span className="badge badge-purple" style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                Job: {selectedCandidateObj.tender_id}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <button className="btn btn-primary" onClick={handleDownloadReport} disabled={!selectedBidder}>
              <Download size={15}/> Export ATS Report
            </button>
            <div className="summary-box eligible" style={{ minWidth: 90 }}>
              <div className="count">{stats.eligible}</div>
              <div className="label">Fully Matched</div>
            </div>
            <div className="summary-box review" style={{ minWidth: 90 }}>
              <div className="count">{stats.review}</div>
              <div className="label">Borderline</div>
            </div>
            <div className="summary-box ineligible" style={{ minWidth: 90 }}>
              <div className="count">{stats.ineligible}</div>
              <div className="label">Missing Skill</div>
            </div>
          </div>
        </div>
      </div>

      {/* Document Checklist */}
      {selectedCandidateObj && selectedCandidateObj.checklist_status && (
        <div className="card" style={{ marginBottom: 24, border: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="section-header">
            <div className="section-title" style={{ fontSize: '0.95rem' }}>Candidate Document Checklist</div>
            <div className="section-subtitle">Verifying submission completeness for matching requirements</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12, marginTop: 16 }}>
            {Object.entries(selectedCandidateObj.checklist_status).map(([doc, status], idx) => (
              <div key={idx} style={{ 
                padding: '12px 16px', 
                borderRadius: '8px', 
                background: 'rgba(255,255,255,0.02)', 
                border: '1px solid rgba(255,255,255,0.05)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <FileText size={14} style={{ color: '#6366f1' }} />
                  <span style={{ fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 600 }}>{doc}</span>
                </div>
                {status === 'found' ? (
                  <span className="badge badge-green" style={{ fontSize: '0.6rem', padding: '2px 6px' }}>Received</span>
                ) : (
                  <span className="badge badge-red" style={{ fontSize: '0.6rem', padding: '2px 6px' }}>Missing</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Evaluation Results */}
      {evalLoading ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
          <Loader className="spin" size={24} style={{ marginBottom: 12, color: '#6366f1' }}/>
          <div>Analyzing qualifications for {selectedCandidateObj?.name}...</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {evaluations.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>No requirements evaluation profiles parsed for this applicant.</div>
          ) : (
            evaluations.map(evalItem => {
              const verdict = getVerdict(evalItem);
              const isExpanded = expandedCard === evalItem.id;

              // Dynamically map requirements description from database criteria
              const criterion = criteria.find(c => c.id === evalItem.criterion_id);
              const criterionName = criterion ? criterion.name : `${evalItem.criterion_id} Requirement`;
              const criterionCategory = criterion ? criterion.category : "General";
              const targetThreshold = criterion ? criterion.threshold : "N/A";

              // Category icons
              const CategoryIcon = criterionCategory.toLowerCase().includes('tech') 
                ? Award 
                : criterionCategory.toLowerCase().includes('exp') 
                ? Briefcase 
                : GraduationCap;

              return (
                <div key={evalItem.id} className={`criterion-card ${verdict === 'eligible' ? 'pass' : verdict === 'ineligible' ? 'fail' : 'review'}`}>
                  <div className="criterion-header" onClick={() => setExpandedCard(isExpanded ? null : evalItem.id)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div className="stat-icon purple" style={{ width: 34, height: 34, borderRadius: 8, background: 'rgba(99, 102, 241, 0.08)' }}>
                        <CategoryIcon size={16} style={{ color: '#818cf8' }}/>
                      </div>
                      <div>
                        <div className="criterion-name">{criterionName}</div>
                        <div className="criterion-category">{criterionCategory} • {evalItem.match_type === 'direct' ? 'Automated Match' : 'Semantic Mapping'}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                      <div className="confidence">
                        <span className={`confidence-dot ${evalItem.confidence}`} />
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'capitalize' }}>{evalItem.confidence} Confidence</span>
                      </div>
                      <span className={`badge ${verdict === 'eligible' ? 'badge-green' : verdict === 'review' ? 'badge-yellow' : 'badge-red'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        {verdict === 'eligible' ? <><CheckCircle size={10}/> Matched</> : verdict === 'review' ? <><AlertTriangle size={10}/> Borderline</> : <><XCircle size={10}/> Missing Skill</>}
                      </span>
                      {isExpanded ? <ChevronUp size={16} style={{ color: '#64748b' }}/> : <ChevronDown size={16} style={{ color: '#64748b' }}/>}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="criterion-body slide-up" style={{ padding: '20px 24px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 20 }}>
                        <div className="criterion-field">
                          <label style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>Required Threshold</label>
                          <span style={{ color: '#818cf8', fontWeight: 700, fontSize: '0.9rem', marginTop: 4, display: 'block' }}>{targetThreshold}</span>
                        </div>
                        <div className="criterion-field">
                          <label style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em' }}>Extracted Candidate Value</label>
                          <span style={{ color: '#f1f5f9', fontWeight: 700, fontSize: '0.9rem', marginTop: 4, display: 'block' }}>{evalItem.extracted_value}</span>
                        </div>
                      </div>
                      
                      <div className="criterion-field" style={{ marginBottom: 20 }}>
                        <label style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.05em', marginBottom: 6, display: 'block' }}>AI Reasoning & Match Evidence</label>
                        <p style={{ fontSize: '0.85rem', color: '#cbd5e1', lineHeight: '1.6', background: 'rgba(0,0,0,0.2)', padding: 14, borderRadius: 8, border: '1px solid rgba(255,255,255,0.04)', margin: 0 }}>
                          {evalItem.reasoning}
                        </p>
                        
                        {evalItem.evidence_snippet && (
                          <div style={{ marginTop: 12, fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic', background: 'rgba(99, 102, 241, 0.04)', padding: '10px 14px', borderLeft: '3px solid #6366f1', borderRadius: '0 8px 8px 0' }}>
                            " {evalItem.evidence_snippet} "
                          </div>
                        )}

                        {/* Suggestions / Improvements Block (Shown for all evaluations containing action_required info) */}
                        {evalItem.action_required && (
                          <div style={{ 
                            marginTop: 14, 
                            background: verdict === 'ineligible' ? 'rgba(239, 68, 68, 0.08)' : verdict === 'review' ? 'rgba(245, 158, 11, 0.08)' : 'rgba(16, 185, 129, 0.08)', 
                            border: `1px dashed ${verdict === 'ineligible' ? '#ef4444' : verdict === 'review' ? '#f59e0b' : '#10b981'}`, 
                            padding: '12px 14px', 
                            borderRadius: 8, 
                            color: verdict === 'ineligible' ? '#f87171' : verdict === 'review' ? '#fbbf24' : '#34d399', 
                            fontSize: '0.8rem', 
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8
                          }}>
                            <AlertTriangle size={15} style={{ flexShrink: 0 }}/> 
                            <div>
                              <strong style={{ textTransform: 'uppercase', marginRight: 4 }}>ATS Suggestion:</strong> 
                              {evalItem.action_required}
                            </div>
                          </div>
                        )}

                        <div style={{ marginTop: 14, fontSize: '0.75rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: 12 }}>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <FileText size={12}/> File: {evalItem.source_document || 'Resume'}
                          </span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            Page {evalItem.source_page}
                          </span>
                        </div>
                      </div>

                      <div className="evaluation-actions" style={{ background: 'rgba(255,255,255,0.01)', padding: 14, borderRadius: 8, border: '1px solid rgba(255,255,255,0.03)' }}>
                        <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase', marginBottom: 10, letterSpacing: '0.05em' }}>Recruiter Manual Override</div>
                        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                          <button 
                            className={`btn btn-sm ${verdict === 'eligible' ? 'btn-success' : 'btn-secondary'}`}
                            onClick={(e) => { e.stopPropagation(); handleOverride(evalItem.id, 'eligible'); }}
                            style={{ fontSize: '0.75rem', padding: '6px 12px' }}
                          >
                            <ThumbsUp size={12}/> Approve Match
                          </button>
                          <button 
                            className={`btn btn-sm ${verdict === 'review' ? 'btn-warning' : 'btn-secondary'}`}
                            onClick={(e) => { e.stopPropagation(); handleOverride(evalItem.id, 'review'); }}
                            style={{ fontSize: '0.75rem', padding: '6px 12px' }}
                          >
                            <AlertTriangle size={12}/> Flag as Borderline
                          </button>
                          <button 
                            className={`btn btn-sm ${verdict === 'ineligible' ? 'btn-danger' : 'btn-secondary'}`}
                            onClick={(e) => { e.stopPropagation(); handleOverride(evalItem.id, 'ineligible'); }}
                            style={{ fontSize: '0.75rem', padding: '6px 12px' }}
                          >
                            <ThumbsDown size={12}/> Reject Match
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
