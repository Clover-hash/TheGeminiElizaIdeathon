import { 
  db, 
  auth,
  collection, 
  doc, 
  setDoc, 
  getDoc,
  getDocs, 
  deleteDoc, 
  query, 
  orderBy, 
  onSnapshot,
  handleFirestoreError,
  OperationType
} from '../lib/firebase';
import { sanitizePayload } from '../lib/sanitizer';
import { JournalEntry, ChatMessage, AISummary, AppUser, UserRole, SecurityAuditLog } from '../types';
import { ROLE_HIERARCHY } from '../data/adminDirectives';

const LOCAL_JOURNAL_STORAGE_PREFIX = 'gemini_reflect_entries_';
const LOCAL_USERS_KEY = 'gemini_reflect_users_directory';
const LOCAL_AUDIT_LOGS_KEY = 'gemini_reflect_audit_logs';

function getLocalUserKey(userId: string) {
  return `${LOCAL_JOURNAL_STORAGE_PREFIX}${userId}`;
}

export function getLocalUserEntries(userId: string): JournalEntry[] {
  try {
    const raw = localStorage.getItem(getLocalUserKey(userId));
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading local entries:', err);
    return [];
  }
}

export function saveLocalUserEntries(userId: string, entries: JournalEntry[]): void {
  try {
    localStorage.setItem(getLocalUserKey(userId), JSON.stringify(entries));
    window.dispatchEvent(new CustomEvent('local_entries_updated', { detail: { userId } }));
  } catch (err) {
    console.error('Error saving local entries:', err);
  }
}

// Initial sample users for local/sandbox evaluation
const INITIAL_DEMO_USERS: AppUser[] = [
  {
    uid: 'user_admin_01',
    email: 'admin@workspace.local',
    displayName: 'Mei System Admin',
    photoURL: 'https://api.dicebear.com/7.x/bottts/svg?seed=admin_mei',
    role: 'super_admin',
    createdAt: Date.now() - 86400000 * 30,
    lastLoginAt: Date.now(),
  },
  {
    uid: 'user_mod_01',
    email: 'moderator@workspace.local',
    displayName: 'Safety Moderator',
    photoURL: 'https://api.dicebear.com/7.x/bottts/svg?seed=mod_safety',
    role: 'moderator',
    createdAt: Date.now() - 86400000 * 14,
    lastLoginAt: Date.now() - 3600000 * 2,
  },
  {
    uid: 'user_regular_01',
    email: 'journaler@workspace.local',
    displayName: 'Mindful Journaler',
    photoURL: 'https://api.dicebear.com/7.x/bottts/svg?seed=journaler',
    role: 'user',
    createdAt: Date.now() - 86400000 * 7,
    lastLoginAt: Date.now() - 3600000 * 5,
  }
];

const INITIAL_AUDIT_LOGS: SecurityAuditLog[] = [
  {
    id: 'audit_init_01',
    timestamp: Date.now() - 3600000 * 24,
    actorId: 'system_root',
    actorName: 'Security Engine',
    actorRole: 'super_admin',
    action: 'SYSTEM_BOOTSTRAP',
    severity: 'INFO',
    details: 'Firestore owner-isolated security rules loaded with RBAC enforcement policies.',
  },
  {
    id: 'audit_init_02',
    timestamp: Date.now() - 3600000 * 12,
    actorId: 'user_admin_01',
    actorName: 'Mei System Admin',
    actorRole: 'super_admin',
    action: 'POLICY_ENFORCE',
    targetType: 'DIRECTIVE',
    targetId: 'DIR-RBAC-01',
    severity: 'INFO',
    details: 'Verified server-authoritative role verification across all API route handlers.',
  }
];

export function getLocalUsers(): AppUser[] {
  try {
    const raw = localStorage.getItem(LOCAL_USERS_KEY);
    if (!raw) {
      localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(INITIAL_DEMO_USERS));
      return INITIAL_DEMO_USERS;
    }
    return JSON.parse(raw);
  } catch (err) {
    return INITIAL_DEMO_USERS;
  }
}

