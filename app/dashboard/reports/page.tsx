'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Sidebar from '@/components/Sidebar';
import ProtectedRoute from '@/components/ProtectedRoute';
import { BarChart3, Users, Clock, AlertCircle, TrendingUp, Download } from 'lucide-react';
import { generatePDFReport, generateExcelReport } from '@/lib/reportGenerator';
import { useSocket } from '@/contexts/SocketContext';

interface AttendanceRow {
  id: string;
  username: string;
  employeeId: string;
  designation: string;
  department: string;
  presentDays: number;
  totalHours: number;
  regularHours: number;
  overtimeHours: number;
  lateEntries: number;
  autoPunchOuts: number;
}

interface EmpOverviewRow {
  id: string;
  employeeId: string;
  username: string;
  email: string | null;
  designation: string | null;
  status: string;
  createdAt: string;
  department?: { name: string };
  _count: { attendance: number };
}

interface CredentialRow {
  employeeId: string;
  username: string;
  email: string | null;
  phone: string | null;
  designation: string | null;
  department: string;
  tempPassword: string;
  password: string;
}

const API = process.env.NEXT_PUBLIC_API_URL || 'https://erp-backend-1-02lc.onrender.com/api';

type Tab = 'attendance' | 'employees' | 'credentials';

function ReportsContent() {
  const { user, accessToken, isAuthenticated, isLoading } = useAuth();
  const { socket } = useSocket();
  const router = useRouter();

  const [tab, setTab] = useState<Tab>('employees');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Attendance
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [attendanceReport, setAttendanceReport] = useState<AttendanceRow[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);

  // Employees
  const [empReport, setEmpReport] = useState<EmpOverviewRow[]>([]);
  const [credentialsReport, setCredentialsReport] = useState<CredentialRow[]>([]);
  const [credentialsLoading, setCredentialsLoading] = useState(false);
  const [credentialsGenerated, setCredentialsGenerated] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace('/');
    if (!isLoading && isAuthenticated && user?.role !== 'ADMIN') router.replace('/dashboard');
  }, [isAuthenticated, isLoading, user, router]);

  const fetchAttendance = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      const res = await fetch(`${API}/reports/attendance?${params}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setAttendanceReport(data.report || []);
      setTotalRecords(data.totalRecords || 0);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [accessToken, startDate, endDate]);

  const fetchEmployees = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API}/reports/employees`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setEmpReport(data.employees || []);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, [accessToken]);

  const fetchCredentials = useCallback(async () => {
    if (!accessToken) return;
    setCredentialsLoading(true); setError('');
    try {
      const res = await fetch(`${API}/reports/credentials`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      setCredentialsReport((data.employees || []).map((emp: any) => ({
        employeeId: emp.employeeId,
        username: emp.username,
        email: emp.email || `${emp.username.toLowerCase().replace(/\s+/g, '')}@pjsofonic.com`,
        phone: emp.phone || 'N/A',
        designation: emp.designation,
        department: emp.department?.name || 'Unassigned',
        tempPassword: emp.password || emp.tempPassword || `${emp.employeeId}@Sofo`,
        password: emp.password || emp.tempPassword || `${emp.employeeId}@Sofo`,
      })));
    } catch (e: any) { setError(e.message); }
    finally { setCredentialsLoading(false); }
  }, [accessToken]);

  const generateCredentials = useCallback(async () => {
    if (!accessToken) return;
    setCredentialsLoading(true); setError('');
    try {
      const res = await fetch(`${API}/reports/credentials/generate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate credentials');
      setCredentialsReport((data.credentials || []).map((emp: any) => ({
        ...emp,
        password: emp.password || emp.tempPassword || `${emp.employeeId}@Sofo`,
      })));
      setCredentialsGenerated(true);
    } catch (e: any) { setError(e.message); }
    finally { setCredentialsLoading(false); }
  }, [accessToken]);

  useEffect(() => {
    if (!isAuthenticated || !accessToken || user?.role !== 'ADMIN') return;
    if (tab === 'attendance') fetchAttendance();
    else if (tab === 'employees') fetchEmployees();
    else if (tab === 'credentials') fetchCredentials();
  }, [tab, isAuthenticated, accessToken, user, fetchAttendance, fetchEmployees, fetchCredentials]);

  // Real-time: auto-refresh when employee data or attendance changes
  useEffect(() => {
    if (!socket) return;

    const handleEmployeeUpdate = () => {
      if (tab === 'employees') fetchEmployees();
      if (tab === 'credentials') fetchCredentials();
    };

    const handleAttendanceUpdate = () => {
      if (tab === 'attendance') fetchAttendance();
    };

    socket.on('employee:update', handleEmployeeUpdate);
    socket.on('attendance:update', handleAttendanceUpdate);

    return () => {
      socket.off('employee:update', handleEmployeeUpdate);
      socket.off('attendance:update', handleAttendanceUpdate);
    };
  }, [socket, tab, fetchEmployees, fetchCredentials, fetchAttendance]);

  const exportCSV = () => {
    let csv = '';
    if (tab === 'attendance') {
      csv = 'Employee,ID,Dept,Present Days,Total Hrs,Regular Hrs,OT Hrs,Late Entries,Auto Punch-Outs\n';
      attendanceReport.forEach(r => {
        csv += `${r.username},${r.employeeId},${r.department},${r.presentDays},${r.totalHours},${r.regularHours},${r.overtimeHours},${r.lateEntries},${r.autoPunchOuts}\n`;
      });
    } else if (tab === 'employees') {
      csv = 'Employee,ID,Email,Designation,Dept,Status,Joined,Attendance Days\n';
      empReport.forEach(r => {
        csv += `${r.username},${r.employeeId},${r.email || ''},${r.designation || ''},${r.department?.name || ''},${r.status},${new Date(r.createdAt).toLocaleDateString()},${r._count.attendance}\n`;
      });
    } else {
      csv = 'Employee Name,Employee ID,Password,Official Email,Phone Number,Designation,Department\n';
      credentialsReport.forEach(r => {
        csv += `"${r.username}","${r.employeeId}","${r.password || r.tempPassword}","${r.email || ''}","${r.phone || ''}","${r.designation || ''}","${r.department}"\n`;
      });
    }
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ems_${tab}_report_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPDF = async () => {
    if (tab === 'attendance') {
      await generatePDFReport({
        title: 'Attendance Summary',
        headers: ['Employee', 'ID', 'Dept', 'Present Days', 'Total Hrs', 'Regular Hrs', 'OT Hrs', 'Late Entries', 'Auto Punch-Outs'],
        rows: attendanceReport.map(r => [r.username, r.employeeId, r.department, r.presentDays, r.totalHours, r.regularHours, r.overtimeHours, r.lateEntries, r.autoPunchOuts]),
        fileName: `attendance_report_${new Date().toISOString().slice(0, 10)}`,
        generatedBy: user?.username,
      });
    } else if (tab === 'employees') {
      await generatePDFReport({
        title: 'Employee Overview',
        headers: ['Employee', 'ID', 'Email', 'Designation', 'Dept', 'Status', 'Joined', 'Attendance Days'],
        rows: empReport.map(r => [r.username, r.employeeId, r.email || '', r.designation || '', r.department?.name || '', r.status, new Date(r.createdAt).toLocaleDateString(), r._count.attendance]),
        fileName: `employee_overview_${new Date().toISOString().slice(0, 10)}`,
        generatedBy: user?.username,
      });
    } else {
      await generatePDFReport({
        title: 'Official Employee Credentials Report',
        headers: ['Employee Name', 'Employee ID', 'Password', 'Official Email', 'Phone Number', 'Designation', 'Department'],
        rows: credentialsReport.map(r => [r.username, `#${r.employeeId}`, r.password || r.tempPassword, r.email || '', r.phone || '', r.designation || '', r.department]),
        fileName: `employee_credentials_${new Date().toISOString().slice(0, 10)}`,
        generatedBy: user?.username,
      });
    }
  };

  const exportExcel = () => {
    if (tab === 'attendance') {
      generateExcelReport({
        title: 'Attendance Summary',
        headers: ['Employee', 'ID', 'Dept', 'Present Days', 'Total Hrs', 'Regular Hrs', 'OT Hrs', 'Late Entries', 'Auto Punch-Outs'],
        rows: attendanceReport.map(r => [r.username, r.employeeId, r.department, r.presentDays, r.totalHours, r.regularHours, r.overtimeHours, r.lateEntries, r.autoPunchOuts]),
        fileName: `attendance_report_${new Date().toISOString().slice(0, 10)}`,
        generatedBy: user?.username,
      });
    } else if (tab === 'employees') {
      generateExcelReport({
        title: 'Employee Overview',
        headers: ['Employee', 'ID', 'Email', 'Designation', 'Dept', 'Status', 'Joined', 'Attendance Days'],
        rows: empReport.map(r => [r.username, r.employeeId, r.email || '', r.designation || '', r.department?.name || '', r.status, new Date(r.createdAt).toLocaleDateString(), r._count.attendance]),
        fileName: `employee_overview_${new Date().toISOString().slice(0, 10)}`,
        generatedBy: user?.username,
      });
    } else {
      generateExcelReport({
        title: 'Official Employee Credentials Report',
        headers: ['Employee Name', 'Employee ID', 'Password', 'Official Email', 'Phone Number', 'Designation', 'Department'],
        rows: credentialsReport.map(r => [r.username, r.employeeId, r.password || r.tempPassword, r.email || '', r.phone || '', r.designation || '', r.department]),
        fileName: `employee_credentials_${new Date().toISOString().slice(0, 10)}`,
        generatedBy: user?.username,
      });
    }
  };

  const refreshReport = () => {
    if (tab === 'attendance') fetchAttendance();
    else if (tab === 'employees') fetchEmployees();
    else if (tab === 'credentials') fetchCredentials();
  };

  if (isLoading) return (
    <div className="flex min-h-screen bg-black text-white">
      <Sidebar />
      <main className="flex-1 pt-24 pb-28 px-6 md:px-8 flex items-center justify-center">
        <div className="text-cyan-400 animate-pulse">Loading reports...</div>
      </main>
    </div>
  );

  const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'attendance', label: 'Attendance', icon: <Clock size={16} /> },
    { key: 'employees',  label: 'Employees',  icon: <Users size={16} /> },
    { key: 'credentials', label: 'Credentials', icon: <TrendingUp size={16} /> },
  ];

  return (
    <div className="flex min-h-screen bg-black text-white">
      <Sidebar />
      <main className="flex-1 pt-24 pb-28 px-6 md:px-8 max-w-7xl mx-auto w-full">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 fade-in-up border-b border-cyan-500/20 pb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight flex items-center gap-3">
              <BarChart3 className="text-cyan-400" />
              EMS <span className="gradient-text">Reports & Analytics</span>
            </h1>
            <p className="text-white/60 mt-1 text-sm">Attendance summaries and employee analytics.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={refreshReport}
              className="btn-tertiary py-2 px-5 text-xs font-bold flex items-center gap-2"
            >
              Refresh
            </button>
            <button
              type="button"
              onClick={exportCSV}
              className="btn-primary py-2 px-5 text-xs font-bold flex items-center gap-2"
            >
              <Download size={16} />
              Export CSV
            </button>
            <button
              type="button"
              onClick={exportPDF}
              className="btn-secondary py-2 px-5 text-xs font-bold flex items-center gap-2"
            >
              <Download size={16} />
              Export PDF
            </button>
            <button
              type="button"
              onClick={exportExcel}
              className="btn-secondary py-2 px-5 text-xs font-bold flex items-center gap-2"
            >
              <Download size={16} />
              Export Excel
            </button>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-pink-500/15 border border-pink-500/40 rounded-xl p-4 mb-6 text-pink-400 text-sm">
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {/* Centered Glassmorphic Tab Switcher with Background Blur */}
        <div className="flex justify-center mb-8">
          <div className="flex bg-white/10 backdrop-blur-md p-1.5 rounded-2xl border border-cyan-500/30 shadow-[0_0_25px_rgba(0,240,255,0.15)] gap-2">
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-2 px-6 py-2.5 text-xs font-extrabold rounded-xl capitalize transition-all ${
                  tab === t.key
                    ? 'bg-cyan-500/30 text-cyan-300 border border-cyan-400 shadow-[0_0_15px_rgba(0,240,255,0.4)] backdrop-blur-lg'
                    : 'text-white/50 hover:text-white hover:bg-white/5'
                }`}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── ATTENDANCE TAB ── */}
        {tab === 'attendance' && (
          <>
            {/* Date filter */}
            <div className="glass-card p-4 mb-6 border-cyan-500/20 flex flex-wrap gap-4 items-end">
              <div>
                <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">From</label>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="input-glass bg-black text-white border-cyan-500/20" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">To</label>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="input-glass bg-black text-white border-cyan-500/20" />
              </div>
              <button onClick={fetchAttendance} disabled={loading} className="btn-primary py-2.5 px-5 text-xs font-bold">
                {loading ? 'Loading...' : 'Generate Report'}
              </button>
            </div>

            {/* Summary cards */}
            {attendanceReport.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {[
                  { label: 'Total Records', value: totalRecords, color: 'cyan' },
                  { label: 'Employees', value: attendanceReport.length, color: 'purple' },
                  { label: 'Total OT Hrs', value: attendanceReport.reduce((s,r)=>s+r.overtimeHours,0).toFixed(1)+' hrs', color: 'pink' },
                  { label: 'Late Entries', value: attendanceReport.reduce((s,r)=>s+r.lateEntries,0), color: 'yellow' },
                ].map(c => (
                  <div key={c.label} className="glass-card p-4 border-cyan-500/20">
                    <span className="text-[10px] text-white/50 uppercase font-bold block">{c.label}</span>
                    <span className={`text-2xl font-extrabold block mt-1 text-${c.color}-400`}>{c.value}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="glass-card overflow-hidden border-cyan-500/30">
              <div className="overflow-x-auto">
                <table className="table-glass">
                  <thead><tr>
                    <th>Employee</th>
                    <th>Dept</th>
                    <th>Days Present</th>
                    <th>Total Hrs</th>
                    <th>Regular (8h)</th>
                    <th>Overtime</th>
                    <th>Late</th>
                    <th>Auto Punch-Out</th>
                  </tr></thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={8} className="text-center py-10 text-white/30">Loading...</td></tr>
                    ) : attendanceReport.length === 0 ? (
                      <tr><td colSpan={8} className="text-center py-10 text-white/30">No data. Apply filters and click Generate Report.</td></tr>
                    ) : attendanceReport.map(r => (
                      <tr key={r.id}>
                        <td>
                          <div className="font-bold text-sm text-white">{r.username}</div>
                          <div className="text-[10px] text-cyan-400 font-mono">#{r.employeeId}</div>
                        </td>
                        <td className="text-white/70 text-xs">{r.department}</td>
                        <td className="font-bold text-cyan-300">{r.presentDays}</td>
                        <td className="font-mono text-white">{r.totalHours} hrs</td>
                        <td className="font-mono text-cyan-400">{r.regularHours} hrs</td>
                        <td className="font-mono text-purple-400 font-bold">{r.overtimeHours > 0 ? `+${r.overtimeHours}` : '0'} hrs</td>
                        <td className="text-yellow-400 font-bold">{r.lateEntries}</td>
                        <td className="text-pink-400 font-bold">{r.autoPunchOuts}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* ── EMPLOYEES TAB ── */}
        {tab === 'employees' && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
              <div className="glass-card p-5 border-cyan-500/30">
                <span className="text-[10px] text-white/50 uppercase font-bold block">Total Employees</span>
                <span className="text-2xl font-extrabold text-cyan-400 block mt-1">{empReport.length}</span>
              </div>
              <div className="glass-card p-5 border-green-500/30">
                <span className="text-[10px] text-white/50 uppercase font-bold block">Active</span>
                <span className="text-2xl font-extrabold text-green-400 block mt-1">
                  {empReport.filter(e => e.status === 'ACTIVE').length}
                </span>
              </div>
              <div className="glass-card p-5 border-pink-500/30">
                <span className="text-[10px] text-white/50 uppercase font-bold block">Inactive / Locked</span>
                <span className="text-2xl font-extrabold text-pink-400 block mt-1">
                  {empReport.filter(e => e.status !== 'ACTIVE').length}
                </span>
              </div>
            </div>

            <div className="glass-card overflow-hidden border-cyan-500/30">
              <div className="overflow-x-auto">
                <table className="table-glass">
                  <thead><tr>
                    <th>Employee</th>
                    <th>Email</th>
                    <th>Designation / Dept</th>
                    <th>Attendance Days</th>
                    <th>Status</th>
                    <th>Joined</th>
                  </tr></thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={6} className="text-center py-10 text-white/30">Loading employee report...</td></tr>
                    ) : empReport.length === 0 ? (
                      <tr><td colSpan={6} className="text-center py-10 text-white/30">No employees found.</td></tr>
                    ) : empReport.map(r => (
                      <tr key={r.id}>
                        <td>
                          <div className="font-bold text-sm text-white">{r.username}</div>
                          <div className="text-[10px] text-cyan-400 font-mono">#{r.employeeId}</div>
                        </td>
                        <td className="text-white/60 text-xs">{r.email || '—'}</td>
                        <td>
                          <div className="text-xs font-medium text-white">{r.designation || 'Staff'}</div>
                          <div className="text-[10px] text-white/40">{r.department?.name || 'Unassigned'}</div>
                        </td>
                        <td className="font-bold text-cyan-400">{r._count?.attendance ?? 0}</td>
                        <td>
                          <span className={`badge ${r.status === 'ACTIVE' ? 'badge-green' : 'badge-red'}`}>{r.status}</span>
                        </td>
                        <td className="text-white/50 text-xs">
                          {new Date(r.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* ── CREDENTIALS TAB ── */}
        {tab === 'credentials' && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="glass-card p-5 border-cyan-500/30">
                <span className="text-[10px] text-white/50 uppercase font-bold block">Total Employees</span>
                <span className="text-2xl font-extrabold text-cyan-400 block mt-1">{credentialsReport.length}</span>
              </div>
              <div className="glass-card p-5 border-purple-500/30">
                <span className="text-[10px] text-white/50 uppercase font-bold block">Credentials Status</span>
                <span className={`text-2xl font-extrabold block mt-1 ${credentialsGenerated ? 'text-green-400' : 'text-yellow-400'}`}>
                  {credentialsGenerated ? 'Generated' : 'Not Generated'}
                </span>
              </div>
              <div className="glass-card p-5 border-green-500/30">
                <span className="text-[10px] text-white/50 uppercase font-bold block">Export Formats</span>
                <span className="text-lg font-extrabold text-green-400 block mt-1">PDF · Excel · CSV</span>
              </div>
              <div className="glass-card p-5 border-pink-500/30">
                <span className="text-[10px] text-white/50 uppercase font-bold block">Security</span>
                <span className="text-lg font-extrabold text-pink-400 block mt-1">Confidential</span>
              </div>
            </div>

            {/* Credentials Banner & Sync Action */}
            <div className="glass-card p-5 mb-6 border-cyan-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-cyan-500/5">
              <div>
                <h3 className="font-bold text-sm text-cyan-300 flex items-center gap-2">
                  <AlertCircle size={16} /> Official Employee Credentials & Onboarding Directory
                </h3>
                <p className="text-[11px] text-white/60 mt-1">
                  Password Formula: <span className="text-cyan-400 font-mono font-bold">[Employee ID]@Sofo</span> (Direct access enabled — no forced password reset required).
                </p>
              </div>
              <button
                onClick={() => {
                  if (window.confirm('Sync / verify all employee passwords with their standard [Employee ID]@Sofo credentials?')) {
                    generateCredentials();
                  }
                }}
                disabled={credentialsLoading}
                className="btn-primary py-2.5 px-6 text-xs font-bold whitespace-nowrap flex items-center gap-2 shrink-0"
              >
                {credentialsLoading ? 'Syncing...' : '🔄 Sync & Verify Credentials'}
              </button>
            </div>

            {/* Credentials Table */}
            <div className="glass-card overflow-hidden border-cyan-500/30">
              <div className="overflow-x-auto">
                <table className="table-glass">
                  <thead><tr>
                    <th>Employee</th>
                    <th>Employee ID</th>
                    <th>Password</th>
                    <th>Official Email</th>
                    <th>Phone</th>
                    <th>Designation</th>
                    <th>Department</th>
                  </tr></thead>
                  <tbody>
                    {credentialsLoading ? (
                      <tr><td colSpan={7} className="text-center py-10 text-white/30">Loading credentials...</td></tr>
                    ) : credentialsReport.length === 0 ? (
                      <tr><td colSpan={7} className="text-center py-10 text-white/30">No employees found.</td></tr>
                    ) : credentialsReport.map((r, idx) => (
                      <tr key={idx}>
                        <td>
                          <div className="font-bold text-sm text-white">{r.username}</div>
                        </td>
                        <td>
                          <span className="text-cyan-400 font-mono text-xs">#{r.employeeId}</span>
                        </td>
                        <td>
                          <span className="font-mono text-xs px-2.5 py-1 rounded-lg bg-green-500/15 text-green-400 border border-green-500/30 font-bold">
                            {r.password || r.tempPassword}
                          </span>
                        </td>
                        <td className="text-cyan-300 font-mono text-xs">{r.email || '—'}</td>
                        <td className="text-white/80 font-mono text-xs">{r.phone || '—'}</td>
                        <td className="text-white/70 text-xs">{r.designation || 'Staff'}</td>
                        <td className="text-white/70 text-xs">{r.department}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {credentialsGenerated && (
              <div className="mt-4 flex items-center gap-2 bg-green-500/10 border border-green-500/30 rounded-xl p-4 text-green-400 text-xs">
                <TrendingUp size={16} />
                Credentials verified and synchronized successfully! You can export them using the buttons above.
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

export default function ReportsPage() {
  return (
    <ProtectedRoute>
      <ReportsContent />
    </ProtectedRoute>
  );
}
