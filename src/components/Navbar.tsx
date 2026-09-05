import React from 'react';
import { 
  Sparkles, 
  ShieldCheck, 
  LogOut, 
  BookOpen, 
  MessageSquareHeart, 
  Users,
  Heart,
  BookHeart
} from 'lucide-react';
import { AppUser, CharacterPersona } from '../types';

interface NavbarProps {
  user: AppUser;
  activeTab: 'characters' | 'chat' | 'notes' | 'history';
  activeCharacter?: CharacterPersona;
  onTabChange: (tab: 'characters' | 'chat' | 'notes' | 'history') => void;
  onOpenThreatModel: () => void;
  onOpenAdminDashboard: () => void;
  onOpenUserProfile: () => void;
  onSignOut: () => void;
  entryCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  activeTab,
  activeCharacter,
  onTabChange,
  onOpenThreatModel,
  onOpenAdminDashboard,
  onOpenUserProfile,
  onSignOut,
  entryCount,
}) => {
  const userRole = user.role || 'user';
  const isElevated = userRole === 'admin' || userRole === 'super_admin';

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 transition-all">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2 lg:gap-4">
        {/* Brand */}
        <div className="flex items-center gap-2.5 cursor-pointer shrink-0 select-none" onClick={() => onTabChange('characters')}>
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-indigo-600 to-pink-500 flex items-center justify-center text-white shadow-sm shadow-indigo-200 shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="flex items-center">
            <span className="text-base sm:text-lg font-bold bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-800 bg-clip-text text-transparent whitespace-nowrap">
              Gemini Eliza
            </span>
            <span className="hidden xl:inline-block ml-2 px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase bg-indigo-50 text-indigo-700 rounded-full border border-indigo-100 whitespace-nowrap">
              Reflective Companion Journaling
            </span>
          </div>
        </div>

        {/* Navigation Controls */}
        <nav className="hidden md:flex items-center gap-1 bg-slate-100/90 p-1 rounded-2xl border border-slate-200/70 shrink-0">
          <button
            id="nav-characters-tab-btn"
            onClick={() => onTabChange('characters')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
              activeTab === 'characters'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-pink-500 shrink-0" />
            <span>Companions</span>
          </button>

          <button
            id="nav-chat-tab-btn"
            onClick={() => onTabChange('chat')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
              activeTab === 'chat'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <MessageSquareHeart className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
            <span>
              Chat <span className="hidden xl:inline">{activeCharacter ? `with ${activeCharacter.name}` : ''}</span>
            </span>
            {activeCharacter && (
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: activeCharacter.themeColor.primary }}
              />
            )}
          </button>

          <button
            id="nav-notes-tab-btn"
            onClick={() => onTabChange('notes')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
              activeTab === 'notes'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <BookHeart className="w-3.5 h-3.5 text-pink-600 shrink-0" />
            <span>
              <span className="hidden lg:inline">Journal </span>Notes
            </span>
          </button>

          <button
            id="nav-history-tab-btn"
            onClick={() => onTabChange('history')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
              activeTab === 'history'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5 text-violet-600 shrink-0" />
            <span>History</span>
            {entryCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700 shrink-0">
                {entryCount}
              </span>
            )}
          </button>
        </nav>

        {/* Right Section: Security Badge & Profile */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          {/* Admin Dashboard Trigger Button - ONLY visible to authenticated elevated administrators */}
          {isElevated && (
            <button
              id="admin-dashboard-btn"
              onClick={onOpenAdminDashboard}
              title="Open Admin Dashboard & AI Security Directives"
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-bold rounded-xl border transition-all bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-700 shadow-sm shadow-indigo-200 whitespace-nowrap shrink-0"
            >
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>Admin<span className="hidden sm:inline"> Portal</span></span>
              <span className="px-1.5 py-0.2 text-[9px] uppercase tracking-wider rounded font-mono font-bold bg-indigo-800 text-indigo-200 whitespace-nowrap shrink-0">
                {userRole.replace('_', ' ')}
              </span>
            </button>
          )}

          {/* Threat Model Trigger Button */}
          <button
            id="threat-model-btn"
            onClick={onOpenThreatModel}
            title="View Threat Model & Security Controls"
            className="hidden sm:flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-xs font-semibold rounded-xl bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200/80 transition-colors whitespace-nowrap shrink-0"
          >
            <ShieldCheck className="w-4 h-4 text-slate-600 shrink-0" />
            <span>Threat Model</span>
          </button>

          {/* User profile capsule - opens Firestore Profile Modal */}
          <div className="flex items-center gap-1.5 sm:gap-2 pl-1.5 sm:pl-2 border-l border-slate-200 shrink-0">
            <button
              id="user-profile-menu-btn"
              onClick={onOpenUserProfile}
              title="View and Edit Cloud Firestore User Profile"
              className="flex items-center gap-2 p-1 rounded-2xl hover:bg-slate-100 transition-colors text-left group shrink-0"
            >
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'User Avatar'}
                  className="w-8 h-8 rounded-full border border-slate-200 object-cover group-hover:ring-2 group-hover:ring-indigo-500 transition-all"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-8 h-8 rounded-full bg-slate-800 text-white flex items-center justify-center text-xs font-bold group-hover:ring-2 group-hover:ring-indigo-500 transition-all">
                  {(user.displayName || user.email || 'U').charAt(0).toUpperCase()}
                </div>
              )}
              <div className="hidden xl:block text-left">
                <p className="text-xs font-semibold text-slate-800 leading-none truncate max-w-[110px] group-hover:text-indigo-600">
                  {user.displayName || 'Authenticated User'}
                </p>
                <p className="text-[10px] text-slate-500 font-mono leading-tight truncate max-w-[110px]">
                  {user.role || 'user'}
                </p>
              </div>
            </button>
            <button
              id="logout-btn"
              onClick={onSignOut}
              title="Sign Out"
              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-xl hover:bg-rose-50 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Sub-Navigation Bar */}
      <div className="md:hidden flex border-t border-slate-200/70 px-2 py-2 bg-slate-50 justify-around">
        <button
          id="mobile-nav-characters-btn"
          onClick={() => onTabChange('characters')}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold ${
            activeTab === 'characters' ? 'bg-white shadow-xs text-pink-600' : 'text-slate-600'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Companions</span>
        </button>
        <button
          id="mobile-nav-chat-btn"
          onClick={() => onTabChange('chat')}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold ${
            activeTab === 'chat' ? 'bg-white shadow-xs text-indigo-700' : 'text-slate-600'
          }`}
        >
          <MessageSquareHeart className="w-3.5 h-3.5" />
          <span>Chat</span>
        </button>
        <button
          id="mobile-nav-notes-btn"
          onClick={() => onTabChange('notes')}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold ${
            activeTab === 'notes' ? 'bg-white shadow-xs text-pink-700' : 'text-slate-600'
          }`}
        >
          <BookHeart className="w-3.5 h-3.5" />
          <span>Notes</span>
        </button>
        <button
          id="mobile-nav-history-btn"
          onClick={() => onTabChange('history')}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold ${
            activeTab === 'history' ? 'bg-white shadow-xs text-violet-700' : 'text-slate-600'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>History</span>
        </button>
      </div>
    </header>
  );
};
