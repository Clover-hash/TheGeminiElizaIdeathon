import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Markdown from 'react-markdown';
import { 
  Send, 
  Sparkles, 
  Save, 
  RefreshCw, 
  Heart, 
  Smile, 
  Tag, 
  FileText, 
  AlertCircle, 
  CheckCircle2, 
  Database,
  Wand2,
  Trash2,
  Users,
  ChevronRight,
  Plus,
  BookOpen,
  MessageSquareHeart,
  HelpCircle,
  Copy,
  Check,
  PenLine,
  BookHeart,
  ArrowRight,
  Eye,
  Edit3,
  Cloud
} from 'lucide-react';
import { 
  JournalEntry, 
  ChatMessage, 
  CharacterId, 
  CharacterPersona, 
  MoodType, 
  AISummary, 
  AppUser 
} from '../types';
import { CHARACTERS, getCharacterById } from '../data/characters';
import { 
  askGeminiReflection, 
  generateEntrySummary,
  generatePersonaJournalNote
} from '../services/geminiService';
import { saveJournalEntry } from '../services/firestoreService';
import { processAndVerifyMessageChunks } from '../lib/messageSplitter';

interface JournalEditorProps {
  user: AppUser;
  initialEntry?: JournalEntry | null;
  selectedCharacter?: CharacterPersona;
  userEntries?: JournalEntry[];
  onChangeCharacterRequest?: () => void;
  onSelectCharacter?: (character: CharacterPersona) => void;
  onEntrySaved: (entry: JournalEntry) => void;
  onStartNew?: () => void;
}

