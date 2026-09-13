'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Sidebar from '@/components/Sidebar';
import { Building2, Plus, Edit2, Trash2, X, Check, AlertCircle } from 'lucide-react';

interface Department {
  id: string;
  name: string;
  _count?: {
    users: number;
  };
}

const API = process.env.NEXT_PUBLIC_API_URL || 'https://ems-backend-z3bv.onrender.com/api';

export default function DepartmentsPage() {
  const { accessToken, isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();

  const [departments, setDepartments] = useState<Department[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedDept, setSelectedDept] = useState<Department | null>(null);

  const [formName, setFormName] = useState('');
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

  const fetchDepartments = useCallback(async () => {
    if (!accessToken) return;
    try {
      setPageLoading(true);
      const res = await fetch(`${API}/departments`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setDepartments(data.departments || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setPageLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (isAuthenticated && accessToken) {
      fetchDepartments();
    }
  }, [isAuthenticated, accessToken, fetchDepartments]);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;
    setErrorMessage('');
    setSuccessMessage('');
    setActionLoading(true);

    try {
      const res = await fetch(`${API}/departments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ name: formName }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create department');
      }

      setDepartments([...departments, data.department]);
      setSuccessMessage('Department created successfully.');
      setFormName('');
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

  const openEditModal = (dept: Department) => {
    setSelectedDept(dept);
    setFormName(dept.name);
    setErrorMessage('');
    setSuccessMessage('');
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDept || !formName.trim()) return;
    setErrorMessage('');
    setSuccessMessage('');
    setActionLoading(true);

    try {
      const res = await fetch(`${API}/departments/${selectedDept.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ name: formName }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update department');
      }

      setDepartments(departments.map(d => d.id === selectedDept.id ? { ...d, name: data.department.name } : d));
      setSuccessMessage('Department details updated.');
      setFormName('');
      setTimeout(() => {
        setIsEditModalOpen(false);
        setSelectedDept(null);
        setSuccessMessage('');
      }, 1000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error occurred');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async (dept: Department) => {
    if (!confirm(`Are you sure you want to delete ${dept.name}?`)) return;
    try {
      const res = await fetch(`${API}/departments/${dept.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        setDepartments(departments.filter(d => d.id !== dept.id));
      } else {
        const err = await res.json();
        alert(err.error || 'Failed to delete department');
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
            Loading departments list...
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
              Company <span className="gradient-text">Departments</span>
            </h1>
            <p className="text-white/40 mt-1 text-sm">Organize and manage software development teams and agency units.</p>
          </div>
          {isAdmin && (
            <button
              onClick={() => {
                setFormName('');
                setErrorMessage('');
                setSuccessMessage('');
                setIsAddModalOpen(true);
              }}
              className="btn-primary flex items-center justify-center gap-2 self-start"
            >
              <Plus size={18} />
              Add Department
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {departments.map((dept, i) => (
            <div key={dept.id} className={`glass-card p-6 flex flex-col justify-between fade-in-up delay-${(i + 1) * 100}`}>
              <div>
                <div className="w-12 h-12 rounded-xl mb-4 flex items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600">
                  <Building2 size={24} className="text-white" />
                </div>
                <h3 className="text-lg font-bold mb-1">{dept.name}</h3>
                <p className="text-white/40 text-sm">{dept._count?.users || 0} active members</p>
              </div>

              {isAdmin && (
                <div className="flex items-center gap-2 mt-6 pt-4 border-t border-white/05 justify-end">
                  <button
                    onClick={() => openEditModal(dept)}
                    className="p-2 hover:bg-white/10 rounded-lg text-white/60 hover:text-white transition-colors"
                    title="Edit name"
                  >
                    <Edit2 size={15} />
                  </button>
                  <button
                    onClick={() => handleDelete(dept)}
                    className="p-2 hover:bg-red-500/10 rounded-lg text-red-400/60 hover:text-red-400 transition-colors"
                    title="Delete"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              )}
            </div>
          ))}
          {departments.length === 0 && (
            <div className="col-span-full glass-card py-16 text-center text-white/20 text-sm">
              No departments found in the system.
            </div>
          )}
        </div>

        {/* Modal: Add Department */}
        {isAddModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="glass-card max-w-sm w-full p-6 relative">
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="absolute top-4 right-4 text-white/40 hover:text-white"
              >
                <X size={18} />
              </button>

              <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                <Building2 size={20} className="text-indigo-400" />
                New Department
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
                  <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Name</label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Sales"
                    className="input-glass"
                  />
                </div>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="btn-primary w-full"
                >
                  {actionLoading ? 'Creating...' : 'Create Department'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Edit Department */}
        {isEditModalOpen && selectedDept && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="glass-card max-w-sm w-full p-6 relative">
              <button
                onClick={() => {
                  setIsEditModalOpen(false);
                  setSelectedDept(null);
                }}
                className="absolute top-4 right-4 text-white/40 hover:text-white"
              >
                <X size={18} />
              </button>

              <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                <Building2 size={20} className="text-indigo-400" />
                Rename Department
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
                  <label className="block text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">Name</label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="input-glass"
                  />
                </div>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="btn-primary w-full"
                >
                  {actionLoading ? 'Saving...' : 'Rename'}
                </button>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
