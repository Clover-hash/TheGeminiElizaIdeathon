import { ChatMessage, CharacterId, MoodType, AISummary } from '../types';

export interface ReflectRequest {
  prompt: string;
  title?: string;
  characterId?: CharacterId;
  characterName?: string;
  systemInstruction?: string;
  mood: MoodType;
  tags: string[];
  history: ChatMessage[];
}

export interface ReflectResponse {
  reply: string;
  modelUsed: string;
  timestamp: number;
}

export interface SummarizeResponse {
  summary: AISummary;
  modelUsed: string;
}

export async function askGeminiReflection(params: ReflectRequest): Promise<ReflectResponse> {
  const response = await fetch('/api/gemini/reflect', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    let errorMsg = 'Failed to generate Gemini reflection.';
    try {
      const errData = await response.json();
      if (errData.error) errorMsg = errData.error;
    } catch {
      // ignore
    }
    throw new Error(errorMsg);
  }

  return response.json();
}

export interface PersonaJournalNoteRequest {
  characterId: CharacterId;
  characterName: string;
  systemInstruction?: string;
  messages: ChatMessage[];
  mood: MoodType;
  journalTitle?: string;
  existingContent?: string;
  userRequest?: string;
}

export interface PersonaJournalNoteResponse {
  note: string;
  modelUsed: string;
  timestamp: number;
}

export async function generatePersonaJournalNote(
  params: PersonaJournalNoteRequest
): Promise<PersonaJournalNoteResponse> {
  const response = await fetch('/api/gemini/write-journal-note', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    let errorMsg = 'Failed to generate companion journal note.';
    try {
      const errData = await response.json();
      if (errData.error) errorMsg = errData.error;
    } catch {
      // ignore
    }
    throw new Error(errorMsg);
  }

  return response.json();
}

export async function generateEntrySummary(
  content: string,
  messages: ChatMessage[],
  mood: MoodType
): Promise<SummarizeResponse> {
  const response = await fetch('/api/gemini/summarize', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ content, messages, mood }),
  });

  if (!response.ok) {
    let errorMsg = 'Failed to generate summary.';
    try {
      const errData = await response.json();
      if (errData.error) errorMsg = errData.error;
    } catch {
      // ignore
    }
    throw new Error(errorMsg);
  }

  return response.json();
}

export interface SecurityCheckRequest {
  payload: string;
  action?: string;
  actorRole?: string;
  directive?: string;
}

export interface SecurityCheckResponse {
  passed: boolean;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  violations: string[];
  recommendations: string[];
  aiAnalysis: string;
  checkedAt: number;
  modelUsed: string;
}

export async function runSecurityDirectiveCheck(
  params: SecurityCheckRequest
): Promise<SecurityCheckResponse> {
  const response = await fetch('/api/admin/security-check', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    let errorMsg = 'Failed to execute security directive check.';
    try {
      const errData = await response.json();
      if (errData.error) errorMsg = errData.error;
    } catch {
      // ignore
    }
    throw new Error(errorMsg);
  }

  return response.json();
}

export async function fetchAdminTelemetry(): Promise<any> {
  const response = await fetch('/api/admin/telemetry');
  if (!response.ok) {
    throw new Error('Failed to retrieve system telemetry.');
  }
  return response.json();
}


