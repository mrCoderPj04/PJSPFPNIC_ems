'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Sidebar from '@/components/Sidebar';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Bell, Check, LogIn, LogOut, MessageSquare, Info, ShieldAlert } from 'lucide-react';

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
}

const API = process.env.NEXT_PUBLIC_API_URL || 'https://ems-backend-z3bv.onrender.com/api';

function NotificationsContent() {
  const { accessToken, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/');
    }
  }, [isAuthenticated, isLoading, router]);

  const fetchNotifications = useCallback(async () => {
    if (!accessToken) return;
    try {
      const res = await fetch(`${API}/notifications`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setPageLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (isAuthenticated && accessToken) {
      fetchNotifications();
    }
  }, [isAuthenticated, accessToken, fetchNotifications]);

  // Auto-refresh every 10 seconds
  useEffect(() => {
    if (!isAuthenticated || !accessToken) return;
    const interval = setInterval(fetchNotifications, 10000);
    return () => clearInterval(interval);
  }, [isAuthenticated, accessToken, fetchNotifications]);

  const handleMarkAllRead = async () => {
    if (!accessToken) return;
    try {
      const res = await fetch(`${API}/notifications/read-all`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        setNotifications(notifications.map(n => ({ ...n, isRead: true })));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'PUNCH_IN':
        return <LogIn size={18} className="text-green-400" />;
      case 'PUNCH_OUT':
        return <LogOut size={18} className="text-pink-400" />;
      case 'AUTO_PUNCH_OUT':
        return <ShieldAlert size={18} className="text-purple-400" />;
      case 'MESSAGE':
        return <MessageSquare size={18} className="text-cyan-400" />;
      default:
        return <Info size={18} className="text-cyan-300" />;
    }
  };

  if (isLoading || pageLoading) {
    return (
      <div className="flex min-h-screen bg-black text-white">
        <Sidebar />
        <main className="flex-1 pt-24 pb-28 px-6 md:px-8 flex items-center justify-center">
          <div className="text-cyan-400 animate-pulse">Loading notifications...</div>
        </main>
      </div>
    );
  }

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <div className="flex min-h-screen bg-black text-white">
      <Sidebar />

      <main className="flex-1 pt-24 pb-28 px-6 md:px-8 max-w-5xl mx-auto w-full">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 fade-in-up border-b border-cyan-500/20 pb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight flex items-center gap-3">
              <Bell className="text-cyan-400" />
              Notifications & <span className="gradient-text">EMS Updates</span>
            </h1>
            <p className="text-white/60 mt-1 text-sm">
              Punch In/Out logs, 15h auto-shift alerts, admin notifications, and messages.
            </p>
          </div>

          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="btn-primary py-2 px-4 text-xs font-bold flex items-center gap-2 self-start"
            >
              <Check size={16} />
              Mark All as Read ({unreadCount})
            </button>
          )}
        </div>

        {/* Notifications Feed */}
        <div className="space-y-4">
          {notifications.map((notif) => (
            <div
              key={notif.id}
              className={`glass-card p-5 border transition-all flex items-start gap-4 ${
                !notif.isRead
                  ? 'border-cyan-500/50 bg-cyan-500/05 shadow-[0_0_15px_rgba(0,240,255,0.2)]'
                  : 'border-white/10 opacity-80'
              }`}
            >
              <div className="p-2.5 rounded-xl bg-black border border-white/10 shrink-0">
                {getIcon(notif.type)}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-bold text-base text-cyan-300">{notif.title}</h3>
                  <span className="text-xs text-white/40">
                    {new Date(notif.createdAt).toLocaleString()}
                  </span>
                </div>
                <p className="text-sm text-white/80 mt-1">{notif.message}</p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="badge badge-cyan text-[10px]">{notif.type}</span>
                  {!notif.isRead && (
                    <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider">New</span>
                  )}
                </div>
              </div>
            </div>
          ))}

          {notifications.length === 0 && (
            <div className="glass-card p-12 text-center text-white/40 border-cyan-500/20">
              <Bell size={32} className="mx-auto mb-3 text-cyan-400/40" />
              <h3 className="text-lg font-bold text-white mb-1">No notifications yet</h3>
              <p className="text-xs">Punch actions, messages, and EMS updates will be listed here.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default function NotificationsPage() {
  return (
    <ProtectedRoute>
      <NotificationsContent />
    </ProtectedRoute>
  );
}
