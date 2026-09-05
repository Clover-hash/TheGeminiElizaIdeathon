import React, { useState } from 'react';
import { 
  User, 
  Database, 
  ShieldCheck, 
  Save, 
  Check, 
  Copy, 
  Calendar, 
  Clock, 
  Heart, 
  Sparkles, 
  X,
  Layers
} from 'lucide-react';
import { AppUser, CharacterId } from '../types';
import { CHARACTERS } from '../data/characters';
import { updateUserProfile } from '../services/firestoreService';
import { ROLE_COLORS } from '../data/adminDirectives';

interface UserProfileModalProps {
  user: AppUser;
  isOpen: boolean;
  onClose: () => void;
  onUserUpdated: (updatedUser: AppUser) => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  user,
  isOpen,
  onClose,
  onUserUpdated,
}) => {
  const [displayName, setDisplayName] = useState(user.displayName || '');
  const [preferredCompanion, setPreferredCompanion] = useState<CharacterId>(
    user.preferredCompanion || 'deredere'
  );
  const [reflectionIntention, setReflectionIntention] = useState(
    user.reflectionIntention || 'Cultivate mindful awareness and emotional clarity.'
  );
  const [reflectionFrequency, setReflectionFrequency] = useState<
    'daily' | 'thrice_weekly' | 'weekly' | 'casual'
  >(user.reflectionFrequency || 'daily');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copiedUid, setCopiedUid] = useState(false);

  if (!isOpen) return null;

  const roleColor = ROLE_COLORS[user.role || 'user'];

  const handleCopyUid = () => {
    navigator.clipboard.writeText(user.uid);
    setCopiedUid(true);
    setTimeout(() => setCopiedUid(false), 2000);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);
    setErrorMessage(null);

    try {
      const updated = await updateUserProfile(user.uid, {
        displayName: displayName.trim() || 'Reflective User',
        preferredCompanion,
        reflectionIntention: reflectionIntention.trim(),
        reflectionFrequency,
      });

      onUserUpdated(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Profile update error:', err);
      setErrorMessage(err instanceof Error ? err.message : 'Failed to save changes to Firestore.');
    } finally {
      setIsSaving(false);
    }
  };

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return 'Just now';
    return new Date(timestamp).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl max-w-xl w-full max-h-[90vh] flex flex-col border border-slate-200/80 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-xs">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Firestore User Profile</h3>
              <p className="text-xs text-slate-500 flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-emerald-600" />
                <span>Cloud Firestore: <code className="font-mono text-[11px] text-emerald-700 bg-emerald-50 px-1 py-0.5 rounded">users/{user.uid}</code></span>
              </p>
            </div>
          </div>
          <button
            id="close-profile-modal-btn"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-800">
          {/* Status Banners */}
          {saveSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>User profile and preferences saved to Cloud Firestore successfully.</span>
            </div>
          )}

          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs">
              {errorMessage}
            </div>
          )}

          {/* Account Metadata Card */}
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/70 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'User'}
                    className="w-12 h-12 rounded-2xl border border-slate-200 object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-bold text-lg">
                    {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">{user.displayName || 'Reflective User'}</h4>
                  <p className="text-xs text-slate-500">{user.email || 'Anonymous Guest Account'}</p>
                </div>
              </div>
              <span className={`px-2.5 py-1 text-xs font-bold rounded-lg border uppercase tracking-wider ${roleColor.badge} ${roleColor.border}`}>
                {user.role || 'user'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-200/60 text-xs">
              <div className="flex items-center justify-between bg-white px-3 py-1.5 rounded-xl border border-slate-200/60">
                <span className="text-slate-500 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" /> Joined:
                </span>
                <span className="font-medium text-slate-700">{formatDate(user.createdAt)}</span>
              </div>
              <div className="flex items-center justify-between bg-white px-3 py-1.5 rounded-xl border border-slate-200/60">
                <span className="text-slate-500 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-400" /> Last Active:
                </span>
                <span className="font-medium text-slate-700">{formatDate(user.lastLoginAt)}</span>
              </div>
            </div>

            <div className="flex items-center justify-between bg-white px-3 py-1.5 rounded-xl border border-slate-200/60 text-xs">
              <span className="text-slate-500 font-mono text-[11px]">UID: {user.uid}</span>
              <button
                type="button"
                id="copy-user-uid-btn"
                onClick={handleCopyUid}
                className="flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800"
              >
                {copiedUid ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                <span>{copiedUid ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

          {/* Form */}
          <form id="user-profile-form" onSubmit={handleSave} className="space-y-4">
            <div>
              <label htmlFor="profile-display-name-input" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Display Name
              </label>
              <input
                id="profile-display-name-input"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={40}
                required
                className="w-full px-3.5 py-2 rounded-xl text-sm border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-white"
                placeholder="Your Name or Journal Moniker"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Preferred Companion
              </label>
              <div className="grid grid-cols-2 gap-2">
                {CHARACTERS.map((char) => {
                  const isSelected = preferredCompanion === char.id;
                  return (
                    <button
                      key={char.id}
                      type="button"
                      id={`pref-companion-${char.id}-btn`}
                      onClick={() => setPreferredCompanion(char.id)}
                      className={`flex items-center gap-2.5 p-2 rounded-xl text-left border transition-all ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-50/50 shadow-xs'
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <img
                        src={char.avatarUrl}
                        alt={char.name}
                        className="w-8 h-8 rounded-full object-cover border border-slate-200 shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 truncate">{char.name}</p>
                        <p className="text-[10px] text-slate-500 truncate">{char.badge}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label htmlFor="profile-intention-input" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Reflection Intention / Purpose
              </label>
              <input
                id="profile-intention-input"
                type="text"
                value={reflectionIntention}
                onChange={(e) => setReflectionIntention(e.target.value)}
                maxLength={100}
                className="w-full px-3.5 py-2 rounded-xl text-sm border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-white"
                placeholder="e.g. Cultivate mindful awareness and emotional clarity."
              />
            </div>

            <div>
              <label htmlFor="profile-frequency-select" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Reflection Goal Cadence
              </label>
              <select
                id="profile-frequency-select"
                value={reflectionFrequency}
                onChange={(e) => setReflectionFrequency(e.target.value as any)}
                className="w-full px-3.5 py-2 rounded-xl text-sm border border-slate-300 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option value="daily">Daily Reflections (Morning & Evening)</option>
                <option value="thrice_weekly">3 Times per Week</option>
                <option value="weekly">Weekly Deep Dive</option>
                <option value="casual">Casual / As Needed</option>
              </select>
            </div>

            {/* Footer Buttons */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                id="cancel-profile-btn"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                id="save-profile-btn"
                disabled={isSaving}
                className="flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-xs disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Saving to Firestore...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    <span>Save to Cloud Firestore</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