const moodOptions: Array<{ id: MoodType; label: string; emoji: string; color: string }> = [
  { id: 'reflective', label: 'Reflective', emoji: '🤔', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  { id: 'calm', label: 'Calm', emoji: '🌿', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { id: 'inspired', label: 'Inspired', emoji: '✨', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  { id: 'anxious', label: 'Uncertain', emoji: '🌪️', color: 'bg-rose-50 text-rose-700 border-rose-200' },
  { id: 'energetic', label: 'Energetic', emoji: '⚡', color: 'bg-orange-50 text-orange-700 border-orange-200' },
  { id: 'tired', label: 'Tired', emoji: '🌙', color: 'bg-slate-50 text-slate-700 border-slate-200' },
  { id: 'grateful', label: 'Grateful', emoji: '🙏', color: 'bg-violet-50 text-violet-700 border-violet-200' },
];

export const JournalEditor: React.FC<JournalEditorProps> = ({
  user,
  initialEntry,
  selectedCharacter,
  userEntries,
  onChangeCharacterRequest,
  onSelectCharacter,
  onEntrySaved,
  onStartNew,
}) => {
  const defaultChar = selectedCharacter || (initialEntry?.characterId ? getCharacterById(initialEntry.characterId) : CHARACTERS[0]);
  const [character, setCharacter] = useState<CharacterPersona>(defaultChar);

  const [entryId, setEntryId] = useState<string>(initialEntry?.id || 'entry_' + Date.now());
  const [title, setTitle] = useState<string>(initialEntry?.title || '');
  const [content, setContent] = useState<string>(initialEntry?.content || '');
  const [mood, setMood] = useState<MoodType>(initialEntry?.mood || 'reflective');
  const [tags, setTags] = useState<string[]>(initialEntry?.tags || ['companion-chat']);
  const [tagInput, setTagInput] = useState<string>('');
  const [messages, setMessages] = useState<ChatMessage[]>(initialEntry?.messages || []);
  const [chatInput, setChatInput] = useState<string>('');
  const [summary, setSummary] = useState<AISummary | null>(initialEntry?.summary || null);
  const [lastReflectedMessageId, setLastReflectedMessageId] = useState<string | undefined>(
    initialEntry?.lastReflectedMessageId
  );
  const [lastReflectedAt, setLastReflectedAt] = useState<number | undefined>(
    initialEntry?.lastReflectedAt
  );

  const [viewTab, setViewTab] = useState<'chat' | 'notes' | 'insights'>('chat');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isWritingNote, setIsWritingNote] = useState<boolean>(false);
  const [isSummarizing, setIsSummarizing] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [personaNoteToast, setPersonaNoteToast] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [noteCustomPrompt, setNoteCustomPrompt] = useState<string>('');
  const [showNotesPreview, setShowNotesPreview] = useState<boolean>(false);

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const transcriptContainerRef = useRef<HTMLDivElement>(null);
  const isMountedRef = useRef<boolean>(true);
  const onEntrySavedRef = useRef(onEntrySaved);
  onEntrySavedRef.current = onEntrySaved;
  const lastSavedFingerprintRef = useRef<string>('');

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Keep a fresh reference to the latest state for auto-save on leave/unmount
  const latestStateRef = useRef({
    entryId,
    userId: user.uid,
    character,
    title,
    content,
    mood,
    tags,
    messages,
    summary,
    lastReflectedMessageId,
    lastReflectedAt,
    createdAt: initialEntry?.createdAt || Date.now(),
  });

  useEffect(() => {
    latestStateRef.current = {
      entryId,
      userId: user.uid,
      character,
      title,
      content,
      mood,
      tags,
      messages,
      summary,
      lastReflectedMessageId,
      lastReflectedAt,
      createdAt: initialEntry?.createdAt || Date.now(),
    };
  }, [entryId, user.uid, character, title, content, mood, tags, messages, summary, lastReflectedMessageId, lastReflectedAt, initialEntry]);

  // Auto-save logic function
  const autoSaveEntry = useCallback(async (stateOverride?: Partial<typeof latestStateRef.current>): Promise<boolean> => {
    const currentState = { ...latestStateRef.current, ...stateOverride };
    
    // Only persist if there's meaningful content or conversation exchanges
    if (currentState.messages.length === 0 && !currentState.content.trim() && !currentState.title.trim()) {
      return false;
    }

    const updatedEntry: JournalEntry = {
      id: currentState.entryId,
      userId: currentState.userId,
      characterId: currentState.character.id,
      characterName: currentState.character.name,
      title: currentState.title.trim() || `Reflection with ${currentState.character.name} - ${new Date().toLocaleDateString()}`,
      content: currentState.content,
      mood: currentState.mood,
      tags: currentState.tags,
      messages: currentState.messages,
      summary: currentState.summary,
      lastReflectedMessageId: currentState.lastReflectedMessageId,
      lastReflectedAt: currentState.lastReflectedAt,
      createdAt: currentState.createdAt || Date.now(),
      updatedAt: Date.now(),
      wordCount: (currentState.content.trim() + ' ' + currentState.messages.map((m: ChatMessage) => m.content).join(' ')).trim().split(/\s+/).filter(Boolean).length,
    };

    try {
      if (isMountedRef.current) setIsSaving(true);
      await saveJournalEntry(currentState.userId, updatedEntry);
      if (isMountedRef.current) {
        setIsSaving(false);
        setSaveStatus('saved');
      }
      onEntrySavedRef.current?.(updatedEntry);
      return true;
    } catch (err: unknown) {
      console.error('Auto-save to Firestore failed:', err);
      if (isMountedRef.current) {
        setIsSaving(false);
        setSaveStatus('error');
        setErrorMessage((err as Error)?.message || 'Failed to auto-save conversation.');
      }
      return false;
    }
  }, []);

  // Sync state if selectedCharacter changes from parent
  useEffect(() => {
    if (selectedCharacter) {
      setCharacter(selectedCharacter);
    }
  }, [selectedCharacter]);

  // Sync state if initialEntry changes
  useEffect(() => {
    if (initialEntry) {
      setEntryId(initialEntry.id);
      setTitle(initialEntry.title);
      setContent(initialEntry.content);
      const foundChar = getCharacterById(initialEntry.characterId);
      setCharacter(foundChar);
      setMood(initialEntry.mood);
      setTags(initialEntry.tags || []);
      setMessages(initialEntry.messages || []);
      setSummary(initialEntry.summary || null);
      setLastReflectedMessageId(initialEntry.lastReflectedMessageId);
      setLastReflectedAt(initialEntry.lastReflectedAt);
    } else {
      setEntryId('entry_' + Date.now());
      setTitle('');
      setContent('');
      if (selectedCharacter) {
        setCharacter(selectedCharacter);
      }
      setMood('reflective');
      setTags(['companion-chat']);
      setMessages([]);
      setSummary(null);
      setLastReflectedMessageId(undefined);
      setLastReflectedAt(undefined);
    }
    setSaveStatus('idle');
    setErrorMessage(null);
    setPersonaNoteToast(null);
  }, [initialEntry, selectedCharacter]);

  // Auto-scroll the page to focus on the chatbox (NOT the typing box) when starting a new chat or switching character
  useEffect(() => {
    // When a chat opens/starts, smoothly align the chat container into main view
    const timer = setTimeout(() => {
      chatContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (transcriptContainerRef.current) {
        if (messages.length === 0) {
          transcriptContainerRef.current.scrollTop = 0;
        } else {
          transcriptContainerRef.current.scrollTop = transcriptContainerRef.current.scrollHeight;
        }
      }
    }, 80);

    return () => clearTimeout(timer);
  }, [entryId, character.id]);

  // Internal transcript scrolling for incoming messages (does NOT scroll the outer window)
  useEffect(() => {
    if (transcriptContainerRef.current) {
      transcriptContainerRef.current.scrollTo({
        top: transcriptContainerRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [messages, isGenerating, isWritingNote]);

  // Debounced auto-save on notes or metadata changes
  useEffect(() => {
    if (messages.length === 0 && !content.trim() && !title.trim()) return;

    const currentFingerprint = `${entryId}_${character.id}_${messages.length}_${content}_${title}_${mood}_${tags.join(',')}_${JSON.stringify(summary || null)}`;
    if (currentFingerprint === lastSavedFingerprintRef.current) return;

    const timer = setTimeout(() => {
      lastSavedFingerprintRef.current = currentFingerprint;
      autoSaveEntry();
    }, 1500);

    return () => clearTimeout(timer);
  }, [content, title, mood, tags, messages.length, character.id, entryId, summary, autoSaveEntry]);

  // Auto-save on component unmount / leaving the chat page
  useEffect(() => {
    return () => {
      const currentState = latestStateRef.current;
      if (currentState.messages.length > 0 || currentState.content.trim() || currentState.title.trim()) {
        const updatedEntry: JournalEntry = {
          id: currentState.entryId,
          userId: currentState.userId,
          characterId: currentState.character.id,
          characterName: currentState.character.name,
          title: currentState.title.trim() || `Reflection with ${currentState.character.name} - ${new Date().toLocaleDateString()}`,
          content: currentState.content,
          mood: currentState.mood,
          tags: currentState.tags,
          messages: currentState.messages,
          summary: currentState.summary,
          createdAt: currentState.createdAt || Date.now(),
          updatedAt: Date.now(),
          wordCount: (currentState.content.trim() + ' ' + currentState.messages.map((m: ChatMessage) => m.content).join(' ')).trim().split(/\s+/).filter(Boolean).length,
        };
        saveJournalEntry(currentState.userId, updatedEntry).catch((err) => {
          console.warn('Unmount auto-save caught:', err);
        });
      }
    };
  }, []);

  // Word count helper
  const wordCount = (content.trim() + ' ' + messages.map(m => m.content).join(' ')).trim().split(/\s+/).filter(Boolean).length;

  // Persist current state to Firestore
  const persistEntry = async (
    customMessages?: ChatMessage[],
    customSummary?: AISummary | null,
    customContent?: string,
    overrideCharId?: CharacterId,
    overrideCharName?: string,
    overrideLastReflectedId?: string
  ): Promise<boolean> => {
    const targetContent = customContent !== undefined ? customContent : content;
    const targetMessages = customMessages || messages;
    const targetSummary = customSummary !== undefined ? customSummary : summary;
    const targetChar = overrideCharId ? getCharacterById(overrideCharId) : character;

    return await autoSaveEntry({
      content: targetContent,
      messages: targetMessages,
      summary: targetSummary,
      character: targetChar,
      lastReflectedMessageId: overrideLastReflectedId !== undefined ? overrideLastReflectedId : lastReflectedMessageId,
      lastReflectedAt: overrideLastReflectedId ? Date.now() : lastReflectedAt,
    });
  };

  // Verify if there are actual new conversation additions or user thoughts to reflect upon
  const conversationAdditionsStatus = useMemo(() => {
    const userMessages = messages.filter((m) => m.role === 'user');
    const substantiveUserContent = content.replace(/###.*?\n|🌸.*?---|---/gs, '').trim();

    // If completely empty conversation and no user content
    if (userMessages.length === 0 && substantiveUserContent.length < 15) {
      return {
        canReflect: false,
        reason: `Please chat with ${character.name} or share your thoughts first before writing a reflection note.`,
        newCount: 0,
      };
    }

    // Messages since last reflection note was recorded
    let unreflectedMessages: ChatMessage[] = [];
    if (!lastReflectedMessageId) {
      // Check if existing content already has a reflection recorded previously
      const hasPriorNote = /🌸.*?Journal Entry/i.test(content) || /🌸.*?Note/i.test(content);
      if (hasPriorNote && userMessages.length === 0) {
        return {
          canReflect: false,
          reason: `No new conversation additions since the previous reflection with ${character.name}.`,
          newCount: 0,
        };
      }
      unreflectedMessages = userMessages;
    } else {
      const idx = messages.findIndex((m) => m.id === lastReflectedMessageId);
      if (idx === -1) {
        unreflectedMessages = userMessages;
      } else {
        unreflectedMessages = messages.slice(idx + 1).filter((m) => m.role === 'user');
      }
    }

    // Filter out pure command messages that only demand writing a reflection (e.g. "write note", "reflect please", "write in journal")
    const substantiveNewMessages = unreflectedMessages.filter((m) => {
      const text = m.content.trim().toLowerCase();
      const isPureCommand =
        /^(write|record|put|add|make|give me)?\s*(a\s*)?(new\s*)?(journal|note|reflection|entry|summary|diary)(\s*please|\s*now|\s*for today|\s*again|\s*more)?$/i.test(text) ||
        /^(reflect|write|summarize|continue writing|keep writing|write more)(\s*please|\s*now|\s*again)?$/i.test(text);
      return !isPureCommand && text.length >= 2;
    });

    if (lastReflectedMessageId && substantiveNewMessages.length === 0) {
      return {
        canReflect: false,
        reason: `No new conversation additions or updates since the last reflection note. Chat with ${character.name} to continue!`,
        newCount: 0,
      };
    }

    if (substantiveNewMessages.length === 0 && substantiveUserContent.length < 15) {
      return {
        canReflect: false,
        reason: `Please share a few thoughts with ${character.name} first.`,
        newCount: 0,
      };
    }

    return {
      canReflect: true,
      reason: '',
      newCount: substantiveNewMessages.length,
    };
  }, [messages, lastReflectedMessageId, content, character.name]);

  // Handle companion switch: saves current conversation and opens recent/new chat for the companion
  const handleSwitchCharacter = async (newChar: CharacterPersona) => {
    // Auto-save current conversation state before switching if there are active messages or content
    if (latestStateRef.current.messages.length > 0 || latestStateRef.current.content.trim() || latestStateRef.current.title.trim()) {
      await autoSaveEntry();
    }
    
    if (onSelectCharacter) {
      onSelectCharacter(newChar);
      return;
    }

    // Fallback if managed purely locally:
    const matchingEntries = (userEntries || []).filter((e) => e.characterId === newChar.id);
    if (matchingEntries.length > 0) {
      const sorted = [...matchingEntries].sort(
        (a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0)
      );
      const latest = sorted[0];
      setEntryId(latest.id);
      setTitle(latest.title);
      setContent(latest.content);
      setCharacter(newChar);
      setMood(latest.mood);
      setTags(latest.tags || []);
      setMessages(latest.messages || []);
      setSummary(latest.summary || null);
      setLastReflectedMessageId(latest.lastReflectedMessageId);
      setLastReflectedAt(latest.lastReflectedAt);
    } else {
      setEntryId('entry_' + Date.now());
      setTitle('');
      setContent('');
      setCharacter(newChar);
      setMood('reflective');
      setTags(['companion-chat']);
      setMessages([]);
      setSummary(null);
      setLastReflectedMessageId(undefined);
      setLastReflectedAt(undefined);
    }
    setSaveStatus('idle');
    setErrorMessage(null);
  };

  // Handle persona writing into journal notes
  const handlePersonaWriteJournalNote = async (customUserPrompt?: string, switchTabToNotes: boolean = false) => {
    if (isWritingNote || isGenerating) return;

    if (!conversationAdditionsStatus.canReflect) {
      setErrorMessage(conversationAdditionsStatus.reason);
      return;
    }

    setIsWritingNote(true);
    setErrorMessage(null);
    setPersonaNoteToast(null);

    try {
      const result = await generatePersonaJournalNote({
        characterId: character.id,
        characterName: character.name,
        systemInstruction: character.systemInstruction,
        messages,
        mood,
        journalTitle: title || `Reflection with ${character.name}`,
        existingContent: content,
        userRequest: customUserPrompt || noteCustomPrompt || '',
      });

      const now = new Date();
      const dateStr = now.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      const formattedPersonaSection = `\n\n---\n### 🌸 ${character.name}'s Journal Entry (${character.badge})\n*Recorded on ${dateStr} at ${timeStr}*\n\n${result.note}\n---`;
      
      const newContent = content.trim() ? `${content.trim()}${formattedPersonaSection}` : formattedPersonaSection.trim();
      setContent(newContent);

      const latestMsgId = messages.length > 0 ? messages[messages.length - 1].id : 'msg_reflected_' + Date.now();
      setLastReflectedMessageId(latestMsgId);
      setLastReflectedAt(Date.now());

      // Add a conversational confirmation message from the assistant
      const companionAckMessage: ChatMessage = {
        id: 'msg_note_ack_' + Date.now(),
        role: 'assistant',
        content: `I've written a special reflection in our **Journal Notes** for today! 📝✨\n\nYou can review or edit it anytime under the Journal Notes tab.`,
        timestamp: Date.now(),
      };

      const updatedMessages = [...messages, companionAckMessage];
      setMessages(updatedMessages);

      await persistEntry(updatedMessages, summary, newContent, undefined, undefined, latestMsgId);

      setPersonaNoteToast(`${character.name} wrote an entry into your Journal Notes!`);
      setTimeout(() => setPersonaNoteToast(null), 6000);

      if (switchTabToNotes) {
        setViewTab('notes');
      }
    } catch (err: unknown) {
      console.error('Failed to write persona journal note:', err);
      setErrorMessage((err as Error)?.message || `Could not write journal note from ${character.name}.`);
    } finally {
      setIsWritingNote(false);
      setNoteCustomPrompt('');
    }
  };

  // Handle sending a message in the character chat
  const handleSendMessage = async (textToSend?: string) => {
    const messageText = (textToSend || chatInput).trim();
    if (!messageText || isGenerating || isWritingNote) return;

    // Check if user is asking the persona to write into their journal directly
    const isAskingToWriteJournal = /(write|record|put|add).*(journal|note|diary)/i.test(messageText) || 
      /write.*(note|entry|reflection).*for today/i.test(messageText);

    const userMessage: ChatMessage = {
      id: 'msg_' + Date.now(),
      role: 'user',
      content: messageText,
      timestamp: Date.now(),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    if (!textToSend) setChatInput('');
    setIsGenerating(true);
    setErrorMessage(null);

    try {
      // Step 1: AI generates the response
      const response = await askGeminiReflection({
        prompt: messageText,
        title: title || `Conversation with ${character.name}`,
        characterId: character.id,
        characterName: character.name,
        systemInstruction: character.systemInstruction,
        mood,
        tags,
        history: newMessages.slice(0, -1),
      });

      // Step 2 & 3: Separate long reply into multiple text boxes and confirm strict sequential order
      const verifiedChunks = processAndVerifyMessageChunks(response.reply);

      // Step 4: Deliver each text box with a slight delay between messages
      let currentConversation = [...newMessages];

      for (let i = 0; i < verifiedChunks.length; i++) {
        const chunk = verifiedChunks[i];

        // Slight natural delay between each message bubble:
        // First bubble has a brief pause (350ms), subsequent bubbles have a staggered delay (600ms - 850ms)
        const delayMs = i === 0 ? 350 : Math.min(850, Math.max(550, chunk.length * 10));
        await new Promise((resolve) => setTimeout(resolve, delayMs));

        if (!isMountedRef.current) break;

        const chunkMsg: ChatMessage = {
          id: `msg_gemini_${Date.now()}_${i}`,
          role: 'assistant',
          content: chunk,
          timestamp: Date.now(),
        };

        currentConversation = [...currentConversation, chunkMsg];
        setMessages(currentConversation);
      }

      // Auto-save to Firestore after complete verified message sequence finishes
      await persistEntry(currentConversation, summary);

      // If user explicitly asked persona to write into the journal notes, trigger it automatically!
      if (isAskingToWriteJournal) {
        await handlePersonaWriteJournalNote(messageText, false);
      }
    } catch (err: unknown) {
      console.error('Gemini character conversation error:', err);
      setErrorMessage((err as Error)?.message || `Could not get a response from ${character.name}. Please check your connection or try again.`);
    } finally {
      setIsGenerating(false);
    }
  };

  // Handle AI summary generation
  const handleGenerateSummary = async () => {
    if (messages.length === 0 && !content.trim()) {
      setErrorMessage('Please share a few thoughts or messages with your companion first before generating a reflection summary.');
      return;
    }

    setIsSummarizing(true);
    setErrorMessage(null);

    try {
      const result = await generateEntrySummary(content, messages, mood);
      setSummary(result.summary);
      setViewTab('insights');
      await persistEntry(messages, result.summary);
    } catch (err: unknown) {
      console.error('Summarize error:', err);
      setErrorMessage((err as Error)?.message || 'Failed to synthesize summary insights.');
    } finally {
      setIsSummarizing(false);
    }
  };

  // Tag management
  const handleAddTag = (e: React.KeyboardEvent | React.MouseEvent) => {
    if ('key' in e && e.key !== 'Enter') return;
    e.preventDefault();
    const clean = tagInput.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
    if (clean && !tags.includes(clean)) {
      const newTags = [...tags, clean];
      setTags(newTags);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  // Copy message helper
  const handleCopyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div ref={chatContainerRef} className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Top Banner / Breadcrumb & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          {/* Active Companion Avatar Badge */}
          <div className="relative group cursor-pointer" onClick={onChangeCharacterRequest}>
            <img
              src={character.avatarUrl}
              alt={character.name}
              referrerPolicy="no-referrer"
              className="w-12 h-12 rounded-2xl object-cover ring-2 ring-slate-200 shadow-xs"
            />
            <span
              className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full ring-2 ring-white"
              style={{ backgroundColor: character.themeColor.primary }}
            />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
                <span>{character.name}</span>
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-bold text-white shadow-2xs"
                  style={{ backgroundColor: character.themeColor.primary }}
                >
                  {character.badge}
                </span>
              </h2>
              {onChangeCharacterRequest && (
                <button
                  type="button"
                  onClick={onChangeCharacterRequest}
                  className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2.5 py-1 rounded-lg border border-indigo-200 transition-colors flex items-center gap-1"
                >
                  <Users className="w-3 h-3" />
                  <span>Change Companion</span>
                </button>
              )}
            </div>
            <p className="text-xs text-slate-500 font-medium">
              {character.subtitle} • Auto-saving enabled
            </p>
          </div>
        </div>

        {/* Global Action Bar */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Quick Character Mini-Switch */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            {CHARACTERS.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => handleSwitchCharacter(c)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                  character.id === c.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: c.themeColor.primary }}
                />
                <span>{c.name}</span>
              </button>
            ))}
          </div>

          {/* Auto-save Status Pill */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs">
            {isSaving ? (
              <>
                <RefreshCw className="w-3 h-3 text-indigo-500 animate-spin" />
                <span className="text-slate-500 font-medium">Auto-saving...</span>
              </>
            ) : saveStatus === 'saved' ? (
              <>
                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                <span className="text-emerald-700 font-medium">Saved</span>
              </>
            ) : saveStatus === 'error' ? (
              <>
                <AlertCircle className="w-3 h-3 text-rose-500" />
                <span className="text-rose-600 font-medium">Save error</span>
              </>
            ) : (
              <>
                <Cloud className="w-3 h-3 text-slate-400" />
                <span className="text-slate-400 font-medium">Cloud sync active</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Persona Note Notification Banner */}
      {personaNoteToast && (
        <div className="mb-4 p-3.5 rounded-2xl bg-gradient-to-r from-pink-50 to-indigo-50 border border-pink-200 text-slate-800 text-xs font-medium flex items-center justify-between shadow-2xs animate-fade-in">
          <div className="flex items-center gap-2.5">
            <BookHeart className="w-4 h-4 text-pink-600 shrink-0" />
            <span>
              <strong>{personaNoteToast}</strong> You can view and edit the companion entry in your Journal Notes.
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setViewTab('notes');
              setPersonaNoteToast(null);
            }}
            className="px-2.5 py-1 rounded-lg text-xs font-bold text-pink-700 bg-white border border-pink-200 hover:bg-pink-50 flex items-center gap-1 shrink-0 ml-2"
          >
            <span>View Notes</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Save Status & Error Notifications */}
      {saveStatus === 'saved' && !personaNoteToast && (
        <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Conversation and notes saved safely to your private Cloud Firestore collection.</span>
          </div>
          <span className="text-[11px] text-emerald-600 opacity-80">
            {new Date().toLocaleTimeString()}
          </span>
        </div>
      )}

      {errorMessage && (
        <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="text-rose-600 hover:text-rose-800 font-bold ml-2"
          >
            ✕
          </button>
        </div>
      )}

      {/* Main Experience Layout: Two-Column Bento */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Character Stage & Metadata (4 Cols on lg) */}
        <div className="lg:col-span-4 space-y-5">
          {/* Character Spotlight Card */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs relative overflow-hidden">
            <div
              className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-30 pointer-events-none -mr-10 -mt-10"
              style={{ backgroundColor: character.themeColor.primary }}
            />

            <div className="flex items-center gap-4 mb-4">
              <img
                src={character.portraitUrl}
                alt={character.name}
                referrerPolicy="no-referrer"
                className="w-20 h-20 rounded-2xl object-cover ring-2 ring-slate-100 shadow-sm"
              />
              <div>
                <div className="flex items-center gap-1.5 mb-1">
                  <span
                    className="px-2 py-0.5 rounded-md text-[11px] font-bold text-white"
                    style={{ backgroundColor: character.themeColor.primary }}
                  >
                    {character.badge}
                  </span>
                  <span className="text-xs text-slate-400 font-semibold">• Active</span>
                </div>
                <h3 className="text-lg font-bold text-slate-900 leading-tight">{character.name}</h3>
                <p className="text-xs text-slate-500 font-medium">{character.subtitle}</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed mb-4 p-3 bg-slate-50 rounded-2xl border border-slate-100">
              {character.description}
            </p>

            {/* Persona Action: Ask to write into journal */}
            <div className="mb-4">
              <button
                type="button"
                onClick={() => handlePersonaWriteJournalNote(undefined, true)}
                disabled={isWritingNote || !conversationAdditionsStatus.canReflect}
                title={!conversationAdditionsStatus.canReflect ? conversationAdditionsStatus.reason : `Ask ${character.name} to write daily reflection`}
                className="w-full py-2.5 px-3 rounded-2xl text-xs font-bold text-slate-800 bg-gradient-to-r from-pink-50 to-indigo-50 border border-pink-200 hover:from-pink-100 hover:to-indigo-100 transition-all flex items-center justify-center gap-2 shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <PenLine className="w-4 h-4 text-pink-600" />
                <span>Ask {character.name} to Write Daily Note</span>
              </button>
              {!conversationAdditionsStatus.canReflect && (
                <p className="text-[10px] text-slate-400 mt-1.5 px-1 text-center leading-tight">
                  {lastReflectedMessageId ? '✨ Reflections up to date. Chat more to unlock new notes!' : '💭 Chat with companion first to unlock daily notes.'}
                </p>
              )}
            </div>

            {/* Conversation Starter Chips */}
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-500" />
                <span>Quick Conversation Starters</span>
              </p>
              <div className="flex flex-col gap-1.5">
                {character.initialPrompts.map((prompt, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSendMessage(prompt)}
                    disabled={isGenerating || isWritingNote}
                    className="text-left text-xs font-medium p-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200/80 transition-colors flex items-center justify-between group disabled:opacity-50"
                  >
                    <span className="line-clamp-1">&ldquo;{prompt}&rdquo;</span>
                    <Send className="w-3 h-3 text-slate-400 group-hover:text-indigo-600 shrink-0 ml-1 transition-colors" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Session Topic & Metadata Card */}
          <div className="bg-white rounded-3xl p-5 border border-slate-200 shadow-xs space-y-4">
            {/* Title / Topic input */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Conversation Topic / Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={`Chat with ${character.name}...`}
                className="w-full px-3.5 py-2 rounded-xl text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-slate-50/50"
              />
            </div>

            {/* Mood Selector */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Your Current Emotional State
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {moodOptions.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setMood(opt.id)}
                    className={`px-2 py-1.5 rounded-xl text-xs font-medium border text-center transition-all flex items-center justify-center gap-1 ${
                      mood === opt.id
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700 font-bold shadow-2xs'
                        : 'border-slate-200 hover:border-slate-300 text-slate-600 bg-white'
                    }`}
                  >
                    <span>{opt.emoji}</span>
                    <span className="truncate">{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Tags Management */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                Theme Tags
              </label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200"
                  >
                    <span>#{tag}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveTag(tag)}
                      className="text-slate-400 hover:text-slate-700 ml-0.5"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleAddTag}
                  placeholder="Add tag (e.g. goals, mood, thoughts)..."
                  className="flex-1 px-3 py-1.5 rounded-xl text-xs border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-slate-50/50"
                />
                <button
                  type="button"
                  onClick={handleAddTag}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Main Dialogue & Insights Panel (8 Cols on lg) */}
        <div className="lg:col-span-8 flex flex-col space-y-4">
          
          {/* View Tab Switcher */}
          <div className="flex items-center justify-between bg-slate-100 p-1 rounded-2xl border border-slate-200 w-full">
            <div className="flex items-center gap-1 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => setViewTab('chat')}
                className={`flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  viewTab === 'chat'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <MessageSquareHeart className="w-3.5 h-3.5 text-indigo-600" />
                <span>Conversation ({messages.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setViewTab('notes')}
                className={`flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  viewTab === 'notes'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5 text-emerald-600" />
                <span>Journal Notes</span>
                {content.trim() && (
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setViewTab('insights')}
                className={`flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                  viewTab === 'insights'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>AI Insights {summary && '• Available'}</span>
              </button>
            </div>

            <div className="hidden sm:flex items-center gap-2 pr-3 text-xs text-slate-400 font-medium">
              <span>{wordCount} words</span>
            </div>
          </div>

          {/* TAB 1: CHARACTER CONVERSATION VIEW */}
          {viewTab === 'chat' && (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-xs flex flex-col h-[620px] overflow-hidden">
              
              {/* Dialogue Transcript Container */}
              <div ref={transcriptContainerRef} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-slate-50/40">
                
                {/* Character Greeting Welcome Bubble */}
                <div className="flex items-start gap-3 max-w-2xl">
                  <img
                    src={character.avatarUrl}
                    alt={character.name}
                    referrerPolicy="no-referrer"
                    className="w-9 h-9 rounded-xl object-cover ring-2 ring-slate-200 shrink-0 mt-0.5"
                  />
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-800">{character.name}</span>
                      <span
                        className="text-[10px] font-bold px-1.5 py-0.2 rounded text-white"
                        style={{ backgroundColor: character.themeColor.primary }}
                      >
                        {character.badge}
                      </span>
                    </div>
                    <div className="p-3.5 rounded-2xl rounded-tl-sm bg-white border border-slate-200/90 text-sm text-slate-800 shadow-2xs leading-relaxed">
                      {character.greeting}
                    </div>
                  </div>
                </div>

                {/* Conversation History Messages */}
                {messages.map((msg, index) => {
                  const isUser = msg.role === 'user';
                  const prevMsg = index > 0 ? messages[index - 1] : null;
                  const isSameSenderAsPrev = prevMsg && prevMsg.role === msg.role;

                  return (
                    <div
                      key={msg.id}
                      className={`flex items-start gap-3 transition-all duration-300 ${
                        isUser ? 'flex-row-reverse self-end' : 'max-w-2xl'
                      } ${isSameSenderAsPrev ? 'mt-1.5' : 'mt-4'}`}
                    >
                      {!isUser ? (
                        !isSameSenderAsPrev ? (
                          <img
                            src={character.avatarUrl}
                            alt={character.name}
                            referrerPolicy="no-referrer"
                            className="w-9 h-9 rounded-xl object-cover ring-2 ring-slate-200 shrink-0 mt-0.5"
                          />
                        ) : (
                          <div className="w-9 h-9 shrink-0" aria-hidden="true" />
                        )
                      ) : (
                        !isSameSenderAsPrev ? (
                          <div className="w-9 h-9 rounded-xl bg-slate-900 text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                            {user.displayName ? user.displayName[0].toUpperCase() : 'U'}
                          </div>
                        ) : (
                          <div className="w-9 h-9 shrink-0" aria-hidden="true" />
                        )
                      )}

                      <div className={`space-y-1 max-w-[85%] ${isUser ? 'items-end' : 'items-start'}`}>
                        {!isSameSenderAsPrev && (
                          <div className={`flex items-center gap-2 ${isUser ? 'justify-end' : ''}`}>
                            <span className="text-xs font-bold text-slate-700">
                              {isUser ? 'You' : character.name}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        )}

                        <div
                          className={`group relative p-4 rounded-2xl text-sm leading-relaxed animate-in fade-in slide-in-from-bottom-1 duration-200 ${
                            isUser
                              ? 'bg-indigo-600 text-white rounded-tr-sm shadow-2xs'
                              : 'bg-white border border-slate-200/90 text-slate-800 rounded-tl-sm shadow-2xs'
                          }`}
                        >
                          <div className={isUser ? 'text-white' : 'prose prose-sm text-slate-800 max-w-none'}>
                            <Markdown>{msg.content}</Markdown>
                          </div>

                          {/* Quick copy button */}
                          <button
                            type="button"
                            onClick={() => handleCopyText(msg.id, msg.content)}
                            className={`absolute top-2 right-2 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity ${
                              isUser ? 'text-indigo-200 hover:text-white' : 'text-slate-400 hover:text-slate-700'
                            }`}
                            title="Copy message"
                          >
                            {copiedId === msg.id ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Live Character Thinking indicator */}
                {isGenerating && (
                  <div className="flex items-start gap-3 max-w-xl">
                    <img
                      src={character.avatarUrl}
                      alt={character.name}
                      referrerPolicy="no-referrer"
                      className="w-9 h-9 rounded-xl object-cover ring-2 ring-slate-200 shrink-0 animate-pulse"
                    />
                    <div className="p-3.5 rounded-2xl rounded-tl-sm bg-white border border-slate-200 text-sm text-slate-500 shadow-2xs flex items-center gap-2">
                      <div className="flex gap-1">
                        <span className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce [animation-delay:-0.3s]" />
                        <span className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce [animation-delay:-0.15s]" />
                        <span className="w-2 h-2 rounded-full bg-indigo-500 animate-bounce" />
                      </div>
                      <span className="text-xs font-medium italic">
                        {character.name} is formulating a thoughtful response...
                      </span>
                    </div>
                  </div>
                )}

                {/* Persona Writing Journal Note Indicator */}
                {isWritingNote && (
                  <div className="flex items-start gap-3 max-w-xl">
                    <img
                      src={character.avatarUrl}
                      alt={character.name}
                      referrerPolicy="no-referrer"
                      className="w-9 h-9 rounded-xl object-cover ring-2 ring-pink-300 shrink-0 animate-pulse"
                    />
                    <div className="p-3.5 rounded-2xl rounded-tl-sm bg-pink-50/90 border border-pink-200 text-sm text-pink-900 shadow-2xs flex items-center gap-2.5">
                      <PenLine className="w-4 h-4 text-pink-600 animate-bounce" />
                      <span className="text-xs font-semibold">
                        {character.name} is writing a heartfelt companion note into your Journal Notes...
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* End of Chat / Persona Write Journal Note Action Strip */}
              <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handlePersonaWriteJournalNote('Conclude today\'s conversation and record your companion journal reflection.', false)}
                    disabled={isWritingNote || isGenerating || !conversationAdditionsStatus.canReflect}
                    title={!conversationAdditionsStatus.canReflect ? conversationAdditionsStatus.reason : `Conclude conversation and record journal entry with ${character.name}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-pink-700 bg-pink-100/70 hover:bg-pink-100 border border-pink-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <BookHeart className="w-3.5 h-3.5 text-pink-600" />
                    <span>Conclude &amp; Have {character.name} Write in Journal</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setViewTab('notes')}
                    className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors hidden sm:inline"
                  >
                    View Journal Notes ({content ? 'Contains notes' : 'Empty'}) →
                  </button>
                </div>

                <span className="text-[11px] text-slate-400">
                  {messages.length} exchanges
                </span>
              </div>

              {/* Chat Input Bar */}
              <div className="p-3 sm:p-4 bg-white border-t border-slate-100">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendMessage();
                  }}
                  className="flex items-center gap-2"
                >
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder={`Message ${character.name} (or type "write in my journal")...`}
                    disabled={isGenerating || isWritingNote}
                    className="flex-1 px-4 py-3 rounded-2xl text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 bg-slate-50/50 disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={isGenerating || isWritingNote || !chatInput.trim()}
                    className="px-5 py-3 rounded-2xl font-bold text-white shadow-md flex items-center justify-center gap-1.5 transition-transform active:scale-95 disabled:opacity-50"
                    style={{ backgroundColor: character.themeColor.primary }}
                  >
                    <Send className="w-4 h-4" />
                    <span className="hidden sm:inline">Send</span>
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* TAB 2: JOURNAL NOTES VIEW */}
          {viewTab === 'notes' && (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-5 sm:p-6 flex flex-col h-[620px]">
              
              {/* Co-Writing with Persona Header Card */}
              <div className="mb-4 p-4 rounded-2xl bg-gradient-to-r from-pink-50/90 via-indigo-50/60 to-purple-50/80 border border-pink-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <img
                    src={character.avatarUrl}
                    alt={character.name}
                    referrerPolicy="no-referrer"
                    className="w-10 h-10 rounded-xl object-cover ring-2 ring-white shadow-2xs"
                  />
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <span>Co-Write with {character.name}</span>
                      <span
                        className="text-[10px] font-bold px-1.5 py-0.2 rounded text-white"
                        style={{ backgroundColor: character.themeColor.primary }}
                      >
                        {character.badge}
                      </span>
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Ask {character.name} to write an entry based on your thoughts and conversations today.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={noteCustomPrompt}
                    onChange={(e) => setNoteCustomPrompt(e.target.value)}
                    placeholder="Optional focus (e.g. highlight our chat)..."
                    className="text-xs px-3 py-1.5 rounded-xl border border-slate-200 bg-white/90 focus:outline-none focus:ring-2 focus:ring-pink-500/20 max-w-[200px]"
                  />
                  <button
                    type="button"
                    onClick={() => handlePersonaWriteJournalNote(noteCustomPrompt, false)}
                    disabled={isWritingNote || !conversationAdditionsStatus.canReflect}
                    title={!conversationAdditionsStatus.canReflect ? conversationAdditionsStatus.reason : `Ask ${character.name} to write an entry`}
                    className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-pink-600 hover:bg-pink-700 shadow-xs transition-colors flex items-center gap-1.5 shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <PenLine className={`w-3.5 h-3.5 ${isWritingNote ? 'animate-spin' : ''}`} />
                    <span>{isWritingNote ? 'Writing...' : `Ask ${character.name}`}</span>
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-bold text-slate-700">Daily Journal Notes &amp; Companion Reflections</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowNotesPreview(!showNotesPreview)}
                    className="px-2.5 py-1 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition-colors flex items-center gap-1"
                  >
                    {showNotesPreview ? <Edit3 className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    <span>{showNotesPreview ? 'Edit Plaintext' : 'Preview Markdown'}</span>
                  </button>
                </div>
              </div>

              {/* Textarea or Markdown Render */}
              {showNotesPreview ? (
                <div className="flex-1 w-full p-4 rounded-2xl text-sm border border-slate-200 bg-slate-50/40 overflow-y-auto prose prose-sm text-slate-800 max-w-none">
                  {content.trim() ? (
                    <Markdown>{content}</Markdown>
                  ) : (
                    <p className="text-slate-400 italic">No notes written yet. Click &ldquo;Ask {character.name}&rdquo; above or type your thoughts in edit mode.</p>
                  )}
                </div>
              ) : (
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Write your longform thoughts, memories, reflections, or stream-of-consciousness here. When you or your companion write notes, they will appear here and save to Firestore..."
                  className="flex-1 w-full p-4 rounded-2xl text-sm border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 bg-slate-50/30 resize-none font-mono text-slate-800 leading-relaxed"
                />
              )}

              <div className="mt-4 flex items-center justify-between">
                <p className="text-xs text-slate-500">
                  Notes auto-save seamlessly to your private Firestore record as you write.
                </p>
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                  {isSaving ? (
                    <>
                      <RefreshCw className="w-3 h-3 text-indigo-500 animate-spin" />
                      <span className="text-slate-500 font-medium">Auto-saving...</span>
                    </>
                  ) : saveStatus === 'saved' ? (
                    <>
                      <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                      <span className="text-emerald-700 font-medium">Notes Saved</span>
                    </>
                  ) : (
                    <>
                      <Cloud className="w-3 h-3 text-slate-400" />
                      <span className="text-slate-500 font-medium">Auto-save on</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: AI SYNTHESIS & INSIGHTS VIEW */}
          {viewTab === 'insights' && (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-5 sm:p-6 h-[620px] overflow-y-auto">
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Sparkles className="w-4.5 h-4.5 text-amber-500" />
                    <span>Gemini Journal Reflection Synthesis</span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Structured takeaways and emotional reflections extracted from your conversation with {character.name}.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleGenerateSummary}
                  disabled={isSummarizing}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition-colors flex items-center gap-1.5 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSummarizing ? 'animate-spin' : ''}`} />
                  <span>{isSummarizing ? 'Analyzing...' : 'Regenerate'}</span>
                </button>
              </div>

              {summary ? (
                <div className="space-y-5">
                  {/* Synthesis Title */}
                  <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-100">
                    <span className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider">
                      Synthesis Theme
                    </span>
                    <h4 className="text-lg font-bold text-slate-900 mt-1">{summary.title}</h4>
                  </div>

                  {/* Key Insights List */}
                  <div>
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                      Key Core Insights
                    </h4>
                    <div className="space-y-2">
                      {summary.keyInsights?.map((insight, idx) => (
                        <div
                          key={idx}
                          className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 text-sm text-slate-700 flex items-start gap-2.5"
                        >
                          <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                            {idx + 1}
                          </span>
                          <span className="leading-relaxed">{insight}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Actionable Micro-Step */}
                  {summary.actionableStep && (
                    <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200">
                      <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Recommended Micro-Action</span>
                      </span>
                      <p className="text-sm text-emerald-900 font-medium mt-1 leading-relaxed">
                        {summary.actionableStep}
                      </p>
                    </div>
                  )}

                  {/* Emotional Shift Arc */}
                  {summary.emotionalShift && (
                    <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200">
                      <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider flex items-center gap-1">
                        <Smile className="w-3.5 h-3.5" />
                        <span>Emotional Trajectory</span>
                      </span>
                      <p className="text-sm text-amber-900 mt-1 leading-relaxed">
                        {summary.emotionalShift}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-16 px-4">
                  <Sparkles className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <h4 className="text-base font-bold text-slate-700">No Insights Generated Yet</h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
                    Exchange a few messages with {character.name} and click &ldquo;Summarize Insights&rdquo; to extract structured themes, emotional trajectories, and action steps.
                  </p>
                  <button
                    type="button"
                    onClick={handleGenerateSummary}
                    disabled={isSummarizing || (messages.length === 0 && !content.trim())}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50"
                  >
                    Extract Insights Now
                  </button>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
};