export function saveLocalUsers(users: AppUser[]): void {
  try {
    localStorage.setItem(LOCAL_USERS_KEY, JSON.stringify(users));
    window.dispatchEvent(new Event('users_directory_updated'));
  } catch (err) {
    console.error('Error saving users directory:', err);
  }
}

export function getLocalAuditLogs(): SecurityAuditLog[] {
  try {
    const raw = localStorage.getItem(LOCAL_AUDIT_LOGS_KEY);
    if (!raw) {
      localStorage.setItem(LOCAL_AUDIT_LOGS_KEY, JSON.stringify(INITIAL_AUDIT_LOGS));
      return INITIAL_AUDIT_LOGS;
    }
    return JSON.parse(raw);
  } catch (err) {
    return INITIAL_AUDIT_LOGS;
  }
}

export function saveLocalAuditLogs(logs: SecurityAuditLog[]): void {
  try {
    localStorage.setItem(LOCAL_AUDIT_LOGS_KEY, JSON.stringify(logs));
    window.dispatchEvent(new Event('audit_logs_updated'));
  } catch (err) {
    console.error('Error saving audit logs:', err);
  }
}

/**
 * Ensures user profile document in Firestore exists with a valid role.
 * Automatically persists new user accounts to Cloud Firestore and updates login timestamps.
 */
export async function syncUserProfile(user: AppUser): Promise<AppUser> {
  if (!user || !user.uid) return user;

  const isSuperAdminEmail = user.email === 'hokiantoh@gmail.com';
  let currentRole: UserRole = isSuperAdminEmail ? 'super_admin' : (user.role || 'user');
  let userCreatedAt = user.createdAt || Date.now();
  let preferredCompanion = user.preferredCompanion;
  let reflectionIntention = user.reflectionIntention;
  let reflectionFrequency = user.reflectionFrequency;

  const isFirebaseAuthUser = Boolean(db && auth?.currentUser && auth.currentUser.uid === user.uid);

  if (isFirebaseAuthUser && db) {
    try {
      const userRef = doc(db, 'users', user.uid);
      const snapshot = await getDoc(userRef);
      if (snapshot.exists()) {
        const data = snapshot.data();
        currentRole = isSuperAdminEmail ? 'super_admin' : (data.role || currentRole);
        userCreatedAt = data.createdAt || userCreatedAt;
        preferredCompanion = data.preferredCompanion || preferredCompanion;
        reflectionIntention = data.reflectionIntention || reflectionIntention;
        reflectionFrequency = data.reflectionFrequency || reflectionFrequency;

        // Refresh login timestamp and sync latest profile details safely with undefined stripping
        await setDoc(userRef, sanitizePayload({
          email: user.email,
          displayName: user.displayName || 'Reflective User',
          photoURL: user.photoURL,
          isAnonymous: user.isAnonymous ?? false,
          lastLoginAt: Date.now(),
          updatedAt: Date.now(),
        }), { merge: true });
      } else {
        // First-time new user registration in Cloud Firestore!
        const newAccountPayload = sanitizePayload({
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || 'Reflective User',
          photoURL: user.photoURL,
          role: currentRole,
          isAnonymous: user.isAnonymous ?? false,
          preferredCompanion: preferredCompanion || 'deredere',
          reflectionIntention: reflectionIntention || 'Cultivate mindful awareness and emotional clarity.',
          reflectionFrequency: reflectionFrequency || 'daily',
          createdAt: userCreatedAt,
          lastLoginAt: Date.now(),
          updatedAt: Date.now(),
        });
        await setDoc(userRef, newAccountPayload);

        // Record account creation in Security Audit Trail
        await recordSecurityAuditLog({
          actorId: user.uid,
          actorName: user.displayName || 'New User',
          actorRole: currentRole,
          action: 'USER_ACCOUNT_CREATED',
          targetId: user.uid,
          targetType: 'USER_ACCOUNT',
          severity: 'INFO',
          details: `New account registered and stored in Cloud Firestore with role '${currentRole}'.`,
        });
      }
    } catch (err) {
      console.warn('Firestore user profile sync fallback to local:', err);
    }
  }

  // Update local directory
  const users = getLocalUsers();
  const existingIdx = users.findIndex(u => u.uid === user.uid);
  const updatedUser: AppUser = {
    ...user,
    role: currentRole,
    createdAt: userCreatedAt,
    lastLoginAt: Date.now(),
    preferredCompanion,
    reflectionIntention,
    reflectionFrequency,
  };

  if (existingIdx >= 0) {
    users[existingIdx] = { ...users[existingIdx], ...updatedUser };
  } else {
    users.unshift(updatedUser);
  }
  saveLocalUsers(users);

  return updatedUser;
}

