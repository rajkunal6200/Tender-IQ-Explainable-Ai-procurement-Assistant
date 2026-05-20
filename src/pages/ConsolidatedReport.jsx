import { useState, useEffect } from 'react';
import { FileText, CheckCircle, XCircle, AlertTriangle, Download, ShieldCheck, Users, Search, Award } from 'lucide-react';
import { api } from '../utils/api';

export default function ConsolidatedReport() {
  const [tenders, setTenders] = useState([]);
  const [selectedTender, setSelectedTender] = useState('');
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isSigning, setIsSigning] = useState(false);
  const [comparingBidders, setComparingBidders] = useState([]);

  useEffect(() => {
    api.getTenders().then(data => {
      setTenders(data);
      if (data.length > 0) setSelectedTender(data[0].id);
      setLoading(false);
    });
  }, []);

  const fetchSummary = async () => {
    if (!selectedTender) return;
    const data = await api.getTenderSummary(selectedTender);
    setSummary(data);
  };

  useEffect(() => {
    fetchSummary();
  }, [selectedTender]);

  const handleSignOff = async () => {
    const officer = prompt("Enter Recruiter/HR Manager Name to Finalize rankings:");
    if (!officer) return;
    
    setIsSigning(true);
    try {
      await api.signTender(selectedTender, officer);
      await fetchSummary();
      alert("Candidate Shortlist signed off and finalized successfully.");
    } catch (error) {
      alert("Shortlist approval failed.");
    } finally {
      setIsSigning(false);
    }
  };

  const toggleComparison = (bidderId) => {
    setComparingBidders(prev => 
      prev.includes(bidderId) ? prev.filter(id => id !== bidderId) : [...prev, bidderId].slice(-2)
    );
  };

  if (loading) return <div className="fade-in" style={{ padding: 40 }}>Loading Job Rankings...</div>;

  return (
    <div className="fade-in">
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div className="section-title">Candidate Rankings Comparison Matrix</div>
            <div className="section-subtitle">Side-by-side qualifications matching and official candidate ranking dashboard</div>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <select 
              className="filter-select" 
              value={selectedTender} 
              onChange={e => setSelectedTender(e.target.value)}
              style={{ fontSize: '0.85rem', padding: '8px 12px', minWidth: 200 }}
            >
              {tenders.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
            {summary?.is_signed ? (
              <div className="badge badge-green" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8, borderRadius: 6, fontWeight: 600 }}>
                <ShieldCheck size={16}/> SHORTLIST APPROVED BY {summary.signed_by.toUpperCase()}
              </div>
            ) : (
              <button className="btn btn-primary" onClick={handleSignOff} disabled={isSigning} style={{ padding: '8px 16px', fontSize: '0.85rem' }}>
                <ShieldCheck size={16}/> Approve Shortlist
              </button>
            )}
          </div>
        </div>
      </div>

      {summary && (
        <>
          {/* Comparison Overlay */}
          {comparingBidders.length === 2 && (
            <div className="card" style={{ marginBottom: 24, border: '2px solid #6366f1', background: 'rgba(99, 102, 241, 0.04)', borderRadius: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18, alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Award size={18} style={{ color: '#818cf8' }}/>
                  <div className="section-title" style={{ fontSize: '1rem' }}>Candidate Side-by-Side Comparison</div>
                </div>
                <button className="btn btn-sm btn-secondary" onClick={() => setComparingBidders([])} style={{ fontSize: '0.75rem' }}>Close Comparison</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
                {comparingBidders.map(id => {
                  const bidder = summary.bidders.find(b => b.bidder_id === id);
                  if (!bidder) return null;
                  return (
                    <div key={id} className="card" style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.04)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <div style={{ fontWeight: 700, fontSize: '1.1rem', color: '#f8fafc' }}>{bidder.name}</div>
                        <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#6366f1' }}>{Math.round(bidder.match_score)}%</div>
                      </div>
                      
                      <div style={{ marginTop: 16 }}>
                        <div style={{ fontSize: '0.65rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.05em', marginBottom: 8, paddingBottom: 4, borderBottom: '1px solid rgba(255,255,255,0.05)' }}>Requirement Match Verdicts</div>
                        {summary.criteria.map(c => {
                          const v = bidder.verdicts[c.id] || 'pending';
                          const isElig = v === 'eligible';
                          const isInelig = v === 'ineligible';
                          const badge = isElig ? 'badge-green' : isInelig ? 'badge-red' : 'badge-yellow';
                          const label = isElig ? 'Matched' : isInelig ? 'Missing' : 'Borderline';
                          return (
                            <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.03)', alignItems: 'center' }}>
                              <span style={{ fontSize: '0.8rem', color: '#94a3b8', maxWidth: '70%', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{c.name}</span>
                              <span className={`badge ${badge}`} style={{ fontSize: '0.65rem', padding: '2px 6px' }}>{label}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="card print-optimized" style={{ padding: '24px 28px' }}>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th style={{ minWidth: 220 }}>Candidate Name</th>
                    <th>ATS Score</th>
                    {summary.criteria.map(c => (
                      <th key={c.id} style={{ textAlign: 'center', fontSize: '0.75rem' }}>
                        {c.name}
                        {c.mandatory && <div style={{ color: '#ef4444', fontSize: '0.55rem', fontWeight: 800, marginTop: 2 }}>MANDATORY</div>}
                      </th>
                    ))}
                    <th>Compare</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.bidders
                    .sort((a, b) => b.match_score - a.match_score)
                    .map(bidder => (
                      <tr key={bidder.bidder_id} className={comparingBidders.includes(bidder.bidder_id) ? 'active-row' : ''}>
                        <td style={{ fontWeight: 600, color: '#f1f5f9' }}>
                          <span style={{ fontSize: '0.9rem' }}>{bidder.name}</span>
                          {bidder.is_disqualified && (
                            <div style={{ fontSize: '0.65rem', color: '#f87171', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(239, 68, 68, 0.06)', padding: '4px 8px', borderRadius: 4, width: 'fit-content', border: '1px solid rgba(239, 68, 68, 0.1)' }}>
                              <XCircle size={10}/> Missing Skill: {bidder.disqualification_reason.replace("Failed mandatory criterion:", "").trim()}
                            </div>
                          )}
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ width: 40, fontSize: '0.8rem', fontWeight: 800, color: bidder.match_score >= 80 ? '#10b981' : bidder.match_score >= 60 ? '#f59e0b' : '#ef4444' }}>{Math.round(bidder.match_score)}%</div>
                            <div className="progress-bar" style={{ width: 70, height: 6 }}>
                              <div 
                                className="progress-fill" 
                                style={{ 
                                  width: `${bidder.match_score}%`,
                                  background: bidder.match_score >= 80 ? '#10b981' : bidder.match_score >= 60 ? '#f59e0b' : '#ef4444' 
                                }} 
                              />
                            </div>
                          </div>
                        </td>
                        {summary.criteria.map(c => {
                          const verdict = bidder.verdicts[c.id];
                          return (
                            <td key={c.id} style={{ textAlign: 'center' }}>
                              {verdict === 'eligible' ? (
                                <CheckCircle size={16} style={{ color: '#10b981', display: 'inline-block' }} />
                              ) : verdict === 'ineligible' ? (
                                <XCircle size={16} style={{ color: '#ef4444', display: 'inline-block' }} />
                              ) : (
                                <AlertTriangle size={16} style={{ color: '#f59e0b', display: 'inline-block' }} />
                              )}
                            </td>
                          );
                        })}
                        <td>
                          <button 
                            className={`btn btn-icon ${comparingBidders.includes(bidder.bidder_id) ? 'active' : ''}`}
                            onClick={() => toggleComparison(bidder.bidder_id)}
                            style={{ 
                              width: 32, 
                              height: 32, 
                              display: 'flex', 
                              alignItems: 'center', 
                              justifyContent: 'center', 
                              background: comparingBidders.includes(bidder.bidder_id) ? '#6366f1' : 'rgba(255,255,255,0.02)',
                              border: '1px solid rgba(255,255,255,0.05)',
                              borderRadius: 6
                            }}
                            title="Select for Comparison"
                          >
                            <Search size={12} style={{ color: comparingBidders.includes(bidder.bidder_id) ? '#fff' : '#cbd5e1' }} />
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            
            <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
               <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  {summary.is_signed && (
                    <span>This candidate shortlist ranking was finalized and approved by <b>{summary.signed_by}</b> on {new Date().toLocaleDateString()}.</span>
                  )}
               </div>
              <button className="btn btn-primary" onClick={() => window.print()} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Download size={15}/> Export Shortlist (PDF)
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
