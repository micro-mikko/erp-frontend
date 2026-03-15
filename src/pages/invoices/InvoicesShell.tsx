import { NavLink, Outlet } from 'react-router-dom';
import { FileText, Repeat } from 'lucide-react';

export default function InvoicesShell() {
  return (
    <div className="flex flex-col min-h-full">
      {/* Sub-nav tab-bar — sticks to top while content scrolls */}
      <div className="flex items-center gap-1 px-6 pt-5 pb-0 border-b border-white/5 sticky top-0 z-10 bg-surface-0">
        <NavLink
          to="/invoices"
          end
          className={({ isActive }) =>
            `flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              isActive
                ? 'border-brand-500 text-white'
                : 'border-transparent text-white/40 hover:text-white/70'
            }`
          }
        >
          <FileText size={15} /> Fakturor
        </NavLink>
        <NavLink
          to="/invoices/subscriptions"
          className={({ isActive }) =>
            `flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
              isActive
                ? 'border-brand-500 text-white'
                : 'border-transparent text-white/40 hover:text-white/70'
            }`
          }
        >
          <Repeat size={15} /> Prenumerationer
        </NavLink>
      </div>

      {/* Page content */}
      <div className="flex-1">
        <Outlet />
      </div>
    </div>
  );
}