/**
 * Updates a user's profile and preferences in Cloud Firestore.
 */
export async function updateUserProfile(
  userId: string,
  updates: Partial<Pick<AppUser, 'displayName' | 'photoURL' | 'preferredCompanion' | 'reflectionIntention' | 'reflectionFrequency'>>
): Promise<AppUser> {
  const isFirebaseAuthUser = Boolean(db && auth?.currentUser && auth.currentUser.uid === userId);

  if (isFirebaseAuthUser && db) {
    try {
      const userRef = doc(db, 'users', userId);
      const payload = sanitizePayload({
        ...updates,
        updatedAt: Date.now(),
      });
      await setDoc(userRef, payload, { merge: true });
    } catch (err) {
      console.error('Failed to update user profile in Firestore:', err);
      throw err;
    }
  }

  const users = getLocalUsers();
  const idx = users.findIndex(u => u.uid === userId);
  let updated: AppUser;
  if (idx >= 0) {
    updated = { ...users[idx], ...updates, updatedAt: Date.now() };
    users[idx] = updated;
  } else {
    updated = { 
      uid: userId, 
      email: null, 
      displayName: updates.displayName || null, 
      photoURL: updates.photoURL || null, 
      ...updates, 
      updatedAt: Date.now() 
    };
    users.unshift(updated);
  }
  saveLocalUsers(users);

  // Sync active local user if matching
  try {
    const activeLocalRaw = localStorage.getItem('gemini_reflect_auth_user');
    if (activeLocalRaw) {
      const activeLocal = JSON.parse(activeLocalRaw) as AppUser;
      if (activeLocal.uid === userId) {
        const merged = { ...activeLocal, ...updates, updatedAt: Date.now() };
        localStorage.setItem('gemini_reflect_auth_user', JSON.stringify(merged));
        window.dispatchEvent(new Event('auth_state_changed'));
      }
    }
  } catch (syncErr) {
    console.warn('Local session sync note:', syncErr);
  }

  return updated;
}

/**
 * Fetches all registered users from Cloud Firestore if the current user has administrative permissions.
 */
export async function fetchRegisteredUsers(): Promise<{ users: AppUser[]; fromFirestore: boolean }> {
  const isFirebaseAuthUser = Boolean(db && auth?.currentUser);

  if (isFirebaseAuthUser && db) {
    try {
      const usersCol = collection(db, 'users');
      const snapshot = await getDocs(usersCol);
      if (!snapshot.empty) {
        const firestoreUsers: AppUser[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          firestoreUsers.push({
            uid: docSnap.id,
            email: data.email || null,
            displayName: data.displayName || 'Reflective User',
            photoURL: data.photoURL || null,
            role: data.role || 'user',
            isAnonymous: Boolean(data.isAnonymous),
            createdAt: data.createdAt || 0,
            lastLoginAt: data.lastLoginAt || 0,
            preferredCompanion: data.preferredCompanion,
            reflectionIntention: data.reflectionIntention,
            reflectionFrequency: data.reflectionFrequency,
          });
        });

        // Merge with local directory so demo accounts remain available for evaluation
        const local = getLocalUsers();
        const mergedMap = new Map<string, AppUser>();
        firestoreUsers.forEach(u => mergedMap.set(u.uid, u));
        local.forEach(u => {
          if (!mergedMap.has(u.uid)) {
            mergedMap.set(u.uid, u);
          }
        });

        const mergedList = Array.from(mergedMap.values());
        saveLocalUsers(mergedList);
        return { users: mergedList, fromFirestore: true };
      }
    } catch (err) {
      console.warn('Could not query users collection from Firestore (falling back to local cache):', err);
    }
  }

  return { users: getLocalUsers(), fromFirestore: false };
}

