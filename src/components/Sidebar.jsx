import { FileText, Users, CheckSquare, Clock, LayoutDashboard, Upload, UserCheck, ClipboardCheck, Shield } from 'lucide-react';

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'tenders', label: 'Job Descriptions', icon: Upload },
  { id: 'bidders', label: 'Candidates & Resumes', icon: Users },
  { id: 'evaluation', label: 'Resume Evaluation', icon: ClipboardCheck },
  { id: 'consolidated', label: 'Candidate Rankings', icon: FileText },
  { id: 'audit', label: 'Activity Log', icon: Clock },
];

export default function Sidebar({ activePage, onNavigate }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="logo">
          <div className="logo-icon">
             <Shield size={28} color="#6366f1" />
          </div>
          <div className="logo-text">
            <span className="logo-name">Resume Evaluator</span>
            <span className="logo-tagline">AI Applicant Tracking</span>
          </div>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section-title">Main Menu</div>
        {navItems.map(item => (
          <button
            key={item.id}
            className={`nav-item ${activePage === item.id ? 'active' : ''}`}
            onClick={() => onNavigate(item.id)}
          >
            <item.icon size={18} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="user-profile">
          <div className="user-avatar">HR</div>
          <div className="user-info">
            <span className="user-name">HR Officer</span>
            <span className="user-role">Recruiting Committee</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
