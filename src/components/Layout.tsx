import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, FileText, Users, Receipt, BookOpen,
  Calculator, Bot, LogOut, Building2, ChevronRight,
  ChevronsUpDown, Settings, ClipboardList, Truck, Inbox
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import SystemMonitor from './SystemMonitor';

const navItems = [
  { to: '/',           icon: LayoutDashboard, label: 'Dashboard',    end: true },
  { to: '/chat',       icon: Bot,             label: 'AI Assistent', highlight: true },
  { to: '/inbox',      icon: Inbox,           label: 'Inkorg' },
  { to: '/invoices',       icon: FileText,      label: 'Fakturor' },
  { to: '/customers',      icon: Users,         label: 'Kunder' },
  { to: '/suppliers',      icon: Truck,         label: 'Leverantörer' },
  { to: '/expenses',       icon: Receipt,       label: 'Utgifter' },
  { to: '/accounting',     icon: BookOpen,       label: 'Bokföring' },
  { to: '/annual-report', icon: ClipboardList,  label: 'Bokslut' },
  { to: '/vat',           icon: Calculator,     label: 'Moms' },
  { to: '/settings',   icon: Settings,        label: 'Inställningar' },
];

export default function Layout() {
  const { user, logout, switchCompany } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [switcherOpen, setSwitcherOpen] = useState(false);

  const hasMultipleCompanies = (user?.companies?.length ?? 0) > 1 || user?.isSuperuser;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <>
    <SystemMonitor />
    <div className="flex h-screen overflow-hidden bg-surface-0">
      {/* Sidebar */}
      <aside className="w-60 flex-shrink-0 flex flex-col bg-surface-50 border-r border-white/5">
        {/* Logo */}
        <div className="h-16 flex items-center px-5 border-b border-white/5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
              <Building2 size={16} className="text-white" />
            </div>
            <span className="text-sm font-semibold text-white">ERP Studio</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 overflow-y-auto">
          <div className="space-y-0.5 px-2">
            {navItems.map(({ to, icon: Icon, label, end, highlight }) => {
              // /settings ska vara aktiv för alla /settings/* rutter
              const isSettingsActive = to === '/settings' && location.pathname.startsWith('/settings');
              return (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) => {
                  const active = isActive || isSettingsActive;
                  return `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group ${
                    active
                      ? 'bg-brand-600/20 text-brand-300 border-l-2 border-brand-500 pl-[10px]'
                      : highlight
                      ? 'text-brand-400 hover:bg-brand-600/10 hover:text-brand-300'
                      : 'text-white/50 hover:text-white hover:bg-white/5'
                  }`;
                }}
              >
                <Icon size={17} />
                <span>{label}</span>
                {highlight && (
                  <span className="ml-auto text-[10px] bg-brand-600/30 text-brand-300 px-1.5 py-0.5 rounded-full">
                    AI
                  </span>
                )}
              </NavLink>
              );
            })}
          </div>
        </nav>

        {/* User */}
        <div className="p-3 border-t border-white/5">
          <div className="flex items-center gap-3 p-2 rounded-lg">
            <div className="w-8 h-8 rounded-full bg-brand-600/30 flex items-center justify-center text-brand-300 text-xs font-semibold flex-shrink-0">
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-white truncate">{user?.name}</p>
              {hasMultipleCompanies ? (
                <div className="relative">
                  <button
                    onClick={() => setSwitcherOpen((o) => !o)}
                    className="flex items-center gap-1 text-[11px] text-white/40 hover:text-white/70 transition-colors"
                  >
                    <span className="truncate max-w-[100px]">{user?.company?.name}</span>
                    <ChevronsUpDown size={10} className="flex-shrink-0" />
                  </button>
                  {switcherOpen && (
                    <div className="absolute bottom-full left-0 mb-1 w-48 bg-surface-100 border border-white/10 rounded-xl shadow-xl overflow-hidden z-50">
                      {user?.companies?.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => { switchCompany(c.id); setSwitcherOpen(false); }}
                          className={`w-full flex items-center gap-2 px-3 py-2 text-left text-xs hover:bg-white/5 transition-colors ${
                            c.id === user.company?.id ? 'text-brand-300' : 'text-white/60'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${c.id === user.company?.id ? 'bg-brand-400' : 'bg-transparent'}`} />
                          <span className="truncate flex-1">{c.name}</span>
                          <span className="text-[10px] text-white/30 capitalize">{c.role}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-[11px] text-white/40 truncate">{user?.company?.name}</p>
              )}
            </div>
            <button onClick={handleLogout} className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-400/10 transition-colors" title="Logga ut">
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-16 flex-shrink-0 flex items-center justify-between px-6 bg-surface-50/50 border-b border-white/5">
          <div className="flex items-center gap-2 text-sm text-white/40">
            <Building2 size={14} />
            <ChevronRight size={12} />
            <span className="text-white/70">{user?.company?.name}</span>
          </div>
          <NavLink
            to="/chat"
            className="btn-primary text-xs px-3 py-1.5"
          >
            <Bot size={14} />
            Fråga AI
          </NavLink>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
    </>
  );
}
