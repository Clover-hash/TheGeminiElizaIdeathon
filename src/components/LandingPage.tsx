import React, { useState } from 'react';
import { 
  Sparkles, 
  ShieldCheck, 
  Lock, 
  Cpu,
  Heart,
  MessageCircle,
  FileCheck2,
  Users,
  Smile,
  KeyRound
} from 'lucide-react';
import { loginWithGoogle, loginDemoUser } from '../lib/firebase';
import { ThreatModelModal } from './ThreatModelModal';
import { AdminLoginModal } from './AdminLoginModal';
import { CHARACTERS } from '../data/characters';
import { AppUser } from '../types';

interface LandingPageProps {
  onLoginSuccess: () => void;
  onAdminLoginSuccess?: (adminUser: AppUser) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onLoginSuccess, onAdminLoginSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showThreatModel, setShowThreatModel] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [customUser, setCustomUser] = useState('');

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      await loginWithGoogle();
      onLoginSuccess();
    } catch (err: unknown) {
      console.error('Sign-in error:', err);
      setError((err as Error)?.message || 'Sign in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoSignIn = async (name?: string) => {
    setLoading(true);
    setError(null);
    try {
      await loginDemoUser(name || customUser || 'Mindful Journaler', 'user');
      onLoginSuccess();
    } catch (err: unknown) {
      setError((err as Error)?.message || 'Quick login failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleAdminSuccess = (adminUser: AppUser) => {
    if (onAdminLoginSuccess) {
      onAdminLoginSuccess(adminUser);
    } else {
      onLoginSuccess();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50 flex flex-col justify-between selection:bg-indigo-100 selection:text-indigo-900">
      {/* Top Banner */}
      <header className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-200">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xl font-extrabold text-slate-900 tracking-tight">Gemini Reflect</span>
            <span className="block text-xs text-slate-500 font-medium">Journaling &amp; Reflecting with an AI Companion</span>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Dedicated Admin Login Trigger */}
          <button
            id="landing-admin-login-btn"
            onClick={() => setShowAdminLogin(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 transition-colors"
            title="Administrator Login (Requires Username & Password)"
          >
            <Lock className="w-3.5 h-3.5 text-indigo-600" />
            <span>Admin Login</span>
          </button>

          <button
            id="landing-threat-model-btn"
            onClick={() => setShowThreatModel(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span className="hidden sm:inline">Threat Model &amp; Security</span>
            <span className="sm:hidden">Security</span>
          </button>
        </div>
      </header>

      {/* Main Content Hero */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col items-center text-center">
        {/* Security / Technology Pill */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-semibold mb-6 shadow-2xs">
          <Cpu className="w-4 h-4" />
          <span>Gemini 3.6 Flash &bull; AI Companion Journaling &bull; Isolated Firestore Storage</span>
        </div>

        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-900 tracking-tight max-w-3xl leading-tight">
          Journaling and Reflecting with an AI Companion.
        </h1>

        <p className="mt-5 text-base sm:text-lg text-slate-600 max-w-2xl leading-relaxed">
          Journal your daily experiences and reflect deeply alongside an AI companion. Connect with curated personality archetypes—from affectionate warmth to calm contemplation, mature guidance, and grounded vulnerability. Converse, co-write shared reflections, and gain mindful emotional insights in complete privacy.
        </p>

        {/* Character Avatar Showcase Carousel */}
        <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl w-full">
          {CHARACTERS.map((char) => (
            <div
              key={char.id}
              className="bg-white rounded-2xl p-3 border border-slate-200 shadow-xs flex flex-col items-center text-center group hover:scale-105 transition-transform"
            >
              <img
                src={char.avatarUrl}
                alt={char.name}
                referrerPolicy="no-referrer"
                className="w-14 h-14 rounded-2xl object-cover ring-2 ring-slate-100 mb-2"
              />
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white mb-1"
                style={{ backgroundColor: char.themeColor.primary }}
              >
                {char.badge}
              </span>
              <span className="text-xs font-bold text-slate-800">{char.name}</span>
            </div>
          ))}
        </div>

        {/* Authentication Card */}
        <div className="mt-8 w-full max-w-md bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xl shadow-slate-100/80">
          <div className="space-y-4">
            <button
              id="google-signin-btn"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full flex items-center justify-center gap-3 px-6 py-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-base shadow-md hover:shadow-lg transition-all active:scale-[0.99] disabled:opacity-70 cursor-pointer"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>{loading ? 'Authenticating...' : 'Sign In with Google'}</span>
            </button>

            {/* Quick multi-user test login helper */}
            <div className="pt-4 border-t border-slate-100 text-left">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Instant Sandbox &amp; Multi-User Evaluation:
              </p>
              <div className="flex gap-2">
                <input
                  id="demo-user-input"
                  type="text"
                  placeholder="e.g. Alice or Bob"
                  value={customUser}
                  onChange={(e) => setCustomUser(e.target.value)}
                  className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
                <button
                  id="demo-signin-btn"
                  onClick={() => handleDemoSignIn()}
                  disabled={loading}
                  className="px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 transition-colors"
                >
                  Enter Experience
                </button>
              </div>
              <p className="text-[11px] text-slate-400 mt-2">
                Simulate different users to verify complete privacy and isolated Firestore interactions.
              </p>
            </div>
          </div>

          {error && (
            <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-medium text-left">
              {error}
            </div>
          )}
        </div>

        {/* Feature Grid */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 text-left max-w-4xl w-full">
          <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs">
            <div className="w-10 h-10 rounded-2xl bg-pink-50 text-pink-600 flex items-center justify-center mb-4">
              <Heart className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-base">4 AI Companion Archetypes</h3>
            <p className="text-sm text-slate-600 mt-2 leading-relaxed">
              Reflect with empathetic AI companions—from affectionate encouragement to calm inquiry, mature guidance, and authentic partnership.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4">
              <Lock className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-base">User-Isolated Firestore</h3>
            <p className="text-sm text-slate-600 mt-2 leading-relaxed">
              Journal entries and companion chats are saved strictly under <code className="text-xs bg-slate-100 px-1 py-0.5 rounded font-mono text-indigo-600">/users/&#123;userId&#125;/interactions</code> with owner-bound rules.
            </p>
          </div>

          <div className="p-6 rounded-3xl bg-white border border-slate-200/80 shadow-xs">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4">
              <FileCheck2 className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-slate-900 text-base">Collaborative Journal Notes</h3>
            <p className="text-sm text-slate-600 mt-2 leading-relaxed">
              Co-write daily reflections with your AI companion, preserve thoughts in isolated notebooks, and synthesize emotional growth.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
        <p>Gemini Reflect &bull; Journaling and Reflecting with an AI Companion &bull; Google Cloud Run &bull; Firebase Auth &bull; Cloud Firestore</p>
        <button
          id="footer-admin-login-btn"
          onClick={() => setShowAdminLogin(true)}
          className="flex items-center gap-1.5 text-slate-400 hover:text-indigo-600 transition-colors cursor-pointer"
        >
          <Lock className="w-3.5 h-3.5" />
          <span>Admin Portal Login</span>
        </button>
      </footer>

      <ThreatModelModal isOpen={showThreatModel} onClose={() => setShowThreatModel(false)} />
      <AdminLoginModal
        isOpen={showAdminLogin}
        onClose={() => setShowAdminLogin(false)}
        onAdminLoginSuccess={handleAdminSuccess}
      />
    </div>
  );
};