/**
 * Updates a user's RBAC role with strict permission checking and audit log emission.
 */
export async function updateUserRole(
  actor: AppUser,
  targetUserId: string,
  newRole: UserRole
): Promise<{ success: boolean; message: string }> {
  const actorLevel = ROLE_HIERARCHY[actor.role || 'user'] || 1;
  const targetNewLevel = ROLE_HIERARCHY[newRole] || 1;

  // Security Check 1: Actor must be admin or super_admin
  if (actorLevel < ROLE_HIERARCHY.admin) {
    await recordSecurityAuditLog({
      actorId: actor.uid,
      actorName: actor.displayName || 'Unknown',
      actorRole: actor.role || 'user',
      action: 'UNAUTHORIZED_ROLE_CHANGE_ATTEMPT',
      targetId: targetUserId,
      targetType: 'USER_ROLE',
      severity: 'CRITICAL',
      details: `User attempted to set role to '${newRole}' without admin privilege.`,
    });
    throw new Error('Access Denied: You do not have elevated administrative permissions to assign roles.');
  }

  // Security Check 2: Cannot elevate to a level higher than actor's own level (unless super_admin)
  if (targetNewLevel > actorLevel) {
    throw new Error(`Access Denied: You cannot assign a role higher than your own tier (${actor.role}).`);
  }

  // Security Check 3: Super Admin promotion requires Super Admin actor
  if (newRole === 'super_admin' && actor.role !== 'super_admin') {
    throw new Error('Access Denied: Only a Super Admin can promote accounts to Super Admin.');
  }

  if (db) {
    try {
      const targetUserRef = doc(db, 'users', targetUserId);
      await setDoc(targetUserRef, sanitizePayload({ role: newRole, updatedAt: Date.now() }), { merge: true });
    } catch (err) {
      console.warn('Firestore role update fallback to local store:', err);
    }
  }

  const users = getLocalUsers();
  const targetUser = users.find(u => u.uid === targetUserId);
  const oldRole = targetUser?.role || 'user';

  const updatedUsers = users.map(u => u.uid === targetUserId ? { ...u, role: newRole } : u);
  saveLocalUsers(updatedUsers);

  // Record Audit Trail
  await recordSecurityAuditLog({
    actorId: actor.uid,
    actorName: actor.displayName || 'Admin',
    actorRole: actor.role || 'admin',
    action: 'USER_ROLE_UPDATED',
    targetId: targetUserId,
    targetType: 'USER_ROLE',
    severity: newRole === 'admin' || newRole === 'super_admin' ? 'WARN' : 'INFO',
    details: `Role for ${targetUser?.displayName || targetUserId} changed from '${oldRole}' to '${newRole}'.`,
  });

  return { success: true, message: `Role updated to ${newRole}` };
}

/**
 * Emits an immutable security audit log.
 */
