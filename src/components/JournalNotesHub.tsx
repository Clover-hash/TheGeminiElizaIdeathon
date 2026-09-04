import React, { useState, useMemo, useCallback } from 'react';
import Markdown from 'react-markdown';
import { 
  BookHeart, 
  Sparkles, 
  PenLine, 
  Plus, 
  Search, 
  Save, 
  MessageSquareHeart, 
  Trash2, 
  Copy, 
  Check, 
  ShieldCheck, 
  Calendar, 
  Tag, 
  AlertCircle,
  Eye,
  Edit3,
  Filter,
  ArrowRight,
  Heart,
  ChevronRight,
  Clock
} from 'lucide-react';
import { JournalEntry, CharacterPersona, CharacterId, AppUser, MoodType } from '../types';
import { CHARACTERS, getCharacterById } from '../data/characters';
import { generatePersonaJournalNote } from '../services/geminiService';
import { saveJournalEntry, deleteJournalEntry } from '../services/firestoreService';

interface JournalNotesHubProps {
  user: AppUser;
  userEntries: JournalEntry[];
  activeCharacter: CharacterPersona;
  onSelectCharacter: (char: CharacterPersona) => void;
  onOpenChatWithEntry: (entry: JournalEntry) => void;
  onOpenChatWithCharacter: (char: CharacterPersona, mode?: 'continue' | 'new') => void;
}

