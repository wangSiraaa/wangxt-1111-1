import { Routes, Route, Link, useLocation } from 'react-router-dom';
import RegisterPage from './pages/RegisterPage';
import ConfirmPage from './pages/ConfirmPage';
import GuardPage from './pages/GuardPage';
import RecordsPage from './pages/RecordsPage';
import ChangeVisitPage from './pages/ChangeVisitPage';
import AppealPage from './pages/AppealPage';
import AppealAuditPage from './pages/AppealAuditPage';
import RecordDetailPage from './pages/RecordDetailPage';
import './styles/global.css';

function App() {
  const location = useLocation();

  const navItems = [
    { path: '/register', label: '前台登记', icon: '📝' },
    { path: '/change', label: '变更重审', icon: '🔄' },
    { path: '/confirm', label: '员工确认', icon: '✅' },
    { path: '/guard', label: '保安核验', icon: '🚗' },
    { path: '/records', label: '通行记录', icon: '📋' },
    { path: '/appeal', label: '黑名单申诉', icon: '📢' },
    { path: '/appeal-audit', label: '申诉审核', icon: '⚖️' },
  ];

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title">🏢 园区访客车辆通行管理系统</h1>
        <nav className="app-nav">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`nav-link ${location.pathname === item.path ? 'active' : ''}`}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
      </header>
      <main className="app-main">
        <Routes>
          <Route path="/" element={<RegisterPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/change" element={<ChangeVisitPage />} />
          <Route path="/change/:originalId" element={<ChangeVisitPage />} />
          <Route path="/confirm" element={<ConfirmPage />} />
          <Route path="/guard" element={<GuardPage />} />
          <Route path="/records" element={<RecordsPage />} />
          <Route path="/records/:id" element={<RecordDetailPage />} />
          <Route path="/appeal" element={<AppealPage />} />
          <Route path="/appeal-audit" element={<AppealAuditPage />} />
        </Routes>
      </main>
      <footer className="app-footer">
        <p>© 2024 园区访客车辆通行管理系统</p>
      </footer>
    </div>
  );
}

export default App;
