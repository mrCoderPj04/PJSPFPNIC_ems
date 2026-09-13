'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Sidebar from '@/components/Sidebar';
import ProtectedRoute from '@/components/ProtectedRoute';
import {
  Users, Clock, Activity, UserCheck, Bell, MessageSquare, ShieldAlert
} from 'lucide-react';
import { useSocket } from '@/contexts/SocketContext';

interface DashboardStats {
  stats: {
    totalEmployees: number;
    attendanceToday: number;
  };
  recentActivity: any[];
  departments: { name: string; employeeCount: number }[];
}

const API = process.env.NEXT_PUBLIC_API_URL || 'https://ems-backend-z3bv.onrender.com/api';

function getGreeting(isPunchedOut: boolean): string {
  if (isPunchedOut) return "Good Night";
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  if (hour >= 17 && hour < 22) return "Good evening";
  return "Good Night";
}

function DashboardContent() {
  const { user, accessToken, isAuthenticated, isLoading, refreshUser } = useAuth();
  const [data, setData] = useState<DashboardStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isPunchedOutToday, setIsPunchedOutToday] = useState(false);
  const { socket } = useSocket();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/');
    }
    if (!isLoading && isAuthenticated && user?.isFirstLogin) {
      router.replace('/change-password');
    }
  }, [isAuthenticated, isLoading, user, router]);

  useEffect(() => {
    if (!isAuthenticated || !accessToken) return;

    // Refresh user data so salary/profile changes by admin are always current
    refreshUser();

    // Fetch notifications
    fetch(`${API}/notifications`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r) => r.ok && r.json())
      .then((d) => setNotifications(d.notifications || []))
      .catch(console.error);

    // Fetch attendance to determine punch-out status & overtime metrics
    fetch(`${API}/attendance`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((r) => r.ok && r.json())
      .then((d) => {
        if (Array.isArray(d)) {
          setAttendanceRecords(d);
          const todayStr = new Date().toDateString();
          const todayShift = d.find((r: any) => new Date(r.date).toDateString() === todayStr);
          if (todayShift && todayShift.logoutTime) {
            setIsPunchedOutToday(true);
          }
        }
      })
      .catch(console.error);

    if (user?.role === 'ADMIN') {
      fetch(`${API}/dashboard`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
        .then((r) => r.ok && r.json())
        .then((d) => setData(d))
        .catch(console.error)
        .finally(() => setStatsLoading(false));
    } else {
      setStatsLoading(false);
    }
  }, [isAuthenticated, accessToken, user, refreshUser]);

  // Real-time socket listeners for live updates
  useEffect(() => {
    if (!socket || !accessToken) return;

    const handleNotification = (notification: any) => {
      setNotifications(prev => [notification, ...prev]);
    };

    const handleAttendanceUpdate = () => {
      fetch(`${API}/attendance`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
        .then(r => r.ok && r.json())
        .then(d => {
          if (Array.isArray(d)) {
            setAttendanceRecords(d);
            const todayStr = new Date().toDateString();
            const todayShift = d.find((r: any) => new Date(r.date).toDateString() === todayStr);
            setIsPunchedOutToday(!!(todayShift && todayShift.logoutTime));
          }
        })
        .catch(console.error);
    };

    const handleEmployeeUpdate = () => {
      refreshUser();
      if (user?.role === 'ADMIN') {
        fetch(`${API}/dashboard`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        })
          .then(r => r.ok && r.json())
          .then(d => setData(d))
          .catch(console.error);
      }
    };

    socket.on('notification:new', handleNotification);
    socket.on('attendance:update', handleAttendanceUpdate);
    socket.on('employee:update', handleEmployeeUpdate);

    return () => {
      socket.off('notification:new', handleNotification);
      socket.off('attendance:update', handleAttendanceUpdate);
      socket.off('employee:update', handleEmployeeUpdate);
    };
  }, [socket, accessToken, user, refreshUser]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-cyan-400 animate-pulse">Loading PJSOFONIC EMS...</div>
      </div>
    );
  }

  const isAdmin = user?.role === 'ADMIN';
  const greetingText = getGreeting(isPunchedOutToday);

  // Compute total shift & overtime hours
  const totalShiftHours = attendanceRecords.reduce((sum, r) => sum + (r.regularHours || Math.min(r.totalHours || 0, 8)), 0);
  const totalOvertimeHours = attendanceRecords.reduce((sum, r) => sum + (r.overtimeHours || Math.max(0, (r.totalHours || 0) - 8)), 0);

  return (
    <div className="flex min-h-screen bg-black text-white">
      <Sidebar />

      <main className="flex-1 pt-24 pb-28 px-6 md:px-8 max-w-7xl mx-auto w-full">
        {/* Dynamic Greeting Header */}
        <div className="mb-8 fade-in-up flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-cyan-500/20 pb-6">
          <div>
            <h1 className="text-2xl md:text-4xl font-extrabold tracking-tight">
              {greetingText}, <span className="gradient-text">{user?.username}</span> 👋
            </h1>
            <p className="text-white/60 mt-1 text-sm">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              {' · '}
              <span className={`badge ${isAdmin ? 'badge-purple' : 'badge-cyan'}`}>{user?.role}</span>
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/dashboard/notifications')}
              className="flex items-center gap-2 bg-black border border-cyan-500/40 hover:border-cyan-400 hover:shadow-[0_0_15px_rgba(0,240,255,0.4)] px-4 py-2 rounded-xl text-sm font-semibold text-cyan-300 transition-all"
            >
              <Bell size={16} />
              Notifications ({notifications.filter(n => !n.isRead).length})
            </button>
            <button
              onClick={() => router.push('/dashboard/chat')}
              className="btn-primary flex items-center gap-2 py-2 px-4 text-sm font-bold"
            >
              <MessageSquare size={16} />
              Messages
            </button>
          </div>
        </div>

        {/* Shift & Overtime Metrics Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <div className="stat-card">
            <div className="w-10 h-10 rounded-xl mb-3 flex items-center justify-center bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
              <Clock size={22} />
            </div>
            <div className="text-2xl font-extrabold text-cyan-400 mb-0.5">{totalShiftHours.toFixed(1)} hrs</div>
            <div className="text-xs text-white/70 font-semibold uppercase tracking-wider">Standard Shift (8h/Day)</div>
            <div className="text-[10px] text-cyan-400/60 mt-1">Regular Working Hours</div>
          </div>

          <div className="stat-card">
            <div className="w-10 h-10 rounded-xl mb-3 flex items-center justify-center bg-purple-500/20 text-purple-300 border border-purple-500/40">
              <Activity size={22} />
            </div>
            <div className="text-2xl font-extrabold text-purple-400 mb-0.5">{totalOvertimeHours.toFixed(1)} hrs</div>
            <div className="text-xs text-white/70 font-semibold uppercase tracking-wider">Overtime Worked</div>
            <div className="text-[10px] text-purple-400/60 mt-1">Calculated beyond 8h/day</div>
          </div>

          <div className="stat-card">
            <div className="w-10 h-10 rounded-xl mb-3 flex items-center justify-center bg-yellow-500/20 text-yellow-300 border border-yellow-500/40">
              <Clock size={22} />
            </div>
            <div className="text-2xl font-extrabold text-yellow-400 mb-0.5">
              {(totalShiftHours + totalOvertimeHours).toFixed(1)} hrs
            </div>
            <div className="text-xs text-white/70 font-semibold uppercase tracking-wider">Total Working Hours</div>
            <div className="text-[10px] text-yellow-400/60 mt-1">Shift + Overtime combined</div>
          </div>

          {isAdmin ? (
            <div className="stat-card">
              <div className="w-10 h-10 rounded-xl mb-3 flex items-center justify-center bg-green-500/20 text-green-300 border border-green-500/40">
                <Users size={22} />
              </div>
              <div className="text-2xl font-extrabold text-green-400 mb-0.5">{data?.stats?.totalEmployees ?? 0}</div>
              <div className="text-xs text-white/70 font-semibold uppercase tracking-wider">Total Employees</div>
              <div className="text-[10px] text-green-400/60 mt-1">Active Team Members</div>
            </div>
          ) : (
            <div className="stat-card">
              <div className="w-10 h-10 rounded-xl mb-3 flex items-center justify-center bg-green-500/20 text-green-300 border border-green-500/40">
                <Users size={22} />
              </div>
              <div className="text-xl font-extrabold text-green-400 mb-0.5 truncate">
                {user?.designation || 'Staff'}
              </div>
              <div className="text-xs text-white/70 font-semibold uppercase tracking-wider">My Designation</div>
              <div className="text-[10px] text-green-400/60 mt-1">Role: {user?.role}</div>
            </div>
          )}

          <div className="stat-card">
            <div className="w-10 h-10 rounded-xl mb-3 flex items-center justify-center bg-pink-500/20 text-pink-300 border border-pink-500/40">
              <UserCheck size={22} />
            </div>
            <div className="text-2xl font-extrabold text-pink-400 mb-0.5">
              {isAdmin ? (data?.stats?.attendanceToday ?? 0) : (isPunchedOutToday ? 'Completed' : 'Active / Off')}
            </div>
            <div className="text-xs text-white/70 font-semibold uppercase tracking-wider">Attendance Status</div>
            <div className="text-[10px] text-pink-400/60 mt-1">15h Max Shift Rule Enabled</div>
          </div>
        </div>

        {/* Dashboard Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Notifications & System Updates Feed */}
          <div className="lg:col-span-2 glass-card p-6 border-cyan-500/30">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-bold text-lg text-white flex items-center gap-2">
                <Bell size={20} className="text-cyan-400" />
                Live Notification Center & EMS Updates
              </h2>
              <span className="badge badge-cyan">Real-time</span>
            </div>

            <div className="space-y-3">
              {notifications.slice(0, 6).map((notif: any) => (
                <div key={notif.id} className="p-3.5 rounded-xl bg-white/05 border border-cyan-500/20 flex items-start gap-3 hover:border-cyan-400/50 transition-all">
                  <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 mt-1.5 shrink-0 shadow-[0_0_8px_#00f0ff]" />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm text-cyan-300">{notif.title}</div>
                    <div className="text-xs text-white/80 mt-0.5">{notif.message}</div>
                    <div className="text-[10px] text-white/40 mt-1">
                      {new Date(notif.createdAt).toLocaleString()}
                    </div>
                  </div>
                </div>
              ))}
              {notifications.length === 0 && (
                <div className="text-center py-8 text-white/40 text-sm">No recent notifications. Punch-in and message updates will appear here.</div>
              )}
            </div>
          </div>

          {/* Quick Actions & Profile Info */}
          <div className="space-y-6">
            <div className="glass-card p-6 border-cyan-500/30">
              <h2 className="font-bold text-lg mb-4 text-white">Employee Profile</h2>
              <div className="flex items-center gap-4 mb-4">
                <div className="w-14 h-14 rounded-full bg-cyan-500/20 border border-cyan-400 flex items-center justify-center text-xl font-bold overflow-hidden">
                  {user?.photoUrl ? (
                    <img src={user.photoUrl} alt={user.username} className="w-full h-full object-cover" />
                  ) : (
                    user?.username?.charAt(0).toUpperCase()
                  )}
                </div>
                <div>
                  <div className="font-bold text-base text-white">{user?.username}</div>
                  <div className="text-xs text-cyan-400 font-mono">ID: #{user?.employeeId}</div>
                  <div className="text-xs text-white/50">{user?.designation || 'Staff Member'}</div>
                </div>
              </div>

              <div className="space-y-2 border-t border-white/10 pt-4">
                <button
                  onClick={() => router.push('/dashboard/attendance')}
                  className="btn-primary w-full py-2.5 text-xs font-bold"
                >
                  Manage Attendance & Overtime
                </button>
                <button
                  onClick={() => router.push('/dashboard/settings')}
                  className="btn-ghost w-full py-2.5 text-xs font-bold"
                >
                  Change Password & Avatar
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <DashboardContent />
    </ProtectedRoute>
  );
}