const moodColors: Record<MoodType, { bg: string; text: string; label: string; emoji: string }> = {
  reflective: { bg: 'bg-indigo-50 border-indigo-200', text: 'text-indigo-700', label: 'Reflective', emoji: '🤔' },
  calm: { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', label: 'Calm', emoji: '🌿' },
  inspired: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', label: 'Inspired', emoji: '✨' },
  anxious: { bg: 'bg-rose-50 border-rose-200', text: 'text-rose-700', label: 'Uncertain', emoji: '🌪️' },
  energetic: { bg: 'bg-orange-50 border-orange-200', text: 'text-orange-700', label: 'Energetic', emoji: '⚡' },
  tired: { bg: 'bg-slate-50 border-slate-200', text: 'text-slate-700', label: 'Tired', emoji: '🌙' },
  grateful: { bg: 'bg-violet-50 border-violet-200', text: 'text-violet-700', label: 'Grateful', emoji: '🙏' },
};

export const JournalNotesHub: React.FC<JournalNotesHubProps> = ({
  user,
  userEntries,
  activeCharacter,
  onSelectCharacter,
  onOpenChatWithEntry,
  onOpenChatWithCharacter,
}) => {
  const [selectedCompanionId, setSelectedCompanionId] = useState<CharacterId>(activeCharacter.id);
  const currentCompanion = useMemo(() => getCharacterById(selectedCompanionId), [selectedCompanionId]);

  // Filter entries strictly belonging to the currently selected companion
  const companionEntries = useMemo(() => {
    return userEntries
      .filter((e) => e.characterId === selectedCompanionId)
      .sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
  }, [userEntries, selectedCompanionId]);

  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [moodFilter, setMoodFilter] = useState<string>('all');
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [isWritingNote, setIsWritingNote] = useState<boolean>(false);
  const [notePrompt, setNotePrompt] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Editable fields for active note
  const [noteTitle, setNoteTitle] = useState<string>('');
  const [noteContent, setNoteContent] = useState<string>('');
  const [noteMood, setNoteMood] = useState<MoodType>('reflective');

  // Currently selected entry object
  const activeEntry = useMemo(() => {
    if (!selectedEntryId) {
      return companionEntries.length > 0 ? companionEntries[0] : null;
    }
    return companionEntries.find((e) => e.id === selectedEntryId) || companionEntries[0] || null;
  }, [companionEntries, selectedEntryId]);

  // Sync state when active entry changes
  React.useEffect(() => {
    if (activeEntry) {
      setNoteTitle(activeEntry.title);
      setNoteContent(activeEntry.content);
      setNoteMood(activeEntry.mood || 'reflective');
      setIsEditing(false);
    } else {
      setNoteTitle('');
      setNoteContent('');
      setNoteMood('reflective');
      setIsEditing(false);
    }
  }, [activeEntry?.id]);

  // Search and filtered companion entries
  const filteredEntries = useMemo(() => {
    return companionEntries.filter((entry) => {
      const matchSearch =
        !searchQuery.trim() ||
        entry.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        entry.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        entry.tags?.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchMood = moodFilter === 'all' || entry.mood === moodFilter;

      return matchSearch && matchMood;
    });
  }, [companionEntries, searchQuery, moodFilter]);

  // Create a brand new shared note for this companion
  const handleCreateNewNote = async () => {
    const newEntry: JournalEntry = {
      id: `entry_${Date.now()}`,
      userId: user.uid,
      characterId: currentCompanion.id,
      characterName: currentCompanion.name,
      title: `Shared Journal Note with ${currentCompanion.name} - ${new Date().toLocaleDateString()}`,
      content: `## Reflection with ${currentCompanion.name}\n\n*Started on ${new Date().toLocaleDateString()}*\n\nWrite your thoughts here, or ask ${currentCompanion.name} to write an entry below!`,
      mood: 'reflective',
      tags: ['shared-journal', currentCompanion.id],
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      wordCount: 20,
    };

    try {
      setIsSaving(true);
      await saveJournalEntry(user.uid, newEntry);
      setSelectedEntryId(newEntry.id);
      setIsEditing(true);
      setSuccessToast(`Created new shared journal note for ${currentCompanion.name}!`);
      setTimeout(() => setSuccessToast(null), 4000);
    } catch (err: unknown) {
      setErrorMessage((err as Error)?.message || 'Failed to create note.');
    } finally {
      setIsSaving(false);
    }
  };

  // Save changes to current note
  const handleSaveNote = async () => {
    if (!activeEntry) return;

    // Security & Isolation Validation Check
    if (activeEntry.characterId !== currentCompanion.id) {
      setErrorMessage(
        `Cross-journal modification rejected! This note belongs to ${activeEntry.characterName}, not ${currentCompanion.name}.`
      );
      return;
    }

    const updated: JournalEntry = {
      ...activeEntry,
      title: noteTitle.trim() || `Journal Note with ${currentCompanion.name}`,
      content: noteContent,
      mood: noteMood,
      updatedAt: Date.now(),
      wordCount: noteContent.trim().split(/\s+/).filter(Boolean).length,
    };

    try {
      setIsSaving(true);
      setErrorMessage(null);
      await saveJournalEntry(user.uid, updated);
      setIsEditing(false);
      setSuccessToast('Journal note saved to Firestore!');
      setTimeout(() => setSuccessToast(null), 3000);
    } catch (err: unknown) {
      setErrorMessage((err as Error)?.message || 'Failed to save note.');
    } finally {
      setIsSaving(false);
    }
  };

  // Validate if companion can write into this journal note (isolation + new additions check)
  const canCompanionWrite = useMemo(() => {
    if (!activeEntry) return { canWrite: false, reason: 'No journal note selected' };
    if (activeEntry.characterId !== currentCompanion.id) {
      return {
        canWrite: false,
        reason: `Companion Isolation: Only ${activeEntry.characterName} can write into this journal.`,
      };
    }

    const userMessages = (activeEntry.messages || []).filter((m) => m.role === 'user');
    const substantiveNotes = noteContent.replace(/###.*?\n|🌸.*?---|---/gs, '').trim();

    // Check if reflection exists
    const hasPriorReflection = /### 🌸 .*? Note/i.test(noteContent) || /### 🌸 .*? Journal Entry/i.test(noteContent);
    const lastReflectedMsgId = activeEntry.lastReflectedMessageId;

    let unreflectedUserMsgCount = userMessages.length;
    if (lastReflectedMsgId) {
      const idx = (activeEntry.messages || []).findIndex((m) => m.id === lastReflectedMsgId);
      if (idx !== -1) {
        unreflectedUserMsgCount = (activeEntry.messages || []).slice(idx + 1).filter((m) => m.role === 'user').length;
      }
    }

    if (hasPriorReflection && unreflectedUserMsgCount === 0 && substantiveNotes.length < 15 && !notePrompt.trim()) {
      return {
        canWrite: false,
        reason: `No new conversation additions or updates to reflect upon yet. Add new thoughts or chat with ${currentCompanion.name} first!`,
      };
    }

    if (userMessages.length === 0 && substantiveNotes.length < 15 && !notePrompt.trim()) {
      return {
        canWrite: false,
        reason: `Please share a thought in the editor or chat with ${currentCompanion.name} first.`,
      };
    }

    return {
      canWrite: true,
      reason: '',
    };
  }, [activeEntry, currentCompanion.id, currentCompanion.name, noteContent, notePrompt]);

  // Ask current companion to write an isolated note into this shared journal
  const handleCompanionWriteNote = async () => {
    if (!activeEntry || isWritingNote) return;

    if (!canCompanionWrite.canWrite) {
      setErrorMessage(canCompanionWrite.reason);
      return;
    }

    setIsWritingNote(true);
    setErrorMessage(null);

    try {
      const response = await generatePersonaJournalNote({
        characterId: currentCompanion.id,
        characterName: currentCompanion.name,
        systemInstruction: currentCompanion.systemInstruction,
        messages: activeEntry.messages || [],
        mood: noteMood,
        journalTitle: noteTitle,
        existingContent: noteContent,
        userRequest: notePrompt.trim(),
      });

      const now = new Date();
      const dateStr = now.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      const companionSection = `\n\n---\n### 🌸 ${currentCompanion.name}'s Note (${currentCompanion.badge})\n*Recorded on ${dateStr} at ${timeStr}*\n\n${response.note}\n---`;
      const updatedContent = noteContent.trim() ? `${noteContent.trim()}${companionSection}` : companionSection.trim();

      setNoteContent(updatedContent);

      const latestMsgId = (activeEntry.messages && activeEntry.messages.length > 0)
        ? activeEntry.messages[activeEntry.messages.length - 1].id
        : 'msg_reflected_' + Date.now();

      const updatedEntry: JournalEntry = {
        ...activeEntry,
        content: updatedContent,
        lastReflectedMessageId: latestMsgId,
        lastReflectedAt: Date.now(),
        updatedAt: Date.now(),
        wordCount: updatedContent.trim().split(/\s+/).filter(Boolean).length,
      };

      await saveJournalEntry(user.uid, updatedEntry);

      setNotePrompt('');
      setSuccessToast(`${currentCompanion.name} wrote a shared reflection into this journal! ✨`);
      setTimeout(() => setSuccessToast(null), 5000);
    } catch (err: unknown) {
      console.error('Error generating companion note:', err);
      setErrorMessage((err as Error)?.message || `Could not generate note from ${currentCompanion.name}.`);
    } finally {
      setIsWritingNote(false);
    }
  };

  // Handle delete note
  const handleDeleteNote = async (idToDelete: string) => {
    if (!window.confirm('Are you sure you want to delete this shared journal note?')) return;

    try {
      await deleteJournalEntry(user.uid, idToDelete);
      if (selectedEntryId === idToDelete) {
        setSelectedEntryId(null);
      }
      setSuccessToast('Journal note deleted.');
      setTimeout(() => setSuccessToast(null), 3000);
    } catch (err: unknown) {
      setErrorMessage((err as Error)?.message || 'Failed to delete note.');
    }
  };

  // Copy note content
  const handleCopyNote = () => {
    if (!noteContent) return;
    navigator.clipboard.writeText(noteContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header & Isolation Guarantee Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/90 shadow-xs">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold bg-pink-50 text-pink-700 border border-pink-200 mb-2">
            <BookHeart className="w-3.5 h-3.5" />
            <span>Journaling &amp; Reflecting with an AI Companion</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
            <span>Journal Notes Hub</span>
            <span
              className="text-xs font-bold px-2.5 py-1 rounded-full text-white shadow-xs"
              style={{ backgroundColor: currentCompanion.themeColor.primary }}
            >
              {currentCompanion.name}'s Notebook ({companionEntries.length})
            </span>
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Each companion maintains a dedicated, private shared journal with you. Select a companion below to view and co-write in their shared reflection notebook.
          </p>
        </div>

        {/* Companion Isolation Security Tag */}
        <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-2xl bg-emerald-50/90 border border-emerald-200 text-emerald-800 text-xs font-semibold self-start md:self-auto">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>Strict Isolation: Companions cannot write across each other's journals</span>
        </div>
      </div>

      {/* Companion Notebook Tabs Switcher */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {CHARACTERS.map((char) => {
          const isSelected = char.id === selectedCompanionId;
          const count = userEntries.filter((e) => e.characterId === char.id).length;

          return (
            <button
              key={char.id}
              type="button"
              onClick={() => {
                setSelectedCompanionId(char.id);
                onSelectCharacter(char);
                setSelectedEntryId(null);
                setErrorMessage(null);
              }}
              className={`p-3.5 rounded-2xl border transition-all text-left flex items-center gap-3 relative cursor-pointer ${
                isSelected
                  ? 'bg-white border-indigo-600 ring-2 ring-indigo-500/20 shadow-md scale-[1.01]'
                  : 'bg-white/80 hover:bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <img
                src={char.avatarUrl}
                alt={char.name}
                referrerPolicy="no-referrer"
                className="w-11 h-11 rounded-xl object-cover ring-2 ring-slate-100 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-sm font-bold text-slate-900 truncate">{char.name}</span>
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: char.themeColor.primary }}
                  />
                </div>
                <p className="text-[11px] font-medium text-slate-500 truncate">{char.badge}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-slate-100 text-slate-600">
                    {count} {count === 1 ? 'note' : 'notes'}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Success & Error Notifications */}
      {successToast && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center justify-between animate-in fade-in">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-600" />
            <span>{successToast}</span>
          </div>
          <button onClick={() => setSuccessToast(null)} className="text-emerald-700 hover:text-emerald-900 font-bold">
            &times;
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2 animate-in fade-in">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Main Journal Workspace: Sidebar + Note Viewer/Editor */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Entries List & Search for this companion */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white p-4 rounded-3xl border border-slate-200/90 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <BookHeart className="w-4 h-4 text-pink-500" />
                <span>{currentCompanion.name}'s Notes</span>
              </h2>
              <button
                type="button"
                onClick={handleCreateNewNote}
                disabled={isSaving}
                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs flex items-center gap-1.5 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Note</span>
              </button>
            </div>

            {/* Search and Filters */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Search ${currentCompanion.name}'s notes...`}
                className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* List of Entries */}
            <div className="space-y-2 max-h-[580px] overflow-y-auto pr-1">
              {filteredEntries.length === 0 ? (
                <div className="text-center py-10 px-4 text-slate-400 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                  <BookHeart className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                  <p className="text-xs font-bold text-slate-600">No notes yet with {currentCompanion.name}</p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Click "New Note" to start writing a shared reflection, or chat with {currentCompanion.name}!
                  </p>
                  <button
                    type="button"
                    onClick={handleCreateNewNote}
                    className="mt-3 px-3 py-1.5 text-xs font-bold bg-indigo-600 text-white rounded-xl shadow-xs"
                  >
                    Create First Note
                  </button>
                </div>
              ) : (
                filteredEntries.map((entry) => {
                  const isSelected = activeEntry?.id === entry.id;
                  const moodInfo = moodColors[entry.mood || 'reflective'];

                  return (
                    <div
                      key={entry.id}
                      onClick={() => {
                        setSelectedEntryId(entry.id);
                        setErrorMessage(null);
                      }}
                      className={`p-3 rounded-2xl border transition-all cursor-pointer text-left relative group ${
                        isSelected
                          ? 'bg-indigo-50/70 border-indigo-300 ring-1 ring-indigo-400 shadow-2xs'
                          : 'bg-slate-50/70 hover:bg-slate-100/70 border-slate-200/80'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-xs font-bold text-slate-900 truncate leading-snug">
                          {entry.title || 'Untitled Note'}
                        </h3>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md border shrink-0 ${moodInfo.bg} ${moodInfo.text}`}>
                          {moodInfo.emoji} {moodInfo.label}
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-500 line-clamp-2 mt-1 leading-relaxed">
                        {entry.content.replace(/^[#\-*\s]+/gm, '') || 'No text content yet...'}
                      </p>

                      <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-slate-200/50 text-[10px] text-slate-400">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          <span>{new Date(entry.updatedAt || entry.createdAt).toLocaleDateString()}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          {entry.messages?.length > 0 && (
                            <span className="px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-700 font-semibold">
                              {entry.messages.length} msgs
                            </span>
                          )}
                          <span>{entry.wordCount || 0} words</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Quick Chat Switcher Box */}
          <div className="p-4 rounded-3xl bg-gradient-to-br from-indigo-900 to-slate-900 text-white shadow-md flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold text-indigo-200">Want to discuss this note?</p>
              <h4 className="text-sm font-extrabold mt-0.5">Chat with {currentCompanion.name}</h4>
            </div>
            <button
              type="button"
              onClick={() => {
                if (activeEntry) {
                  onOpenChatWithEntry(activeEntry);
                } else {
                  onOpenChatWithCharacter(currentCompanion, 'continue');
                }
              }}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-white text-slate-900 hover:bg-slate-100 transition-colors flex items-center gap-1.5 shrink-0"
            >
              <MessageSquareHeart className="w-3.5 h-3.5 text-indigo-600" />
              <span>Open Chat</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Right Column: Note Viewer & Companion Writing Desk */}
        <div className="lg:col-span-8 space-y-4">
          {activeEntry ? (
            <div className="bg-white rounded-3xl border border-slate-200/90 shadow-2xs overflow-hidden">
              {/* Note Header & Actions */}
              <div className="p-5 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50">
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <img
                      src={currentCompanion.avatarUrl}
                      alt={currentCompanion.name}
                      referrerPolicy="no-referrer"
                      className="w-6 h-6 rounded-lg object-cover ring-1 ring-slate-200"
                    />
                    <span className="text-xs font-bold text-slate-600">
                      Shared with {currentCompanion.name} ({currentCompanion.badge})
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      &bull; {new Date(activeEntry.updatedAt || activeEntry.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  {isEditing ? (
                    <input
                      type="text"
                      value={noteTitle}
                      onChange={(e) => setNoteTitle(e.target.value)}
                      placeholder="Note title..."
                      className="w-full text-lg sm:text-xl font-extrabold text-slate-900 bg-white border border-slate-300 rounded-xl px-3 py-1.5 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    />
                  ) : (
                    <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight truncate">
                      {noteTitle || 'Untitled Shared Note'}
                    </h2>
                  )}
                </div>

                {/* Control Actions */}
                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  {isEditing ? (
                    <button
                      type="button"
                      onClick={handleSaveNote}
                      disabled={isSaving}
                      className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs flex items-center gap-1.5 transition-all"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsEditing(true)}
                      className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center gap-1.5 transition-colors"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleCopyNote}
                    className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors"
                    title="Copy Markdown content"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteNote(activeEntry.id)}
                    className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 transition-colors"
                    title="Delete note"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Companion Collaborative Prompt Box */}
              <div className="p-4 sm:p-5 bg-gradient-to-r from-pink-50/70 via-indigo-50/50 to-slate-50 border-b border-slate-200/70">
                <div className="flex items-start gap-3">
                  <img
                    src={currentCompanion.avatarUrl}
                    alt={currentCompanion.name}
                    referrerPolicy="no-referrer"
                    className="w-10 h-10 rounded-2xl object-cover ring-2 ring-pink-200 shrink-0"
                  />
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-pink-500" />
                        <span>Ask {currentCompanion.name} to write an entry for this journal</span>
                      </p>
                      <span className="text-[10px] text-slate-400 font-semibold">
                        {currentCompanion.badge} Persona
                      </span>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-2">
                      <input
                        type="text"
                        value={notePrompt}
                        onChange={(e) => setNotePrompt(e.target.value)}
                        placeholder={`e.g., "Reflect on how we overcame stress today", or "Give your honest advice on my goal"`}
                        className="w-full text-xs px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-pink-500"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !isWritingNote) {
                            handleCompanionWriteNote();
                          }
                        }}
                      />
                      <button
                        type="button"
                        onClick={handleCompanionWriteNote}
                        disabled={isWritingNote || !canCompanionWrite.canWrite}
                        title={!canCompanionWrite.canWrite ? canCompanionWrite.reason : `Write reflection entry as ${currentCompanion.name}`}
                        className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-bold text-white shadow-xs flex items-center justify-center gap-1.5 transition-all shrink-0 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                        style={{ backgroundColor: currentCompanion.themeColor.primary }}
                      >
                        <PenLine className="w-3.5 h-3.5" />
                        <span>{isWritingNote ? 'Writing...' : `Write Entry as ${currentCompanion.name}`}</span>
                      </button>
                    </div>

                    {!canCompanionWrite.canWrite && (
                      <p className="text-[11px] text-amber-700 bg-amber-50/80 px-2.5 py-1 rounded-lg border border-amber-200/60 flex items-center gap-1.5">
                        <span>ℹ️</span>
                        <span>{canCompanionWrite.reason}</span>
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Note Content (Viewer or Markdown Editor) */}
              <div className="p-6">
                {isEditing ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>Markdown supported</span>
                      <span>{noteContent.length} characters &bull; {noteContent.split(/\s+/).filter(Boolean).length} words</span>
                    </div>
                    <textarea
                      value={noteContent}
                      onChange={(e) => setNoteContent(e.target.value)}
                      rows={16}
                      placeholder="Write your reflection here..."
                      className="w-full p-4 rounded-2xl border border-slate-300 bg-white text-slate-800 font-mono text-sm leading-relaxed focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                ) : (
                  <div className="prose prose-slate max-w-none text-slate-800 leading-relaxed min-h-[300px]">
                    {noteContent.trim() ? (
                      <Markdown>{noteContent}</Markdown>
                    ) : (
                      <div className="text-center py-16 text-slate-400">
                        <PenLine className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                        <p className="text-sm font-bold text-slate-500">This journal note is empty</p>
                        <p className="text-xs text-slate-400 mt-1">
                          Click <strong>Edit</strong> or ask <strong>{currentCompanion.name}</strong> to contribute an entry above!
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-slate-200/90 shadow-2xs p-12 text-center text-slate-400">
              <BookHeart className="w-12 h-12 mx-auto text-slate-300 mb-3" />
              <h3 className="text-base font-bold text-slate-700">No Journal Note Selected</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 mb-5">
                Choose a note from the left sidebar or create a new shared reflection note with {currentCompanion.name}.
              </p>
              <button
                type="button"
                onClick={handleCreateNewNote}
                className="px-4 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>Create Shared Note with {currentCompanion.name}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