export async function recordSecurityAuditLog(
  logData: Omit<SecurityAuditLog, 'id' | 'timestamp'>
): Promise<void> {
  const newLog: SecurityAuditLog = {
    ...logData,
    id: 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
    timestamp: Date.now(),
  };

  if (db) {
    try {
      const logsCollection = collection(db, 'system_audit_logs');
      const docRef = doc(logsCollection, newLog.id);
      await setDoc(docRef, sanitizePayload(newLog));
    } catch (err) {
      console.warn('Firestore audit log write fallback:', err);
    }
  }

  const logs = getLocalAuditLogs();
  logs.unshift(newLog);
  // Cap at 100 entries for local preview
  if (logs.length > 100) logs.pop();
  saveLocalAuditLogs(logs);
}

/**
 * Saves or updates a journal interaction document in Firestore under `users/{userId}/interactions/{entryId}`.
 * Strictly strips undefined fields to guarantee zero-crash database transactions.
 * Synchronously writes to isolated local cache first so UI components and companion switching
 * never experience dropped state or lag.
 */
export async function saveJournalEntry(userId: string, entry: JournalEntry): Promise<void> {
  if (!userId) throw new Error('User ID is required to save journal entry');

  const cleanEntry = sanitizePayload({
    ...entry,
    userId,
    updatedAt: Date.now(),
  });

  // 1. ALWAYS write to local storage cache synchronously and emit event
  const existing = getLocalUserEntries(userId);
  const index = existing.findIndex((e) => e.id === entry.id);
  if (index >= 0) {
    existing[index] = cleanEntry;
  } else {
    existing.unshift(cleanEntry);
  }
  saveLocalUserEntries(userId, existing);

  // 2. Persist to Cloud Firestore if user is authenticated with Firebase
  const isFirebaseAuthUser = Boolean(db && auth?.currentUser && auth.currentUser.uid === userId);

  if (isFirebaseAuthUser && db) {
    const pathForWrite = `users/${userId}/interactions/${entry.id}`;
    try {
      const userInteractionsRef = collection(db, 'users', userId, 'interactions');
      const docRef = doc(userInteractionsRef, entry.id);
      await setDoc(docRef, cleanEntry, { merge: true });
    } catch (err) {
      console.warn('Firestore write note, isolated local cache remains fully preserved:', err);
      if (err instanceof Error && err.message.toLowerCase().includes('permission')) {
        handleFirestoreError(err, OperationType.WRITE, pathForWrite);
      }
    }
  }
}

/**
 * Deletes a journal interaction document strictly from `users/{userId}/interactions/{entryId}`.
 */
export async function deleteJournalEntry(userId: string, entryId: string): Promise<void> {
  if (!userId || !entryId) throw new Error('User ID and Entry ID required');

  // Remove from local cache synchronously
  const existing = getLocalUserEntries(userId);
  const filtered = existing.filter((e) => e.id !== entryId);
  saveLocalUserEntries(userId, filtered);

  const isFirebaseAuthUser = Boolean(db && auth?.currentUser && auth.currentUser.uid === userId);

  if (isFirebaseAuthUser && db) {
    const pathForDelete = `users/${userId}/interactions/${entryId}`;
    try {
      const docRef = doc(db, 'users', userId, 'interactions', entryId);
      await deleteDoc(docRef);
    } catch (err) {
      console.warn('Firestore delete failed, removed from local cache:', err);
      if (err instanceof Error && err.message.toLowerCase().includes('permission')) {
        handleFirestoreError(err, OperationType.DELETE, pathForDelete);
      }
    }
  }
}

/**
 * Subscribes to real-time updates for a user's isolated interactions collection.
 * Instantly supplies cached entries and synchronizes bidirectional changes seamlessly.
 */
