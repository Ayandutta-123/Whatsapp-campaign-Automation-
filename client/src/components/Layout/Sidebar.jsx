import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  FileText,
  Megaphone,
  ScrollText,
  Settings,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const links = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/contacts', icon: Users, label: 'Contacts' },
  { to: '/templates', icon: FileText, label: 'Templates' },
  { to: '/campaigns', icon: Megaphone, label: 'Campaigns' },
  { to: '/logs', icon: ScrollText, label: 'Message Logs' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function Sidebar({ mobileOpen, onClose, onOpen }) {
  const { logout, requireLogin } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    onClose?.();
    navigate('/login');
  };

  const nav = (
    <>
      <div className="px-6 py-5 border-b border-white/10 flex items-center justify-between">
        <div>
          <h1 className="font-display text-lg font-bold tracking-tight leading-tight">
            WhatsApp Campaign
          </h1>
          <p className="text-xs text-white/55 mt-0.5">Automation</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="lg:hidden p-2 -mr-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          aria-label="Close menu"
        >
          <X size={20} />
        </button>
      </div>
      <nav className="flex-1 py-4 overflow-y-auto">
        {links.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onClose}
            className={({ isActive }) =>
              `ht-nav-link flex items-center gap-3 px-6 py-3 text-sm ${
                isActive
                  ? 'ht-nav-link-active bg-white/10 text-white'
                  : 'text-white/65 hover:text-white hover:bg-white/5'
              }`
            }
          >
            <Icon size={18} />
            {label}
          </NavLink>
        ))}
      </nav>
      {requireLogin && (
        <button
          onClick={handleLogout}
          className="ht-btn flex items-center gap-3 px-6 py-4 text-sm text-white/70 hover:text-white border-t border-white/10 w-full"
        >
          <LogOut size={18} />
          Logout
        </button>
      )}
    </>
  );

  return (
    <>
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 h-14 bg-sidebar/95 backdrop-blur-md text-white flex items-center gap-3 px-4 border-b border-white/10">
        <button
          type="button"
          onClick={onOpen}
          className="p-2 -ml-1 rounded-lg hover:bg-white/10 transition-colors"
          aria-label="Open menu"
        >
          <Menu size={22} />
        </button>
        <div className="min-w-0">
          <p className="font-display font-semibold text-sm truncate">WhatsApp Campaign</p>
          <p className="text-[10px] text-white/55 truncate">Automation</p>
        </div>
      </div>

      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed left-0 top-0 h-full w-64 bg-sidebar text-white flex flex-col z-50
          shadow-[8px_0_40px_rgba(10,3,73,0.35)]
          transform transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0 lg:z-40`}
      >
        {nav}
      </aside>
    </>
  );
}
