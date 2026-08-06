import { useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import NotificationBell from './NotificationBell';
import { useAuth } from '../../context/AuthContext';

export default function Layout() {
  const { user, loading, requireLogin } = useAuth();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (requireLogin && !user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-page">
      <Sidebar
        mobileOpen={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
        onOpen={() => setMobileNavOpen(true)}
      />
      {/* Below mobile top bar (h-14); clear of sidebar on desktop */}
      <div className="fixed top-[3.75rem] right-3 z-50 lg:top-6 lg:right-6">
        <NotificationBell />
      </div>
      <main className="lg:ml-64 min-h-screen min-w-0">
        <div className="ht-page-shell p-4 sm:p-6 lg:p-8 xl:p-10 pt-16 lg:pt-8">
          <Outlet context={{ openMobileNav: () => setMobileNavOpen(true) }} />
        </div>
      </main>
    </div>
  );
}