export function subscribeToUserEntries(
  userId: string,
  onUpdate: (entries: JournalEntry[]) => void,
  onError?: (error: Error) => void
): () => void {
  if (!userId) {
    onUpdate([]);
    return () => {};
  }

  // 1. Immediately emit current entries from local cache to prevent UI flash or empty state
  const initialLocal = getLocalUserEntries(userId);
  if (initialLocal.length > 0) {
    onUpdate(initialLocal);
  }

  const isFirebaseAuthUser = Boolean(db && auth?.currentUser && auth.currentUser.uid === userId);
  let unsubscribeFirestore = () => {};

  if (isFirebaseAuthUser && db) {
    const pathForQuery = `users/${userId}/interactions`;
    try {
      const interactionsRef = collection(db, 'users', userId, 'interactions');
      const q = query(interactionsRef, orderBy('createdAt', 'desc'));

      unsubscribeFirestore = onSnapshot(
        q,
        (snapshot) => {
          const docs = snapshot.docs.map((docSnap) => {
            const data = docSnap.data();
            return {
              id: docSnap.id,
              userId: data.userId || userId,
              characterId: data.characterId || 'deredere',
              characterName: data.characterName || 'Mei',
              title: data.title || 'Untitled Reflection',
              content: data.content || '',
              mood: data.mood || 'reflective',
              tags: Array.isArray(data.tags) ? data.tags : [],
              messages: Array.isArray(data.messages) ? data.messages : [],
              summary: data.summary || null,
              lastReflectedMessageId: data.lastReflectedMessageId,
              lastReflectedAt: data.lastReflectedAt,
              createdAt: data.createdAt || Date.now(),
              updatedAt: data.updatedAt || Date.now(),
              wordCount: typeof data.wordCount === 'number' ? data.wordCount : 0,
            } as JournalEntry;
          });

          // Merge Firestore documents with local entries to ensure zero lost data
          const currentLocal = getLocalUserEntries(userId);
          const map = new Map<string, JournalEntry>();
          currentLocal.forEach((e) => map.set(e.id, e));
          docs.forEach((doc) => {
            const local = map.get(doc.id);
            if (!local || (doc.updatedAt || 0) >= (local.updatedAt || 0)) {
              map.set(doc.id, doc);
            }
          });

          const merged = Array.from(map.values()).sort(
            (a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0)
          );
          saveLocalUserEntries(userId, merged);
          onUpdate(merged);
        },
        (error) => {
          console.warn('Firestore real-time subscription error, keeping local cache:', error);
          if (onError) onError(error);
          onUpdate(getLocalUserEntries(userId));
          if (error && error.message.toLowerCase().includes('permission')) {
            handleFirestoreError(error, OperationType.LIST, pathForQuery);
          }
        }
      );
    } catch (err) {
      console.warn('Error setting up Firestore listener, keeping local store:', err);
      if (err instanceof Error && err.message.toLowerCase().includes('permission')) {
        handleFirestoreError(err, OperationType.LIST, pathForQuery);
      }
    }
  }

  const syncLocal = () => {
    onUpdate(getLocalUserEntries(userId));
  };

  const eventListener = (e: Event) => {
    const custom = e as CustomEvent<{ userId: string }>;
    if (!custom.detail || custom.detail.userId === userId) {
      syncLocal();
    }
  };

  window.addEventListener('local_entries_updated', eventListener);

  return () => {
    unsubscribeFirestore();
    window.removeEventListener('local_entries_updated', eventListener);
  };
}

/**
 * Subscribes to real-time audit logs for the Admin Dashboard.
 */
export function subscribeToAuditLogs(onUpdate: (logs: SecurityAuditLog[]) => void): () => void {
  const isFirebaseAuthUser = Boolean(db && auth?.currentUser);

  if (isFirebaseAuthUser && db) {
    try {
      const logsRef = collection(db, 'system_audit_logs');
      const q = query(logsRef, orderBy('timestamp', 'desc'));

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const docs = snapshot.docs.map((d) => d.data() as SecurityAuditLog);
          onUpdate(docs);
        },
        () => {
          onUpdate(getLocalAuditLogs());
        }
      );
      return unsubscribe;
    } catch (err) {
      console.warn('Firestore audit logs listener error:', err);
    }
  }

  const sync = () => onUpdate(getLocalAuditLogs());
  sync();
  window.addEventListener('audit_logs_updated', sync);
  return () => window.removeEventListener('audit_logs_updated', sync);
}

