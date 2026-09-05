/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { AppUser, JournalEntry, CharacterPersona } from './types';
import { CHARACTERS, getCharacterById } from './data/characters';
import { subscribeToAuth, logout } from './lib/firebase';
import { subscribeToUserEntries, getLocalUserEntries } from './services/firestoreService';
import { Navbar } from './components/Navbar';
import { LandingPage } from './components/LandingPage';
import { CharacterSelection } from './components/CharacterSelection';
import { JournalEditor } from './components/JournalEditor';
import { JournalNotesHub } from './components/JournalNotesHub';
import { EntryHistory } from './components/EntryHistory';
import { ThreatModelModal } from './components/ThreatModelModal';
import { AdminDashboard } from './components/AdminDashboard';
import { AdminLoginModal } from './components/AdminLoginModal';
import { UserProfileModal } from './components/UserProfileModal';
import { Lock } from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'characters' | 'chat' | 'notes' | 'history'>('characters');
  const [selectedCharacter, setSelectedCharacter] = useState<CharacterPersona>(CHARACTERS[0]);
  const [userEntries, setUserEntries] = useState<JournalEntry[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null);
  const [showThreatModel, setShowThreatModel] = useState<boolean>(false);
  const [showAdminDashboard, setShowAdminDashboard] = useState<boolean>(false);
  const [showAdminLoginModal, setShowAdminLoginModal] = useState<boolean>(false);
  const [showUserProfileModal, setShowUserProfileModal] = useState<boolean>(false);

  // Subscribe to authentication changes
  useEffect(() => {
    const unsubscribe = subscribeToAuth((user) => {
      setCurrentUser(user);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const [chatSessionKey, setChatSessionKey] = useState<string>(() => `chat_${Date.now()}`);

  // Subscribe to user-isolated Firestore entries
  useEffect(() => {
    if (!currentUser) {
      setUserEntries([]);
      setSelectedEntry(null);
      return;
    }

    const unsubscribe = subscribeToUserEntries(
      currentUser.uid,
      (entries) => {
        setUserEntries(entries);
      },
      (error) => {
        console.warn('Real-time entries sync warning:', error);
      }
    );

    return () => unsubscribe();
  }, [currentUser]);

  const handleSignOut = async () => {
    await logout();
    setCurrentUser(null);
    setSelectedEntry(null);
    setActiveTab('characters');
  };

  // Robust helper to retrieve the latest conversation for a character
  const getLatestEntryForCharacter = useCallback((characterId: string, currentEntries: JournalEntry[]) => {
    const list = currentEntries.filter((e) => e.characterId === characterId);
    if (currentUser?.uid) {
      const local = getLocalUserEntries(currentUser.uid).filter((e) => e.characterId === characterId);
      const map = new Map<string, JournalEntry>();
      list.forEach((e) => map.set(e.id, e));
      local.forEach((e) => {
        const existing = map.get(e.id);
        if (!existing || (e.updatedAt || 0) >= (existing.updatedAt || 0)) {
          map.set(e.id, e);
        }
      });
      const combined = Array.from(map.values());
      if (combined.length > 0) {
        return combined.sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0))[0];
      }
    }
    if (list.length > 0) {
      return list.sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0))[0];
    }
    return null;
  }, [currentUser?.uid]);

  const handleSelectCharacter = useCallback((character: CharacterPersona, mode?: 'continue' | 'new') => {
    setSelectedCharacter(character);

    if (mode === 'new') {
      setSelectedEntry(null);
      setChatSessionKey(`chat_${character.id}_${Date.now()}`);
    } else {
      // Find the most recent conversation modified/updated for this character, if any
      const latest = getLatestEntryForCharacter(character.id, userEntries);
      if (latest && (latest.messages?.length > 0 || latest.content?.trim())) {
        setSelectedEntry(latest);
        setChatSessionKey(`entry_${latest.id}`);
      } else {
        setSelectedEntry(null);
        setChatSessionKey(`chat_${character.id}_${Date.now()}`);
      }
    }
    setActiveTab('chat');
  }, [getLatestEntryForCharacter, userEntries]);

  const handleSelectEntry = (entry: JournalEntry) => {
    setSelectedEntry(entry);
    const char = getCharacterById(entry.characterId);
    setSelectedCharacter(char);
    setChatSessionKey(`entry_${entry.id}`);
    setActiveTab('chat');
  };

  const handleStartNew = () => {
    setSelectedEntry(null);
    setChatSessionKey(`chat_${selectedCharacter.id}_${Date.now()}`);
    setActiveTab('chat');
  };

  const handleEntrySaved = useCallback((entry: JournalEntry) => {
    // Immediately synchronize local state so companion switches and views never miss data
    setUserEntries((prev) => {
      const idx = prev.findIndex((e) => e.id === entry.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = entry;
        return copy;
      }
      return [entry, ...prev];
    });
    setSelectedEntry((current) => {
      if (current?.id === entry.id) {
        return entry;
      }
      return current;
    });
  }, []);

  const handleEntryDeleted = (entryId: string) => {
    if (selectedEntry?.id === entryId) {
      setSelectedEntry(null);
    }
    setUserEntries((prev) => prev.filter((e) => e.id !== entryId));
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-semibold text-slate-500 font-mono">Initializing Secure Environment...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <LandingPage 
        onLoginSuccess={(user) => {
          if (user) {
            setCurrentUser(user);
          }
          setActiveTab('characters');
        }} 
        onAdminLoginSuccess={(adminUser) => {
          setCurrentUser(adminUser);
          setShowAdminDashboard(true);
        }}
      />
    );
  }

  const isElevated = currentUser.role === 'admin' || currentUser.role === 'super_admin';

  return (
    <div className="min-h-screen bg-slate-50/70 text-slate-900 flex flex-col selection:bg-indigo-100 selection:text-indigo-900">
      <Navbar
        user={currentUser}
        activeTab={activeTab}
        activeCharacter={selectedCharacter}
        onTabChange={(tab) => {
          if (tab === 'chat' && !selectedEntry) {
            const latest = getLatestEntryForCharacter(selectedCharacter.id, userEntries);
            if (latest && (latest.messages?.length > 0 || latest.content?.trim())) {
              setSelectedEntry(latest);
              setChatSessionKey(`entry_${latest.id}`);
            }
          }
          setActiveTab(tab);
        }}
        onOpenThreatModel={() => setShowThreatModel(true)}
        onOpenAdminDashboard={() => setShowAdminDashboard(true)}
        onOpenUserProfile={() => setShowUserProfileModal(true)}
        onSignOut={handleSignOut}
        entryCount={userEntries.length}
      />

      <main className="flex-1 pb-16">
        {activeTab === 'characters' && (
          <CharacterSelection
            onSelectCharacter={handleSelectCharacter}
            selectedCharacterId={selectedCharacter.id}
            userEntries={userEntries}
          />
        )}

        {activeTab === 'chat' && (
          <JournalEditor
            key={chatSessionKey}
            user={currentUser}
            initialEntry={selectedEntry}
            selectedCharacter={selectedCharacter}
            userEntries={userEntries}
            onSelectCharacter={handleSelectCharacter}
            onChangeCharacterRequest={() => setActiveTab('characters')}
            onEntrySaved={handleEntrySaved}
            onStartNew={handleStartNew}
          />
        )}

        {activeTab === 'notes' && (
          <JournalNotesHub
            user={currentUser}
            userEntries={userEntries}
            activeCharacter={selectedCharacter}
            onSelectCharacter={(char) => setSelectedCharacter(char)}
            onOpenChatWithEntry={handleSelectEntry}
            onOpenChatWithCharacter={handleSelectCharacter}
          />
        )}

        {activeTab === 'history' && (
          <EntryHistory
            user={currentUser}
            entries={userEntries}
            onSelectEntry={handleSelectEntry}
            onEntryDeleted={handleEntryDeleted}
          />
        )}
      </main>

      {/* User Page Footer with subtle admin access trigger */}
      <footer className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4 border-t border-slate-200/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
        <p>Gemini Eliza &bull; Journaling &amp; Reflecting with an AI Companion &bull; Google Cloud Run</p>
        
        {!isElevated ? (
          <button
            id="app-footer-admin-login-btn"
            onClick={() => setShowAdminLoginModal(true)}
            className="flex items-center gap-1.5 text-slate-400 hover:text-indigo-600 transition-colors cursor-pointer"
            title="Authenticate as Administrator"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Admin Access</span>
          </button>
        ) : (
          <button
            id="app-footer-admin-portal-btn"
            onClick={() => setShowAdminDashboard(true)}
            className="flex items-center gap-1.5 text-indigo-600 font-semibold hover:text-indigo-700 transition-colors cursor-pointer"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Active Admin Session &bull; Open Dashboard</span>
          </button>
        )}
      </footer>

      <ThreatModelModal
        isOpen={showThreatModel}
        onClose={() => setShowThreatModel(false)}
      />

      {currentUser && (
        <UserProfileModal
          user={currentUser}
          isOpen={showUserProfileModal}
          onClose={() => setShowUserProfileModal(false)}
          onUserUpdated={(updatedUser) => {
            setCurrentUser(updatedUser);
            if (updatedUser.preferredCompanion) {
              const companion = getCharacterById(updatedUser.preferredCompanion);
              if (companion) {
                setSelectedCharacter(companion);
              }
            }
          }}
        />
      )}

      <AdminLoginModal
        isOpen={showAdminLoginModal}
        onClose={() => setShowAdminLoginModal(false)}
        onAdminLoginSuccess={(adminUser) => {
          setCurrentUser(adminUser);
          setShowAdminDashboard(true);
        }}
      />

      {showAdminDashboard && (
        <AdminDashboard
          currentUser={currentUser}
          onClose={() => setShowAdminDashboard(false)}
          onRoleChanged={(newRole) => {
            setCurrentUser(prev => prev ? { ...prev, role: newRole } : null);
          }}
        />
      )}
    </div>
  );
}
