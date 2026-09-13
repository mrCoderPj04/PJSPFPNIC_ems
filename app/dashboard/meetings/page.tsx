'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Sidebar from '@/components/Sidebar';
import { Video, Plus, Trash2, X, Check, AlertCircle, Calendar, Clock, Users } from 'lucide-react';

interface Participant {
  id: string;
  userId: string;
  meetingId: string;
  user?: {
    username: string;
  };
}

interface Meeting {
  id: string;
  title: string;
  description: string | null;
  startTime: string;
  endTime: string;
  link: string | null;
  creatorId: string;
  createdAt: string;
  creator?: { username: string } | null;
  participants: Participant[];
}

interface Employee {
  id: string;
  username: string;
  employeeId: string;
}

const API = process.env.NEXT_PUBLIC_API_URL || 'https://ems-backend-z3bv.onrender.com/api';

export default function MeetingsPage() {
  const { accessToken, isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();

  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Form states
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formStartTime, setFormStartTime] = useState('');
  const [formEndTime, setFormEndTime] = useState('');
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);

  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Security route protection
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/');
    }
    if (!isLoading && isAuthenticated && user?.isFirstLogin) {
      router.replace('/change-password');
    }
  }, [isAuthenticated, isLoading, user, router]);

  const fetchMeetings = useCallback(async () => {
    if (!accessToken) return;
    try {
      setPageLoading(true);
      // Fetch meetings
      const meetRes = await fetch(`${API}/meetings`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (meetRes.ok) {
        const data = await meetRes.json();
        setMeetings(data.meetings || []);
      }

      // Fetch employees for invite select & invitees display
      const empRes = await fetch(`${API}/employees`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (empRes.ok) {
        const empData = await empRes.json();
        setEmployees(empData.employees || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setPageLoading(false);
    }
  }, [accessToken, user]);

  useEffect(() => {
    if (isAuthenticated && accessToken) {
      fetchMeetings();
    }
  }, [isAuthenticated, accessToken, fetchMeetings]);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formStartTime || !formEndTime) return;
    setErrorMessage('');
    setSuccessMessage('');
    setActionLoading(true);

    try {
      const res = await fetch(`${API}/meetings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          title: formTitle,
          description: formDescription || undefined,
          startTime: new Date(formStartTime).toISOString(),
          endTime: new Date(formEndTime).toISOString(),
          participantIds: selectedParticipants,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to schedule meeting');
      }

      setMeetings([data.meeting, ...meetings]);
      setSuccessMessage('Meeting scheduled successfully.');
      
      // Cleanup
      setFormTitle('');
      setFormDescription('');
      setFormStartTime('');
      setFormEndTime('');
      setSelectedParticipants([]);

      setTimeout(() => {
        setIsAddModalOpen(false);
        setSuccessMessage('');
      }, 1000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error occurred');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (meet: Meeting) => {
    if (!confirm(`Are you sure you want to cancel the meeting: ${meet.title}?`)) return;
    try {
      const res = await fetch(`${API}/meetings/${meet.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        setMeetings(meetings.filter(m => m.id !== meet.id));
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to cancel meeting');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCheckboxChange = (empId: string) => {
    if (selectedParticipants.includes(empId)) {
      setSelectedParticipants(selectedParticipants.filter(id => id !== empId));
    } else {
      setSelectedParticipants([...selectedParticipants, empId]);
    }
  };

  if (isLoading || pageLoading) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 pt-24 pb-28 px-6 md:px-8 flex items-center justify-center">
          <div className="text-white/40 flex items-center gap-2">
            <svg className="animate-spin h-5 w-5 text-indigo-400" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Loading meetings list...
          </div>
        </main>
      </div>
    );
  }

  const isAdmin = user?.role === 'ADMIN';

  return (
    <div className="flex min-h-screen">
      <Sidebar />

      <main className="flex-1 pt-24 pb-28 px-6 md:px-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 fade-in-up">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">
              Team <span className="gradient-text">Meetings</span>
            </h1>
            <p className="text-white/40 mt-1 text-sm">Schedule video calls, host planning scrums, and manage sync events.</p>
          </div>
          {isAdmin && (
            <button
              onClick={() => {
                setFormTitle('');
                setFormDescription('');
                setFormStartTime('');
                setFormEndTime('');
                setSelectedParticipants([]);
                setErrorMessage('');
                setSuccessMessage('');
                setIsAddModalOpen(true);
              }}
              className="btn-primary flex items-center justify-center gap-2 self-start"
            >
              <Plus size={18} />
              Schedule Meeting
            </button>
          )}
        </div>

        {/* Meetings display */}
        <div className="space-y-4">
          {meetings.map((meet) => (
            <div key={meet.id} className="glass-card p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 border border-white/05 hover:border-indigo-500/20">
              <div className="space-y-3 flex-1">
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-green-400"></span>
                  <h3 className="text-lg font-bold">{meet.title}</h3>
                </div>
                {meet.description && (
                  <p className="text-sm text-white/50">{meet.description}</p>
                )}
                
                <div className="flex flex-wrap items-center gap-4 text-xs text-white/40 pt-2">
                  <div className="flex items-center gap-1.5">
                    <Calendar size={14} className="text-indigo-400" />
                    {new Date(meet.startTime).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock size={14} className="text-indigo-400" />
                    {new Date(meet.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(meet.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Users size={14} className="text-indigo-400" />
                    {meet.participants.length} invitees
                  </div>
                </div>

                {meet.participants.length > 0 && (
                  <div className="pt-3">
                    <span className="text-[10px] text-white/30 uppercase block mb-1">Participants</span>
                    <div className="flex flex-wrap gap-1">
                      {meet.participants.map(p => (
                        <span key={p.id} className="badge bg-white/05 border border-white/05 text-[10px] text-indigo-400 font-semibold px-2 py-0.5">
                          {p.user?.username || 'Guest'}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-4 justify-end md:self-center">
                {meet.link && (
                  <a
                    href={meet.link}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-primary py-2 px-4 text-xs flex items-center gap-1.5"
                  >
                    <Video size={14} />
                    Join Link
                  </a>
                )}
                {isAdmin && (
                  <button
                    onClick={() => handleDelete(meet)}
                    className="p-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 rounded-xl transition-all"
                    title="Cancel Meeting"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>
          ))}
          {meetings.length === 0 && (
            <div className="glass-card py-16 text-center text-white/20 text-sm">
              No meetings scheduled.
            </div>
          )}
        </div>

        {/* Modal: Schedule Meeting */}
        {isAddModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="glass-card max-w-md w-full p-6 relative max-h-[90vh] overflow-y-auto">
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="absolute top-4 right-4 text-white/40 hover:text-white"
              >
                <X size={18} />
              </button>

              <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                <Video size={20} className="text-indigo-400" />
                Schedule Sync Meeting
              </h2>

              {errorMessage && (
                <div className="flex items-center gap-2 bg-red-500/15 border border-red-500/30 rounded-xl p-4 mb-4 text-red-400 text-sm">
                  <AlertCircle size={16} />
                  {errorMessage}
                </div>
              )}
              {successMessage && (
                <div className="flex items-center gap-2 bg-green-500/15 border border-green-500/30 rounded-xl p-4 mb-4 text-green-400 text-sm">
                  <Check size={16} />
                  {successMessage}
                </div>
              )}

              <form onSubmit={handleAddSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Title</label>
                  <input
                    type="text"
                    required
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="e.g. Weekly Design Sync"
                    className="input-glass"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Description</label>
                  <textarea
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Agenda details..."
                    className="input-glass h-20 resize-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Start Time</label>
                    <input
                      type="datetime-local"
                      required
                      value={formStartTime}
                      onChange={(e) => setFormStartTime(e.target.value)}
                      className="input-glass bg-neutral-900 border-white/10 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">End Time</label>
                    <input
                      type="datetime-local"
                      required
                      value={formEndTime}
                      onChange={(e) => setFormEndTime(e.target.value)}
                      className="input-glass bg-neutral-900 border-white/10 text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Invite Participants</label>
                  <div className="bg-white/05 rounded-xl border border-white/05 p-3 space-y-2 max-h-36 overflow-y-auto">
                    {employees.map(emp => (
                      <label key={emp.id} className="flex items-center gap-2 text-xs text-white/80 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedParticipants.includes(emp.id)}
                          onChange={() => handleCheckboxChange(emp.id)}
                          className="accent-indigo-500 rounded"
                        />
                        {emp.username} (#{emp.employeeId})
                      </label>
                    ))}
                    {employees.length === 0 && (
                      <span className="text-xs text-white/30">No employees available to invite.</span>
                    )}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={actionLoading}
                  className="btn-primary w-full mt-4"
                >
                  {actionLoading ? 'Scheduling...' : 'Schedule Meeting'}
                </button>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
