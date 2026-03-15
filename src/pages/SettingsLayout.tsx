import { NavLink, Outlet } from 'react-router-dom';
import { Building2, Users, ShieldAlert, Layers, Archive } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const tabs = [
  { to: '/settings/company',    icon: Building2, label: 'Företag' },
  { to: '/settings/users',      icon: Users,     label: 'Användare' },
  { to: '/settings/dimensions', icon: Layers,    label: 'Dimensioner' },
  { to: '/settings/backup',     icon: Archive,   label: 'Säkerhetskopia' },
];

const superuserTab = { to: '/settings/superuser', icon: ShieldAlert, label: 'Superuser' };

export default function SettingsLayout() {
  const { user } = useAuth();

  const visibleTabs = user?.isSuperuser ? [...tabs, superuserTab] : tabs;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white">Inställningar</h1>
        <p className="text-sm text-white/40 mt-0.5">Hantera ditt företag, användare och plattform</p>
      </div>

      {/* Tab navigation */}
      <div className="flex gap-1 mb-6 border-b border-white/10 pb-0">
        {visibleTabs.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-all duration-150 border-b-2 -mb-px ${
                isActive
                  ? 'text-brand-300 border-brand-500 bg-brand-600/10'
                  : 'text-white/40 border-transparent hover:text-white/70 hover:bg-white/5'
              }`
            }
          >
            <Icon size={15} />
            {label}
            {label === 'Superuser' && (
              <span className="text-[10px] bg-red-600/30 text-red-300 px-1.5 py-0.5 rounded-full">SU</span>
            )}
          </NavLink>
        ))}
      </div>

      {/* Sub-page content */}
      <Outlet />
    </div>
  );
}
