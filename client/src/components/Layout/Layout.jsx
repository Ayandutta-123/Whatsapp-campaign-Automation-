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
      <div className="fixed top-3 right-3 z-40 lg:top-6 lg:right-6">
        <NotificationBell />
      </div>
      <main className="lg:ml-64 p-4 sm:p-6 lg:p-8 pt-16 lg:pt-8 min-h-screen">
        <Outlet context={{ openMobileNav: () => setMobileNavOpen(true) }} />
      </main>
    </div>
  );
}
