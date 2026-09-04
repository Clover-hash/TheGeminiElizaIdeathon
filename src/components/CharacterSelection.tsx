import React, { useState } from 'react';
import { CHARACTERS } from '../data/characters';
import { CharacterPersona, JournalEntry } from '../types';
import { Sparkles, MessageCircle, Heart, Star, ArrowRight, Plus, History, Clock } from 'lucide-react';

interface CharacterSelectionProps {
  onSelectCharacter: (character: CharacterPersona, mode?: 'continue' | 'new') => void;
  selectedCharacterId?: string;
  userEntries?: JournalEntry[];
}

export const CharacterSelection: React.FC<CharacterSelectionProps> = ({
  onSelectCharacter,
  selectedCharacterId = 'deredere',
  userEntries = [],
}) => {
  const [activeId, setActiveId] = useState<string>(selectedCharacterId);
  const activeChar = CHARACTERS.find((c) => c.id === activeId) || CHARACTERS[0];

  const activeCharEntries = userEntries.filter((e) => e.characterId === activeChar.id);
  const hasActiveCharChats = activeCharEntries.length > 0;

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header Section */}
      <div className="text-center max-w-3xl mx-auto mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 mb-3 shadow-xs">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Journaling &amp; Reflecting with an AI Companion</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
          Select Your Reflection Companion
        </h1>
        <p className="mt-3 text-base sm:text-lg text-slate-600">
          Each companion brings a distinct perspective, tone, and empathy to your reflections. Continue your most recent journal conversation or start a fresh reflection session.
        </p>
      </div>

      {/* Character Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        {CHARACTERS.map((char) => {
          const isSelected = activeId === char.id;
          const charEntries = userEntries.filter((e) => e.characterId === char.id);
          const hasExistingChats = charEntries.length > 0;
          const latestEntry = hasExistingChats
            ? [...charEntries].sort(
                (a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0)
              )[0]
            : null;

          return (
            <div
              key={char.id}
              onClick={() => setActiveId(char.id)}
              className={`group relative rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 flex flex-col justify-between border ${
                isSelected
                  ? 'border-indigo-600 ring-2 ring-indigo-500/30 shadow-xl scale-[1.02] bg-white'
                  : 'border-slate-200 hover:border-slate-300 hover:shadow-md bg-white/90'
              }`}
            >
              {/* Image & Header */}
              <div className="relative aspect-4/3 w-full overflow-hidden bg-slate-100">
                <img
                  src={char.portraitUrl}
                  alt={char.name}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-slate-900/20 to-transparent" />

                {/* Persona Archetype Badge */}
                <div className="absolute top-3 left-3">
                  <span
                    className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold text-white shadow-sm"
                    style={{ backgroundColor: char.themeColor.primary }}
                  >
                    <Heart className="w-3 h-3 fill-current" />
                    {char.badge}
                  </span>
                </div>

                {/* Selected Indicator */}
                {isSelected && (
                  <div className="absolute top-3 right-3 bg-indigo-600 text-white rounded-full p-1 shadow-md">
                    <Star className="w-3.5 h-3.5 fill-current" />
                  </div>
                )}

                {/* Name & Subtitle overlay */}
                <div className="absolute bottom-3 left-3 right-3 text-white">
                  <h3 className="text-xl font-bold tracking-tight">{char.name}</h3>
                  <p className="text-xs text-slate-200 font-medium opacity-90">{char.subtitle}</p>
                </div>
              </div>

              {/* Card Body */}
              <div className="p-4 flex-1 flex flex-col justify-between">
                <div>
                  <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-1">
                    {char.tagline}
                  </p>
                  <p className="text-sm text-slate-600 line-clamp-3 mb-3 leading-relaxed">
                    {char.description}
                  </p>
                </div>

                {/* Status indicator: existing chats count */}
                {hasExistingChats && latestEntry && (
                  <div className="mb-3 px-2.5 py-1.5 rounded-xl bg-indigo-50/70 border border-indigo-100 flex items-center justify-between text-[11px] text-indigo-900">
                    <span className="flex items-center gap-1 font-medium">
                      <Clock className="w-3 h-3 text-indigo-500" />
                      <span>{charEntries.length} saved {charEntries.length === 1 ? 'chat' : 'chats'}</span>
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {new Date(latestEntry.updatedAt || latestEntry.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                )}

                {/* Starter greeting snippet */}
                <div className="pt-2 border-t border-slate-100">
                  <div className="text-xs text-slate-500 italic bg-slate-50 p-2.5 rounded-xl border border-slate-100 line-clamp-2">
                    &ldquo;{char.greeting}&rdquo;
                  </div>
                </div>

                {/* Action Choices: Continue Recent vs New Chat */}
                <div className="mt-4 space-y-2">
                  {hasExistingChats ? (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveId(char.id);
                          onSelectCharacter(char, 'continue');
                        }}
                        className="py-2.5 px-3 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs flex items-center justify-center gap-1.5 transition-colors"
                        title="Resume most recent reflection"
                      >
                        <History className="w-3.5 h-3.5" />
                        <span>Continue</span>
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveId(char.id);
                          onSelectCharacter(char, 'new');
                        }}
                        className="py-2.5 px-3 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 flex items-center justify-center gap-1.5 transition-colors"
                        title="Start a fresh reflection session"
                      >
                        <Plus className="w-3.5 h-3.5 text-indigo-600" />
                        <span>New Entry</span>
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveId(char.id);
                        onSelectCharacter(char, 'new');
                      }}
                      className="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs flex items-center justify-center gap-2 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Start Reflection with {char.name}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Active Character Spotlight / Details preview */}
      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Avatar & Quick Stats */}
          <div className="lg:col-span-4 flex flex-col sm:flex-row lg:flex-col items-center gap-4 text-center sm:text-left lg:text-center">
            <div className="relative">
              <img
                src={activeChar.portraitUrl}
                alt={activeChar.name}
                referrerPolicy="no-referrer"
                className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl object-cover ring-4 ring-slate-100 shadow-md"
              />
              <span
                className="absolute -bottom-2 -right-2 px-2.5 py-0.5 rounded-full text-xs font-bold text-white shadow-sm"
                style={{ backgroundColor: activeChar.themeColor.primary }}
              >
                {activeChar.badge}
              </span>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900">{activeChar.name}</h2>
              <p className="text-sm font-medium text-slate-500">{activeChar.subtitle}</p>
              <div className="flex items-center justify-center sm:justify-start lg:justify-center gap-2 mt-2">
                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Online & Ready
                </span>
                <span className="text-xs text-slate-400 font-medium">Isolated Firestore Storage</span>
              </div>
            </div>
          </div>

          {/* Description & Starter questions */}
          <div className="lg:col-span-8 flex flex-col justify-between">
            <div>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                Character Archetype & Approach
              </h3>
              <p className="text-slate-700 text-sm sm:text-base leading-relaxed mb-4">
                {activeChar.description}
              </p>

              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                Conversation Starters
              </h3>
              <div className="flex flex-wrap gap-2 mb-6">
                {activeChar.initialPrompts.map((prompt, idx) => (
                  <span
                    key={idx}
                    className="text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 transition-colors"
                  >
                    &ldquo;{prompt}&rdquo;
                  </span>
                ))}
              </div>
            </div>

            {/* Spotlight CTA Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-4 border-t border-slate-100">
              {hasActiveCharChats && (
                <button
                  type="button"
                  onClick={() => onSelectCharacter(activeChar, 'continue')}
                  className="w-full sm:w-auto px-5 py-3 rounded-xl font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 flex items-center justify-center gap-2 transition-colors"
                >
                  <History className="w-4 h-4 text-indigo-600" />
                  <span>Continue Reflection ({activeCharEntries.length} saved)</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => onSelectCharacter(activeChar, 'new')}
                className="w-full sm:w-auto px-6 py-3 rounded-xl font-bold text-white shadow-md flex items-center justify-center gap-2 transition-transform active:scale-95"
                style={{ backgroundColor: activeChar.themeColor.primary }}
              >
                <Plus className="w-4 h-4" />
                <span>Start Fresh Reflection with {activeChar.name}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
