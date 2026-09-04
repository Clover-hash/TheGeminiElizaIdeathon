export type CharacterId = 'deredere' | 'kuudere' | 'rindere' | 'flawed';

export interface CharacterPersona {
  id: CharacterId;
  name: string;
  subtitle: string;
  tagline: string;
  description: string;
  avatarUrl: string;
  portraitUrl: string;
  badge: string;
  themeColor: {
    primary: string;
    secondary: string;
    border: string;
    bgGlow: string;
    bubble: string;
    text: string;
    accent: string;
  };
  greeting: string;
  initialPrompts: string[];
  systemInstruction: string;
}

export type MoodType = 
  | 'calm'
  | 'inspired'
  | 'anxious'
  | 'reflective'
  | 'energetic'
  | 'tired'
  | 'grateful';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  expression?: 'happy' | 'shy' | 'neutral' | 'serious' | 'flustered' | 'warm';
}

export interface AISummary {
  title: string;
  keyInsights: string[];
  actionableStep?: string;
  emotionalShift?: string;
  generatedAt: number;
}

export interface JournalEntry {
  id: string;
  userId: string;
  characterId: CharacterId;
  characterName: string;
  title: string;
  content: string;
  mood: MoodType;
  tags: string[];
  messages: ChatMessage[];
  summary?: AISummary | null;
  lastReflectedMessageId?: string;
  lastReflectedAt?: number;
  createdAt: number;
  updatedAt: number;
  wordCount: number;
}

export type UserRole = 'user' | 'moderator' | 'admin' | 'super_admin';

export interface AppUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  role?: UserRole;
  isAnonymous?: boolean;
  lastLoginAt?: number;
  createdAt?: number;
}

export interface RoleCapability {
  name: string;
  description: string;
  minRole: UserRole;
  category: 'core' | 'moderation' | 'admin' | 'security';
}

export interface SecurityAuditLog {
  id: string;
  timestamp: number;
  actorId: string;
  actorName: string;
  actorRole: UserRole;
  action: string;
  targetId?: string;
  targetType?: string;
  severity: 'INFO' | 'WARN' | 'CRITICAL';
  details: string;
  ipAddress?: string;
}

export interface AdminSecurityDirective {
  id: string;
  title: string;
  category: 'RBAC' | 'PROMPT_INJECTION' | 'AUDIT_LOGGING' | 'LEAST_PRIVILEGE' | 'ELEVATED_OPS';
  rule: string;
  directiveGuideline: string;
  owaspMapping: string;
  enforcementMode: 'STRICT_BLOCK' | 'AUDIT_FLAG' | 'MANDATORY_REVIEW';
}

export interface SecurityCheckResult {
  passed: boolean;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  violations: string[];
  recommendations: string[];
  aiAnalysis: string;
  checkedAt: number;
  modelUsed?: string;
}

export interface ThreatZoneCountermeasure {
  zone: string;
  threat: string;
  mitigation: string;
  owaspRef: string;
  status: 'Implemented' | 'Enforced';
}
