'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Sidebar from '@/components/Sidebar';
import ProtectedRoute from '@/components/ProtectedRoute';
import { User, Key, Check, AlertCircle, Camera } from 'lucide-react';

const API = process.env.NEXT_PUBLIC_API_URL || 'https://ems-backend-z3bv.onrender.com/api';

function SettingsContent() {
  const { accessToken, isAuthenticated, isLoading, user, changePassword, updateUserPhoto } = useAuth();
  const router = useRouter();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [photoInput, setPhotoInput] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [photoLoading, setPhotoLoading] = useState(false);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/');
    }
  }, [isAuthenticated, isLoading, router]);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (newPassword !== confirmPassword) {
      setErrorMessage('New passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      setErrorMessage('New password must be at least 6 characters long');
      return;
    }

    setActionLoading(true);
    try {
      await changePassword(currentPassword, newPassword);
      setSuccessMessage('Password changed successfully.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to change password');
    } finally {
      setActionLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        setPhotoInput(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleUpdatePhoto = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!photoInput) return;
    setPhotoLoading(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const res = await fetch(`${API}/employees/me/profile-image`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ photoUrl: photoInput }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update avatar');
      if (updateUserPhoto) updateUserPhoto(photoInput);
      setSuccessMessage('Profile picture updated successfully.');
      setPhotoInput('');
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setPhotoLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen bg-black text-white">
        <Sidebar />
        <main className="flex-1 pt-24 pb-28 px-6 md:px-8 flex items-center justify-center">
          <div className="text-cyan-400 animate-pulse">Loading account preferences...</div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-black text-white">
      <Sidebar />

      <main className="flex-1 pt-24 pb-28 px-6 md:px-8 max-w-6xl mx-auto w-full">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 fade-in-up border-b border-cyan-500/20 pb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
              Account <span className="gradient-text">Settings</span>
            </h1>
            <p className="text-white/60 mt-1 text-sm">Update credentials and profile picture.</p>
          </div>
        </div>

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

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Profile Picture & Overview Card */}
          <div className="glass-card p-6 border-cyan-500/30">
            <h3 className="text-lg font-bold mb-6 flex items-center gap-2 text-cyan-400">
              <User size={20} />
              Profile Picture & Overview
            </h3>

            <div className="space-y-6">
              <div className="flex items-center gap-4 pb-6 border-b border-cyan-500/20">
                <div className="w-20 h-20 rounded-full bg-cyan-500/20 border-2 border-cyan-400 flex items-center justify-center text-2xl font-bold text-white shrink-0 overflow-hidden shadow-[0_0_20px_rgba(0,240,255,0.4)]">
                  {(photoInput || user?.photoUrl) ? (
                    <img src={photoInput || user?.photoUrl} alt={user?.username} className="w-full h-full object-cover" />
                  ) : (
                    user?.username?.charAt(0).toUpperCase()
                  )}
                </div>
                <div>
                  <h4 className="font-bold text-lg text-white">{user?.username}</h4>
                  <p className="text-xs text-cyan-400 font-mono">Employee ID: #{user?.employeeId}</p>
                  <span className="badge badge-purple mt-1.5">{user?.role}</span>
                </div>
              </div>

              {/* Upload Image Section */}
              <form onSubmit={handleUpdatePhoto} className="space-y-4">
                <label className="block text-xs font-semibold text-cyan-400 uppercase tracking-wider">Upload New Avatar / Profile Photo</label>
                
                <div className="flex flex-col gap-3">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="text-xs text-white/70 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-cyan-500/20 file:text-cyan-300 hover:file:bg-cyan-500/30 cursor-pointer"
                  />

                  <div className="text-xs text-white/40 font-semibold text-center">— OR ENTER IMAGE URL —</div>

                  <input
                    type="text"
                    placeholder="https://example.com/avatar.jpg or base64"
                    value={photoInput}
                    onChange={(e) => setPhotoInput(e.target.value)}
                    className="input-glass text-xs"
                  />
                </div>

                <button
                  type="submit"
                  disabled={photoLoading || !photoInput}
                  className="btn-primary w-full py-2.5 text-xs font-bold flex items-center justify-center gap-2"
                >
                  <Camera size={16} />
                  {photoLoading ? 'Updating Avatar...' : 'Save Profile Picture'}
                </button>
              </form>
            </div>
          </div>

          {/* Change Password Card */}
          <div className="glass-card p-6 border-purple-500/30">
            <h3 className="text-lg font-bold mb-6 flex items-center gap-2 text-purple-400">
              <Key size={20} />
              Change Password
            </h3>

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-white/70 uppercase tracking-wider mb-2">Current Password</label>
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="input-glass"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-white/70 uppercase tracking-wider mb-2">New Password</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="input-glass"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-white/70 uppercase tracking-wider mb-2">Confirm New Password</label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="input-glass"
                />
              </div>

              <button
                type="submit"
                disabled={actionLoading}
                className="btn-primary w-full mt-4 py-3 font-bold text-sm"
              >
                {actionLoading ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <ProtectedRoute>
      <SettingsContent />
    </ProtectedRoute>
  );
}
