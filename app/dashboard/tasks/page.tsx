'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Sidebar from '@/components/Sidebar';
import { ClipboardList, Plus, Edit2, Trash2, X, Check, AlertCircle, Clock, Calendar } from 'lucide-react';

interface Task {
  id: string;
  title: string;
  description: string | null;
  priority: 'LOW' | 'HIGH' | 'URGENT';
  deadline: string | null;
  status: 'PENDING' | 'WORKING' | 'REVIEW' | 'COMPLETED' | 'REJECTED';
  attachments: string[];
  createdAt: string;
  creatorId: string;
  assigneeId: string | null;
  assignee?: { id: string; username: string; employeeId: string } | null;
  creator?: { id: string; username: string } | null;
}

interface Employee {
  id: string;
  username: string;
  employeeId: string;
}

const API = process.env.NEXT_PUBLIC_API_URL || 'https://ems-backend-z3bv.onrender.com/api';

const STATUSES: Task['status'][] = ['PENDING', 'WORKING', 'REVIEW', 'COMPLETED', 'REJECTED'];

export default function TasksPage() {
  const { accessToken, isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  // Form states
  const [formTitle, setFormTitle] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formPriority, setFormPriority] = useState<Task['priority']>('LOW');
  const [formDeadline, setFormDeadline] = useState('');
  const [formAssigneeId, setFormAssigneeId] = useState('');

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

  const fetchPageData = useCallback(async () => {
    if (!accessToken) return;
    try {
      setPageLoading(true);
      // Fetch tasks
      const taskRes = await fetch(`${API}/tasks`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (taskRes.ok) {
        const data = await taskRes.json();
        setTasks(data.tasks || []);
      }

      // Fetch employees for select dropdown (Admins only)
      if (user?.role === 'ADMIN') {
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
  }, [accessToken, user]);

  useEffect(() => {
    if (isAuthenticated && accessToken) {
      fetchPageData();
    }
  }, [isAuthenticated, accessToken, fetchPageData]);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) return;
    setErrorMessage('');
    setSuccessMessage('');
    setActionLoading(true);

    try {
      const res = await fetch(`${API}/tasks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          title: formTitle,
          description: formDescription || undefined,
          priority: formPriority,
          deadline: formDeadline || undefined,
          assigneeId: formAssigneeId || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create task');
      }

      setTasks([data.task, ...tasks]);
      setSuccessMessage('Task created successfully.');
      
      // Cleanup
      setFormTitle('');
      setFormDescription('');
      setFormPriority('LOW');
      setFormDeadline('');
      setFormAssigneeId('');
      
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

  const openEditModal = (task: Task) => {
    setSelectedTask(task);
    setFormTitle(task.title);
    setFormDescription(task.description || '');
    setFormPriority(task.priority);
    setFormDeadline(task.deadline ? new Date(task.deadline).toISOString().substring(0, 16) : '');
    setFormAssigneeId(task.assigneeId || '');
    setErrorMessage('');
    setSuccessMessage('');
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask || !formTitle.trim()) return;
    setErrorMessage('');
    setSuccessMessage('');
    setActionLoading(true);

    try {
      const res = await fetch(`${API}/tasks/${selectedTask.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          title: formTitle,
          description: formDescription || undefined,
          priority: formPriority,
          deadline: formDeadline || undefined,
          assigneeId: formAssigneeId || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update task');
      }

      setTasks(tasks.map(t => t.id === selectedTask.id ? { ...t, ...data.task } : t));
      setSuccessMessage('Task details updated.');
      setTimeout(() => {
        setIsEditModalOpen(false);
        setSelectedTask(null);
        setSuccessMessage('');
      }, 1000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error occurred');
    } finally {
      setActionLoading(false);
    }
  };

  const handleStatusChange = async (taskId: string, nextStatus: Task['status']) => {
    try {
      const res = await fetch(`${API}/tasks/${taskId}/status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (res.ok) {
        const data = await res.json();
        setTasks(tasks.map(t => t.id === taskId ? { ...t, status: data.task.status } : t));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (task: Task) => {
    if (!confirm(`Are you sure you want to delete task: ${task.title}?`)) return;
    try {
      const res = await fetch(`${API}/tasks/${task.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        setTasks(tasks.filter(t => t.id !== task.id));
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to delete task');
      }
    } catch (err) {
      console.error(err);
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
            Loading tasks list...
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
              Project <span className="gradient-text">Tasks</span>
            </h1>
            <p className="text-white/40 mt-1 text-sm">Assign work items, configure status progress, and trace deadlines.</p>
          </div>
          {isAdmin && (
            <button
              onClick={() => {
                setFormTitle('');
                setFormDescription('');
                setFormPriority('LOW');
                setFormDeadline('');
                setFormAssigneeId('');
                setErrorMessage('');
                setSuccessMessage('');
                setIsAddModalOpen(true);
              }}
              className="btn-primary flex items-center justify-center gap-2 self-start"
            >
              <Plus size={18} />
              Add Task
            </button>
          )}
        </div>

        {/* Tasks columns / boards */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          {STATUSES.map((status) => {
            const statusTasks = tasks.filter(t => t.status === status);
            let statusBadge = 'badge-blue';
            if (status === 'WORKING') statusBadge = 'badge-purple';
            if (status === 'REVIEW') statusBadge = 'badge-yellow';
            if (status === 'COMPLETED') statusBadge = 'badge-green';
            if (status === 'REJECTED') statusBadge = 'badge-red';

            return (
              <div key={status} className="bg-white/03 border border-white/05 rounded-2xl p-4 flex flex-col min-h-[500px]">
                <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/05">
                  <span className={`badge ${statusBadge}`}>{status}</span>
                  <span className="text-xs text-white/30 font-bold">{statusTasks.length}</span>
                </div>

                <div className="space-y-3 flex-1 overflow-y-auto">
                  {statusTasks.map((task) => (
                    <div key={task.id} className="glass-card p-4 flex flex-col justify-between cursor-pointer border border-white/05 hover:border-indigo-500/20">
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h4 className="font-semibold text-sm leading-tight text-white">{task.title}</h4>
                          <span className={`text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded ${
                            task.priority === 'URGENT' ? 'bg-red-500/20 text-red-400' :
                            task.priority === 'HIGH' ? 'bg-yellow-500/20 text-yellow-400' :
                            'bg-blue-500/20 text-blue-400'
                          }`}>{task.priority}</span>
                        </div>
                        {task.description && (
                          <p className="text-white/40 text-xs line-clamp-3 mb-4">{task.description}</p>
                        )}
                      </div>

                      <div className="space-y-2 mt-auto">
                        {task.deadline && (
                          <div className="flex items-center gap-1.5 text-[10px] text-white/30">
                            <Calendar size={12} />
                            {new Date(task.deadline).toLocaleDateString()}
                          </div>
                        )}
                        <div className="flex items-center justify-between border-t border-white/05 pt-2">
                          <span className="text-[10px] text-white/30">
                            Assigned to: <span className="font-semibold text-indigo-400">{task.assignee?.username || 'Unassigned'}</span>
                          </span>
                        </div>

                        {/* Status switcher selector */}
                        <div className="flex items-center gap-1.5 pt-2 justify-end">
                          <select
                            value={task.status}
                            onChange={(e) => handleStatusChange(task.id, e.target.value as Task['status'])}
                            className="bg-neutral-900 border border-white/10 rounded px-1 py-0.5 text-[10px] text-white outline-none"
                          >
                            {STATUSES.map(s => (
                              <option key={s} value={s} style={{ backgroundColor: '#0a0a1a', color: '#f8fafc' }}>{s}</option>
                            ))}
                          </select>
                          {isAdmin && (
                            <>
                              <button onClick={() => openEditModal(task)} className="p-1 hover:bg-white/10 rounded text-white/60 hover:text-white"><Edit2 size={12} /></button>
                              <button onClick={() => handleDelete(task)} className="p-1 hover:bg-red-500/10 rounded text-red-400/60 hover:text-red-400"><Trash2 size={12} /></button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                  {statusTasks.length === 0 && (
                    <div className="text-center py-8 text-white/10 text-xs">
                      No items
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Modal: Add Task */}
        {isAddModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="glass-card max-w-md w-full p-6 relative">
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="absolute top-4 right-4 text-white/40 hover:text-white"
              >
                <X size={18} />
              </button>

              <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                <ClipboardList size={20} className="text-indigo-400" />
                New Project Task
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
                    placeholder="e.g. Design Dashboard UI"
                    className="input-glass"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Description</label>
                  <textarea
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Brief summary of required steps..."
                    className="input-glass h-24 resize-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Priority</label>
                    <select
                      value={formPriority}
                      onChange={(e) => setFormPriority(e.target.value as Task['priority'])}
                      className="input-glass bg-neutral-900 border-white/10 text-white"
                    >
                      <option value="LOW" style={{ backgroundColor: '#0a0a1a', color: '#f8fafc' }}>LOW</option>
                      <option value="HIGH" style={{ backgroundColor: '#0a0a1a', color: '#f8fafc' }}>HIGH</option>
                      <option value="URGENT" style={{ backgroundColor: '#0a0a1a', color: '#f8fafc' }}>URGENT</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Deadline</label>
                    <input
                      type="datetime-local"
                      value={formDeadline}
                      onChange={(e) => setFormDeadline(e.target.value)}
                      className="input-glass bg-neutral-900 border-white/10 text-white"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Assignee</label>
                  <select
                    value={formAssigneeId}
                    onChange={(e) => setFormAssigneeId(e.target.value)}
                    className="input-glass bg-neutral-900 border-white/10 text-white"
                  >
                    <option value="" style={{ backgroundColor: '#0a0a1a', color: '#f8fafc' }}>Select Assignee</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id} style={{ backgroundColor: '#0a0a1a', color: '#f8fafc' }}>
                        {emp.username} (#{emp.employeeId})
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={actionLoading}
                  className="btn-primary w-full mt-4"
                >
                  {actionLoading ? 'Creating...' : 'Create Task'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Edit Task */}
        {isEditModalOpen && selectedTask && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="glass-card max-w-md w-full p-6 relative">
              <button
                onClick={() => {
                  setIsEditModalOpen(false);
                  setSelectedTask(null);
                }}
                className="absolute top-4 right-4 text-white/40 hover:text-white"
              >
                <X size={18} />
              </button>

              <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                <ClipboardList size={20} className="text-indigo-400" />
                Modify Task details
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

              <form onSubmit={handleEditSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Title</label>
                  <input
                    type="text"
                    required
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    className="input-glass"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Description</label>
                  <textarea
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    className="input-glass h-24 resize-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Priority</label>
                    <select
                      value={formPriority}
                      onChange={(e) => setFormPriority(e.target.value as Task['priority'])}
                      className="input-glass bg-neutral-900 border-white/10 text-white"
                    >
                      <option value="LOW" style={{ backgroundColor: '#0a0a1a', color: '#f8fafc' }}>LOW</option>
                      <option value="HIGH" style={{ backgroundColor: '#0a0a1a', color: '#f8fafc' }}>HIGH</option>
                      <option value="URGENT" style={{ backgroundColor: '#0a0a1a', color: '#f8fafc' }}>URGENT</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Deadline</label>
                    <input
                      type="datetime-local"
                      value={formDeadline}
                      onChange={(e) => setFormDeadline(e.target.value)}
                      className="input-glass bg-neutral-900 border-white/10 text-white"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Assignee</label>
                  <select
                    value={formAssigneeId}
                    onChange={(e) => setFormAssigneeId(e.target.value)}
                    className="input-glass bg-neutral-900 border-white/10 text-white"
                  >
                    <option value="" style={{ backgroundColor: '#0a0a1a', color: '#f8fafc' }}>Select Assignee</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id} style={{ backgroundColor: '#0a0a1a', color: '#f8fafc' }}>
                        {emp.username} (#{emp.employeeId})
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="submit"
                  disabled={actionLoading}
                  className="btn-primary w-full mt-4"
                >
                  {actionLoading ? 'Saving changes...' : 'Save Profile Changes'}
                </button>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
