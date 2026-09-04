import React, { useState, useMemo } from 'react';
import Markdown from 'react-markdown';
import { 
  Search, 
  Trash2, 
  Sparkles, 
  FileText, 
  ArrowRight,
  X,
  MessageSquareHeart,
  BookOpen,
  Users
} from 'lucide-react';
import { JournalEntry, AppUser } from '../types';
import { CHARACTERS, getCharacterById } from '../data/characters';
import { deleteJournalEntry } from '../services/firestoreService';

interface EntryHistoryProps {
  user: AppUser;
  entries: JournalEntry[];
  onSelectEntry: (entry: JournalEntry) => void;
  onEntryDeleted: (entryId: string) => void;
}

export const EntryHistory: React.FC<EntryHistoryProps> = ({
  user,
  entries,
  onSelectEntry,
  onEntryDeleted,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCharacterFilter, setSelectedCharacterFilter] = useState<string>('all');
  const [selectedMood, setSelectedMood] = useState<string>('all');
  const [activeDetailEntry, setActiveDetailEntry] = useState<JournalEntry | null>(null);
  const [entryToDelete, setEntryToDelete] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Filtered entries
  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      const matchSearch =
        !searchTerm.trim() ||
        entry.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        entry.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (entry.characterName && entry.characterName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        entry.tags?.some((t) => t.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchChar = selectedCharacterFilter === 'all' || entry.characterId === selectedCharacterFilter;
      const matchMood = selectedMood === 'all' || entry.mood === selectedMood;

      return matchSearch && matchChar && matchMood;
    });
  }, [entries, searchTerm, selectedCharacterFilter, selectedMood]);

  const handleDelete = async (entryId: string) => {
    setIsDeleting(true);
    try {
      await deleteJournalEntry(user.uid, entryId);
      onEntryDeleted(entryId);
      if (activeDetailEntry?.id === entryId) {
        setActiveDetailEntry(null);
      }
      setEntryToDelete(null);
    } catch (err) {
      console.error('Delete error:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header and Search Filters */}
      <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Journal &amp; Reflection History</h2>
            <p className="text-xs text-slate-500 font-mono mt-0.5">
              User-Isolated Storage: /users/{user.uid.slice(0, 10)}.../interactions
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-indigo-50 text-indigo-700 text-xs font-semibold rounded-full border border-indigo-100">
              {filteredEntries.length} {filteredEntries.length === 1 ? 'journal entry' : 'journal entries'}
            </span>
          </div>
        </div>

        {/* Search Bar & Dropdown Filters */}
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          <div className="sm:col-span-6 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              id="history-search-input"
              type="text"
              placeholder="Search by topic, character name, or tags..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-slate-50/50"
            />
          </div>

          <div className="sm:col-span-3">
            <select
              id="character-filter-select"
              value={selectedCharacterFilter}
              onChange={(e) => setSelectedCharacterFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="all">All Companions</option>
              {CHARACTERS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.badge})
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-3">
            <select
              id="mood-filter-select"
              value={selectedMood}
              onChange={(e) => setSelectedMood(e.target.value)}
              className="w-full px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="all">All Emotional States</option>
              <option value="reflective">Reflective</option>
              <option value="calm">Calm</option>
              <option value="inspired">Inspired</option>
              <option value="anxious">Uncertain</option>
              <option value="energetic">Energetic</option>
              <option value="tired">Tired</option>
              <option value="grateful">Grateful</option>
            </select>
          </div>
        </div>
      </div>

      {/* Entries List or Empty State */}
      {filteredEntries.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200/80 p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
            <FileText className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-800">No journal reflections found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {searchTerm || selectedCharacterFilter !== 'all' || selectedMood !== 'all'
              ? 'Try adjusting your search query or companion filter.'
              : 'Choose an AI companion and start your first journaling and reflection session!'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredEntries.map((entry) => {
            const char = getCharacterById(entry.characterId);
            const messageCount = entry.messages?.length || 0;

            return (
              <div
                key={entry.id}
                onClick={() => onSelectEntry(entry)}
                className="group bg-white rounded-3xl p-5 border border-slate-200/80 hover:border-slate-300 hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col justify-between"
              >
                <div>
                  {/* Top Character and Date Bar */}
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <img
                        src={char.avatarUrl}
                        alt={char.name}
                        referrerPolicy="no-referrer"
                        className="w-7 h-7 rounded-lg object-cover ring-1 ring-slate-200"
                      />
                      <div>
                        <span
                          className="px-2 py-0.5 rounded text-[10px] font-bold text-white inline-block"
                          style={{ backgroundColor: char.themeColor.primary }}
                        >
                          {char.name} • {char.badge}
                        </span>
                      </div>
                    </div>

                    <span className="text-[11px] text-slate-400 font-medium">
                      {new Date(entry.createdAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="text-base font-bold text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-1 mb-2">
                    {entry.title}
                  </h3>

                  {/* Content Preview */}
                  <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed mb-3">
                    {entry.content || (entry.messages && entry.messages[0]?.content) || 'No text preview available.'}
                  </p>

                  {/* Tags */}
                  {entry.tags && entry.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-4">
                      {entry.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-medium"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Footer Bar: Stats & Actions */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1">
                      <MessageSquareHeart className="w-3.5 h-3.5 text-indigo-500" />
                      <span>{messageCount} msgs</span>
                    </span>
                    {entry.summary && (
                      <span className="flex items-center gap-1 text-amber-600 font-semibold">
                        <Sparkles className="w-3 h-3" />
                        <span>Insights</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEntryToDelete(entry.id);
                      }}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      title="Delete entry"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onSelectEntry(entry)}
                      className="p-1.5 rounded-lg text-indigo-600 hover:bg-indigo-50 font-bold flex items-center gap-1"
                    >
                      <span>Resume</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {entryToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4 animate-scale-in">
            <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Delete Conversation?</h3>
              <p className="text-xs text-slate-600 mt-1">
                This will permanently delete this conversation and its insights from your isolated Firestore storage. This action cannot be undone.
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEntryToDelete(null)}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDelete(entryToDelete)}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-sm"
              >
                {isDeleting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
