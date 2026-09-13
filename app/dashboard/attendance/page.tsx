'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Sidebar from '@/components/Sidebar';
import ProtectedRoute from '@/components/ProtectedRoute';
import { CalendarDays, LogIn, LogOut, Check, AlertCircle, Clock, Activity, ShieldAlert, Edit2, X } from 'lucide-react';

interface AttendanceRecord {
  id: string;
  userId: string;
  date: string;
  loginTime: string | null;
  logoutTime: string | null;
  lateEntry: boolean;
  totalHours: number | null;
  regularHours: number | null;
  overtimeHours: number | null;
  isAutoPunchOut?: boolean;
  user?: {
    id: string;
    username: string;
    employeeId: string;
  };
}

interface Employee {
  id: string;
  username: string;
  employeeId: string;
}

const API = process.env.NEXT_PUBLIC_API_URL || 'https://ems-backend-z3bv.onrender.com/api';

function AttendanceContent() {
  const { accessToken, isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();

  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [pageLoading, setPageLoading] = useState(true);

  // Filters
  const [filterUserId, setFilterUserId] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

  // Status for today
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Admin Override Punch
  const [selectedAdminEmpId, setSelectedAdminEmpId] = useState('');
  const [customPunchTime, setCustomPunchTime] = useState('');

  // Edit attendance record state for Admin
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const [editLoginTime, setEditLoginTime] = useState('');
  const [editLogoutTime, setEditLogoutTime] = useState('');

  // Calculator
  const [calcEmpId, setCalcEmpId] = useState('');
  const [calcTimeframe, setCalcTimeframe] = useState<'day' | 'week' | 'month'>('week');
  const [calcResult, setCalcResult] = useState<any>(null);
  const [calcLoading, setCalcLoading] = useState(false);
  const [calcError, setCalcError] = useState('');

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/');
    }
    if (!isLoading && isAuthenticated && user?.isFirstLogin) {
      router.replace('/change-password');
    }
  }, [isAuthenticated, isLoading, user, router]);

  const fetchAttendance = useCallback(async () => {
    if (!accessToken) return;
    try {
      setPageLoading(true);
      const params = new URLSearchParams();
      if (filterUserId) params.append('userId', filterUserId);
      if (filterStartDate) params.append('startDate', filterStartDate);
      if (filterEndDate) params.append('endDate', filterEndDate);

      const res = await fetch(`${API}/attendance?${params.toString()}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : (data.records || []);
        setRecords(list);

        const todayStr = new Date().toDateString();
        const foundToday = list.find(
          (r: AttendanceRecord) => r.userId === user?.id && new Date(r.date).toDateString() === todayStr
        );
        setTodayRecord(foundToday || null);
      }

      if (user?.role === 'ADMIN' && employees.length === 0) {
        const empRes = await fetch(`${API}/employees`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (empRes.ok) {
          const empData = await empRes.json();
          setEmployees(empData.employees || []);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setPageLoading(false);
    }
  }, [accessToken, user, filterUserId, filterStartDate, filterEndDate, employees.length]);

  useEffect(() => {
    if (isAuthenticated && accessToken) {
      fetchAttendance();
    }
  }, [isAuthenticated, accessToken, filterUserId, filterStartDate, filterEndDate, fetchAttendance]);

  const handleCheckIn = async () => {
    setErrorMessage('');
    setSuccessMessage('');
    setActionLoading(true);
    try {
      const res = await fetch(`${API}/attendance/check-in`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to check in');
      setTodayRecord(data.record);
      setSuccessMessage('Punch in recorded successfully.');
      fetchAttendance();
    } catch (err: any) {
      setErrorMessage(err.message || 'Error occurred');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCheckOut = async () => {
    setErrorMessage('');
    setSuccessMessage('');
    setActionLoading(true);
    try {
      const res = await fetch(`${API}/attendance/check-out`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to check out');
      setTodayRecord(data.record);
      setSuccessMessage('Punch out recorded successfully.');
      fetchAttendance();
    } catch (err: any) {
      setErrorMessage(err.message || 'Error occurred');
    } finally {
      setActionLoading(false);
    }
  };

  // Admin Force Punch In for selected employee
  const handleAdminPunchIn = async () => {
    if (!selectedAdminEmpId) return;
    setErrorMessage('');
    setSuccessMessage('');
    setActionLoading(true);
    try {
      const res = await fetch(`${API}/attendance/admin/punch-in`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          userId: selectedAdminEmpId,
          customTime: customPunchTime ? new Date(customPunchTime).toISOString() : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Admin punch-in failed');
      setSuccessMessage(data.message || 'Employee punched in by admin.');
      setCustomPunchTime('');
      fetchAttendance();
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Admin Force Punch Out for selected employee
  const handleAdminPunchOut = async () => {
    if (!selectedAdminEmpId) return;
    setErrorMessage('');
    setSuccessMessage('');
    setActionLoading(true);
    try {
      const res = await fetch(`${API}/attendance/admin/punch-out`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          userId: selectedAdminEmpId,
          customTime: customPunchTime ? new Date(customPunchTime).toISOString() : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Admin punch-out failed');
      setSuccessMessage(data.message || 'Employee punched out by admin.');
      setCustomPunchTime('');
      fetchAttendance();
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const openEditRecordModal = (rec: AttendanceRecord) => {
    setEditingRecord(rec);
    // Format date for datetime-local input (YYYY-MM-DDTHH:mm)
    const formatForInput = (dStr: string | null) => {
      if (!dStr) return '';
      const d = new Date(dStr);
      const tzOffset = d.getTimezoneOffset() * 60000;
      return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
    };
    setEditLoginTime(formatForInput(rec.loginTime));
    setEditLogoutTime(formatForInput(rec.logoutTime));
    setErrorMessage('');
    setSuccessMessage('');
  };

  const handleSaveEditAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord) return;
    setErrorMessage('');
    setSuccessMessage('');
    setActionLoading(true);
    try {
      const res = await fetch(`${API}/attendance/admin/edit/${editingRecord.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          loginTime: editLoginTime ? new Date(editLoginTime).toISOString() : undefined,
          logoutTime: editLogoutTime ? new Date(editLogoutTime).toISOString() : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update attendance time');
      setSuccessMessage('Attendance record time updated successfully.');
      setEditingRecord(null);
      fetchAttendance();
    } catch (err: any) {
      setErrorMessage(err.message || 'Error occurred');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCalculate = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!calcEmpId.trim() || !accessToken) return;
    setCalcError('');
    setCalcLoading(true);
    try {
      const res = await fetch(`${API}/attendance/calculator?employeeId=${encodeURIComponent(calcEmpId)}&timeframe=${calcTimeframe}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Calculation failed');
      setCalcResult(data);
    } catch (err: any) {
      setCalcError(err.message || 'Error occurred');
      setCalcResult(null);
    } finally {
      setCalcLoading(false);
    }
  };

  if (isLoading || pageLoading) {
    return (
      <div className="flex min-h-screen bg-black text-white">
        <Sidebar />
        <main className="flex-1 pt-24 pb-28 px-6 md:px-8 flex items-center justify-center">
          <div className="text-cyan-400 animate-pulse">Loading attendance logs...</div>
        </main>
      </div>
    );
  }

  const isAdmin = user?.role === 'ADMIN';

  // Compute Total Shift Hours vs Overtime Hours
  const totalRegular = records.reduce((sum, r) => sum + (r.regularHours || Math.min(r.totalHours || 0, 8)), 0);
  const totalOvertime = records.reduce((sum, r) => sum + (r.overtimeHours || Math.max(0, (r.totalHours || 0) - 8)), 0);

  return (
    <div className="flex min-h-screen bg-black text-white">
      <Sidebar />

      <main className="flex-1 pt-24 pb-28 px-6 md:px-8 max-w-7xl mx-auto w-full">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 fade-in-up border-b border-cyan-500/20 pb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              Attendance & <span className="gradient-text">Overtime Tracker</span>
            </h1>
            <p className="text-white/60 mt-1 text-sm">
              Standard Shift: 8 Hours/Day · Overtime: Any additional time beyond 8 Hours · Auto Punch-out: 15 Hours
            </p>
          </div>
        </div>

        {/* Global Feedback Banners */}
        {errorMessage && (
          <div className="flex items-center gap-2 bg-pink-500/15 border border-pink-500/40 rounded-xl p-4 mb-6 text-pink-400 text-sm">
            <AlertCircle size={16} />
            {errorMessage}
          </div>
        )}
        {successMessage && (
          <div className="flex items-center gap-2 bg-green-500/15 border border-green-500/40 rounded-xl p-4 mb-6 text-green-400 text-sm">
            <Check size={16} />
            {successMessage}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Employee Punch Console */}
          <div className="glass-card p-6 border-cyan-500/30">
            <h3 className="text-base font-bold mb-1 text-cyan-400">PUNCH CONSOLE</h3>
            <p className="text-xs text-white/50 mb-5">Record your shift punch in / out.</p>

            <div className="space-y-4">
              {!todayRecord?.loginTime ? (
                <button
                  onClick={handleCheckIn}
                  disabled={actionLoading}
                  className="btn-primary w-full py-3 flex items-center justify-center gap-2 font-extrabold"
                >
                  <LogIn size={18} />
                  Punch In Shift
                </button>
              ) : !todayRecord?.logoutTime ? (
                <div className="space-y-3">
                  <div className="text-xs text-green-400 flex items-center gap-2 bg-green-500/10 p-3 rounded-xl border border-green-500/30 font-bold">
                    <span className="w-2 h-2 rounded-full bg-green-400 animate-ping"></span>
                    Active Shift Since {new Date(todayRecord.loginTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <button
                    onClick={handleCheckOut}
                    disabled={actionLoading}
                    className="w-full bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white rounded-xl py-3 font-bold text-sm shadow-[0_0_20px_rgba(255,0,127,0.5)] flex items-center justify-center gap-2 transition-all"
                  >
                    <LogOut size={18} />
                    Punch Out Shift
                  </button>
                </div>
              ) : (
                <div className="text-xs text-cyan-300 bg-cyan-500/10 p-3 rounded-xl border border-cyan-500/30 font-semibold">
                  <Check size={16} className="inline mr-1 text-green-400" />
                  Shift Completed Today ({todayRecord.totalHours?.toFixed(2)} hrs logged)
                </div>
              )}
            </div>
          </div>

          {/* Overtime Tracker Metrics Card */}
          <div className="glass-card p-6 border-cyan-500/30">
            <h3 className="text-base font-bold mb-1 text-purple-400">OVERTIME TRACKER</h3>
            <p className="text-xs text-white/50 mb-5">Automatic 8h Shift & OT Calculation</p>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-black/60 p-3 rounded-xl border border-cyan-500/20">
                <span className="text-[10px] text-white/50 uppercase font-bold block">Regular Shift (8h)</span>
                <span className="text-xl font-extrabold text-cyan-400 block mt-1">{totalRegular.toFixed(1)} hrs</span>
              </div>
              <div className="bg-black/60 p-3 rounded-xl border border-purple-500/20">
                <span className="text-[10px] text-white/50 uppercase font-bold block">Total Overtime</span>
                <span className="text-xl font-extrabold text-purple-400 block mt-1">{totalOvertime.toFixed(1)} hrs</span>
              </div>
            </div>
            <div className="mt-4 text-[11px] text-white/40">
              * Overtime = Total daily logged hours minus 8 hours per shift.
            </div>
          </div>

          {/* Admin Punch Override Console */}
          {isAdmin && (
            <div className="glass-card p-6 border-pink-500/30">
              <h3 className="text-base font-bold mb-1 text-pink-400 flex items-center gap-1.5">
                <ShieldAlert size={18} />
                ADMIN PUNCH OVERRIDE
              </h3>
              <p className="text-xs text-white/50 mb-4">Punch In or Out for any employee.</p>

              <div className="space-y-3">
                <select
                  value={selectedAdminEmpId}
                  onChange={(e) => setSelectedAdminEmpId(e.target.value)}
                  className="input-glass text-xs bg-black border-cyan-500/30 text-white"
                >
                  <option value="">Select Employee</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.username} (#{emp.employeeId})
                    </option>
                  ))}
                </select>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-white/50 mb-1">Optional Custom Punch Time</label>
                  <input
                    type="datetime-local"
                    value={customPunchTime}
                    onChange={(e) => setCustomPunchTime(e.target.value)}
                    className="input-glass text-xs bg-black border-cyan-500/30 text-white"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleAdminPunchIn}
                    disabled={!selectedAdminEmpId || actionLoading}
                    className="flex-1 btn-primary py-2 text-xs font-bold"
                  >
                    Force Punch In
                  </button>
                  <button
                    onClick={handleAdminPunchOut}
                    disabled={!selectedAdminEmpId || actionLoading}
                    className="flex-1 bg-pink-600 hover:bg-pink-500 text-white font-bold py-2 text-xs rounded-xl shadow-[0_0_15px_rgba(255,0,127,0.4)] transition-all"
                  >
                    Force Punch Out
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Working Hours Calculator */}
        {isAdmin && (
          <div className="glass-card p-6 mb-8 border-purple-500/30">
            <div className="flex items-center gap-2 mb-2">
              <CalendarDays size={20} className="text-purple-400" />
              <h3 className="text-lg font-bold text-white">Employee Shift & Overtime Calculator</h3>
            </div>

            <form onSubmit={handleCalculate} className="space-y-4">
              <div className="flex flex-col md:flex-row gap-4 items-end">
                <div className="flex-1 w-full">
                  <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Employee ID / Select Employee</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Enter Employee ID (e.g. 0001)"
                      value={calcEmpId}
                      onChange={(e) => setCalcEmpId(e.target.value)}
                      className="input-glass flex-1 text-xs"
                    />
                    <select
                      onChange={(e) => { if (e.target.value) setCalcEmpId(e.target.value); }}
                      className="input-glass bg-black border-cyan-500/30 text-xs w-48"
                    >
                      <option value="">Quick Select</option>
                      {employees.map(emp => (
                        <option key={emp.id} value={emp.employeeId}>
                          {emp.username} (#{emp.employeeId})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex bg-white/05 p-1 rounded-xl border border-cyan-500/20 shrink-0">
                  {(['day', 'week', 'month'] as const).map((tf) => (
                    <button
                      key={tf}
                      type="button"
                      onClick={() => setCalcTimeframe(tf)}
                      className={`px-4 py-2 text-xs font-semibold rounded-lg capitalize transition-all ${
                        calcTimeframe === tf ? 'bg-cyan-500/30 text-cyan-300 border border-cyan-400 shadow-[0_0_12px_rgba(0,240,255,0.4)]' : 'text-white/40'
                      }`}
                    >
                      {tf}
                    </button>
                  ))}
                </div>

                <button
                  type="submit"
                  disabled={calcLoading || !calcEmpId.trim()}
                  className="btn-primary py-2.5 px-6 text-xs flex items-center justify-center gap-2 shrink-0 font-bold"
                >
                  {calcLoading ? 'Calculating...' : 'Calculate Shift & OT'}
                </button>
              </div>
            </form>

            {calcResult && (
              <div className="mt-6 pt-6 border-t border-white/10 grid grid-cols-1 md:grid-cols-4 gap-4 fade-in-up">
                <div className="bg-black/60 p-4 rounded-xl border border-cyan-500/20">
                  <span className="text-[10px] text-white/50 uppercase block font-semibold">Employee</span>
                  <span className="font-bold text-sm text-white block">{calcResult.employee?.username}</span>
                  <span className="text-[10px] text-cyan-400 font-mono">#{calcResult.employee?.employeeId}</span>
                </div>
                <div className="bg-black/60 p-4 rounded-xl border border-cyan-500/20">
                  <span className="text-[10px] text-white/50 uppercase block font-semibold">Standard Shift Hours</span>
                  <span className="font-extrabold text-2xl text-cyan-400 block">{calcResult.regularHours} hrs</span>
                </div>
                <div className="bg-black/60 p-4 rounded-xl border border-purple-500/20">
                  <span className="text-[10px] text-white/50 uppercase block font-semibold">Overtime Hours</span>
                  <span className="font-extrabold text-2xl text-purple-400 block">{calcResult.overtimeHours} hrs</span>
                </div>
                <div className="bg-black/60 p-4 rounded-xl border border-green-500/20">
                  <span className="text-[10px] text-white/50 uppercase block font-semibold">Total Logged Hours</span>
                  <span className="font-extrabold text-2xl text-green-400 block">{calcResult.totalHours} hrs</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Filters */}
        <div className="glass-card p-6 mb-8 border-cyan-500/20">
          <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-wider mb-4">Filter Records</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {isAdmin && (
              <div>
                <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Employee</label>
                <select
                  value={filterUserId}
                  onChange={(e) => setFilterUserId(e.target.value)}
                  className="input-glass bg-black border-cyan-500/20 text-white"
                >
                  <option value="">All Employees</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.username} (#{emp.employeeId})</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Start Date</label>
              <input
                type="date"
                value={filterStartDate}
                onChange={(e) => setFilterStartDate(e.target.value)}
                className="input-glass bg-black border-cyan-500/20 text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">End Date</label>
              <input
                type="date"
                value={filterEndDate}
                onChange={(e) => setFilterEndDate(e.target.value)}
                className="input-glass bg-black border-cyan-500/20 text-white"
              />
            </div>
          </div>
        </div>

        {/* Attendance Records Table */}
        <div className="glass-card overflow-hidden border-cyan-500/30">
          <div className="overflow-x-auto">
            <table className="table-glass">
              <thead>
                <tr>
                  {isAdmin && <th>Employee</th>}
                  <th>Date</th>
                  <th>Punch In</th>
                  <th>Punch Out</th>
                  <th>Status / Badges</th>
                  <th>Standard (8h)</th>
                  <th>Overtime</th>
                  {isAdmin && <th className="text-right">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {records.map((rec) => {
                  const reg = rec.regularHours || Math.min(rec.totalHours || 0, 8.0);
                  const ot = rec.overtimeHours || Math.max(0, (rec.totalHours || 0) - 8.0);

                  return (
                    <tr key={rec.id}>
                      {isAdmin && (
                        <td className="font-semibold text-white">
                          {rec.user?.username || 'Unknown'}
                          <span className="text-[10px] block text-cyan-400/60 font-normal">#{rec.user?.employeeId || ''}</span>
                        </td>
                      )}
                      <td className="text-white/80">
                        {new Date(rec.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                      </td>
                      <td className="font-mono text-white/80">
                        {rec.loginTime ? new Date(rec.loginTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                      </td>
                      <td className="font-mono text-white/80">
                        {rec.logoutTime ? new Date(rec.logoutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Active'}
                      </td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          {rec.lateEntry ? (
                            <span className="badge badge-red">Late</span>
                          ) : (
                            <span className="badge badge-green">On Time</span>
                          )}
                          {rec.isAutoPunchOut && (
                            <span className="badge badge-purple">15h Auto Punch-Out</span>
                          )}
                        </div>
                      </td>
                      <td className="font-mono font-bold text-cyan-400">
                        {reg.toFixed(2)} hrs
                      </td>
                      <td className="font-mono font-bold text-purple-400">
                        {ot > 0 ? `+${ot.toFixed(2)} hrs` : '0.00 hrs'}
                      </td>
                      {isAdmin && (
                        <td className="text-right">
                          <button
                            onClick={() => openEditRecordModal(rec)}
                            className="p-2 hover:bg-cyan-500/20 rounded-lg text-cyan-400 transition-colors"
                            title="Edit Attendance Punch Times"
                          >
                            <Edit2 size={16} />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
                {records.length === 0 && (
                  <tr>
                    <td colSpan={isAdmin ? 8 : 6} className="text-center py-12 text-white/30 text-sm">
                      No attendance records found matching filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal: Edit Attendance Time (Admin) */}
        {editingRecord && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="glass-card max-w-md w-full p-6 relative border-cyan-500/40">
              <button onClick={() => setEditingRecord(null)} className="absolute top-4 right-4 text-white/60 hover:text-white">
                <X size={18} />
              </button>
              <h2 className="text-xl font-bold mb-1 text-cyan-400">Edit Attendance Punch Times</h2>
              <p className="text-xs text-white/50 mb-4">
                Employee: {editingRecord.user?.username || 'Staff'} (#{editingRecord.user?.employeeId || ''})
              </p>

              <form onSubmit={handleSaveEditAttendance} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-white/70 uppercase tracking-wider mb-1">Punch In Time (Login)</label>
                  <input
                    type="datetime-local"
                    value={editLoginTime}
                    onChange={(e) => setEditLoginTime(e.target.value)}
                    className="input-glass bg-black text-white border-cyan-500/30"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-white/70 uppercase tracking-wider mb-1">Punch Out Time (Logout)</label>
                  <input
                    type="datetime-local"
                    value={editLogoutTime}
                    onChange={(e) => setEditLogoutTime(e.target.value)}
                    className="input-glass bg-black text-white border-cyan-500/30"
                  />
                </div>
                <button type="submit" disabled={actionLoading} className="btn-primary w-full py-3 font-bold">
                  {actionLoading ? 'Saving...' : 'Save Updated Punch Times'}
                </button>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default function AttendancePage() {
  return (
    <ProtectedRoute>
      <AttendanceContent />
    </ProtectedRoute>
  );
}
