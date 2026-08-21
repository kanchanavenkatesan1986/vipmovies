import React, { useState } from 'react';
import { GlassCard } from '../components/common/GlassCard';
import { Button } from '../components/common/Button';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { logActivity } from '../api/moviesApi';
import { User, Mail, Lock, Shield, Save, Camera } from 'lucide-react';

export default function ProfilePage() {
  const { user, role, switchRole } = useAuth();
  const { addToast } = useToast();

  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [saving, setSaving] = useState(false);

  const roles = ['Super Admin', 'Editor', 'Uploader', 'Viewer'];

  const handleSaveProfile = async () => {
    if (!name.trim() || !email.trim()) {
      addToast('Name and email are required', 'error');
      return;
    }
    setSaving(true);
    await new Promise(r => setTimeout(r, 600));
    logActivity('Profile Updated', `Updated display name to "${name}"`);
    addToast('Profile updated successfully!', 'success');
    setSaving(false);
  };

  const handleChangePassword = async () => {
    if (!currentPw || !newPw || !confirmPw) {
      addToast('Please fill all password fields', 'error');
      return;
    }
    if (newPw !== confirmPw) {
      addToast('New passwords do not match', 'error');
      return;
    }
    if (newPw.length < 6) {
      addToast('Password must be at least 6 characters', 'error');
      return;
    }
    setSaving(true);
    await new Promise(r => setTimeout(r, 600));
    setCurrentPw(''); setNewPw(''); setConfirmPw('');
    logActivity('Password Changed', 'User changed their account password');
    addToast('Password changed successfully!', 'success');
    setSaving(false);
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl">
      <div>
        <h1 className="text-2xl font-extrabold text-white">My Profile</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Manage your account and security settings</p>
      </div>

      {/* Avatar & Identity */}
      <GlassCard hover={false}>
        <div className="flex items-center gap-5">
          <div className="relative">
            <img
              src={user?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${email}`}
              alt="Avatar"
              className="w-20 h-20 rounded-2xl border-2 border-red-600/50 object-cover"
            />
            <button className="absolute -bottom-2 -right-2 p-1.5 bg-red-600 rounded-lg text-white hover:bg-red-500 transition-colors shadow-lg">
              <Camera className="w-3.5 h-3.5" />
            </button>
          </div>
          <div>
            <p className="text-xl font-extrabold text-white">{user?.name || 'Admin'}</p>
            <p className="text-sm text-zinc-400">{user?.email}</p>
            <div className="flex items-center gap-1.5 mt-2">
              <Shield className="w-4 h-4 text-red-400" />
              <span className="text-sm font-semibold text-red-400">{role}</span>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Edit Profile */}
      <GlassCard hover={false}>
        <h3 className="font-bold text-white mb-4 flex items-center gap-2">
          <User className="w-5 h-5 text-red-400" />
          Profile Information
        </h3>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block mb-1.5">Display Name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full bg-zinc-900/70 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-red-600/70 transition-all"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block mb-1.5">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full bg-zinc-900/70 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-red-600/70 transition-all"
            />
          </div>
          <div className="flex justify-end">
            <Button variant="primary" icon={Save} loading={saving} onClick={handleSaveProfile}>
              Save Profile
            </Button>
          </div>
        </div>
      </GlassCard>

      {/* Change Password */}
      <GlassCard hover={false}>
        <h3 className="font-bold text-white mb-4 flex items-center gap-2">
          <Lock className="w-5 h-5 text-amber-400" />
          Change Password
        </h3>
        <div className="space-y-4">
          {[
            { label: 'Current Password', value: currentPw, set: setCurrentPw },
            { label: 'New Password', value: newPw, set: setNewPw },
            { label: 'Confirm New Password', value: confirmPw, set: setConfirmPw },
          ].map(f => (
            <div key={f.label}>
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-wider block mb-1.5">{f.label}</label>
              <input
                type="password"
                value={f.value}
                onChange={e => f.set(e.target.value)}
                className="w-full bg-zinc-900/70 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-200 focus:outline-none focus:border-red-600/70 transition-all"
              />
            </div>
          ))}
          <div className="flex justify-end">
            <Button variant="secondary" icon={Lock} loading={saving} onClick={handleChangePassword}>
              Update Password
            </Button>
          </div>
        </div>
      </GlassCard>

      {/* Role Management */}
      <GlassCard hover={false}>
        <h3 className="font-bold text-white mb-4 flex items-center gap-2">
          <Shield className="w-5 h-5 text-purple-400" />
          Permissions &amp; Role
        </h3>
        <div className="space-y-3">
          {roles.map(r => (
            <div
              key={r}
              className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                role === r
                  ? 'border-red-600/50 bg-red-950/20'
                  : 'border-zinc-800/60 hover:border-zinc-700'
              }`}
              onClick={() => switchRole(r)}
            >
              <div>
                <p className={`text-sm font-bold ${role === r ? 'text-red-400' : 'text-zinc-300'}`}>{r}</p>
                <p className="text-[11px] text-zinc-500 mt-0.5">
                  {r === 'Super Admin' && 'Full access: CRUD, settings, notifications, backup'}
                  {r === 'Editor' && 'Can add, edit, scan links and send notifications'}
                  {r === 'Uploader' && 'Can only add new movies and upload images'}
                  {r === 'Viewer' && 'Read-only access to the catalogue'}
                </p>
              </div>
              {role === r && (
                <span className="text-[11px] font-bold px-2.5 py-1 bg-red-600/25 text-red-400 border border-red-700/50 rounded-full">
                  Active
                </span>
              )}
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}
