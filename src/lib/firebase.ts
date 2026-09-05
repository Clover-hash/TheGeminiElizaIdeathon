import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut as fbSignOut, 
  onAuthStateChanged as fbOnAuthStateChanged,
  User as FirebaseUser,
  Auth
} from 'firebase/auth';
import { 
  getFirestore, 
  Firestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  deleteDoc, 
  query, 
  orderBy, 
  onSnapshot,
  getDocFromServer
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { AppUser, UserRole } from '../types';
import { sanitizePayload } from './sanitizer';

export const isFirebaseConfigured = Boolean(
  firebaseConfig && firebaseConfig.apiKey && firebaseConfig.projectId
);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid,
      email: auth?.currentUser?.email,
      emailVerified: auth?.currentUser?.emailVerified,
      isAnonymous: auth?.currentUser?.isAnonymous,
      tenantId: auth?.currentUser?.tenantId,
      providerInfo: auth?.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

let app: FirebaseApp;
if (getApps().length > 0) {
  app = getApp();
} else {
  app = initializeApp(firebaseConfig);
}

export const auth: Auth = getAuth(app);
export const db: Firestore = getFirestore(app, firebaseConfig.firestoreDatabaseId); /* CRITICAL: The app will break without this line */

// Validate Connection to Firestore on startup as mandated by Firebase Skill
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

// Fallback user storage for local preview / offline sandbox
const LOCAL_USER_KEY = 'gemini_reflect_auth_user';

export async function loginWithGoogle(): Promise<AppUser> {
  if (auth && isFirebaseConfigured) {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const result = await signInWithPopup(auth, provider);
    const u = result.user;
    
    // Check if user has role in firestore, or if owner email matches
    const isSuperAdminEmail = u.email === 'hokiantoh@gmail.com';
    let role: UserRole = isSuperAdminEmail ? 'super_admin' : 'user';
    let createdAt = Date.now();
    let preferredCompanion: any = undefined;
    let reflectionIntention: string | undefined = undefined;
    let reflectionFrequency: any = undefined;

    if (db) {
      try {
        const uRef = doc(db, 'users', u.uid);
        const uDoc = await getDoc(uRef);
        if (uDoc.exists()) {
          const data = uDoc.data();
          role = isSuperAdminEmail ? 'super_admin' : (data.role || role);
          createdAt = data.createdAt || createdAt;
          preferredCompanion = data.preferredCompanion;
          reflectionIntention = data.reflectionIntention;
          reflectionFrequency = data.reflectionFrequency;

          // Update active timestamp and sync latest profile attributes
          await setDoc(uRef, sanitizePayload({
            email: u.email,
            displayName: u.displayName || 'Reflective User',
            photoURL: u.photoURL,
            isAnonymous: false,
            lastLoginAt: Date.now(),
            updatedAt: Date.now(),
          }), { merge: true });
        } else {
          // Store new account document in Cloud Firestore!
          await setDoc(uRef, sanitizePayload({
            uid: u.uid,
            email: u.email,
            displayName: u.displayName || 'Reflective User',
            photoURL: u.photoURL,
            role,
            isAnonymous: false,
            createdAt: createdAt,
            lastLoginAt: Date.now(),
            updatedAt: Date.now(),
            preferredCompanion: 'deredere',
            reflectionIntention: 'Cultivate mindful awareness and emotional clarity.',
            reflectionFrequency: 'daily',
          }));
        }
      } catch (err) {
        console.warn('Could not sync user document in Firestore on Google sign-in:', err);
      }
    }

    const appUser: AppUser = {
      uid: u.uid,
      email: u.email,
      displayName: u.displayName || 'Reflective User',
      photoURL: u.photoURL,
      role,
      isAnonymous: false,
      createdAt,
      lastLoginAt: Date.now(),
      preferredCompanion,
      reflectionIntention,
      reflectionFrequency,
    };
    return appUser;
  }

  // Fallback demo authentication for instant interactive evaluation (standard user)
  const demoUser: AppUser = {
    uid: 'demo-user-journaler',
    email: 'journaler@workspace.local',
    displayName: 'Mindful Journaler',
    photoURL: `https://api.dicebear.com/7.x/bottts/svg?seed=journaler`,
    role: 'user',
    isAnonymous: false,
    createdAt: Date.now() - 86400000 * 30,
    lastLoginAt: Date.now(),
  };
  localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(demoUser));
  window.dispatchEvent(new Event('auth_state_changed'));
  return demoUser;
}

export async function loginDemoUser(customName?: string, requestedRole: UserRole = 'user'): Promise<AppUser> {
  const roleSeed = requestedRole === 'super_admin' ? 'admin_mei' : requestedRole === 'admin' ? 'admin' : requestedRole === 'moderator' ? 'moderator' : 'journaler';
  const sanitizedName = (customName || '').trim();
  const displayName = sanitizedName || (requestedRole === 'super_admin' ? 'Super Admin Evaluator' : requestedRole === 'admin' ? 'Admin Evaluator' : requestedRole === 'moderator' ? 'Safety Moderator' : 'Mindful Journaler');
  
  // Create consistent, sanitized UID for local persistence
  const cleanId = sanitizedName ? sanitizedName.toLowerCase().replace(/[^a-z0-9]/g, '_') : 'guest_' + Math.random().toString(36).substring(2, 8);
  const uid = `user_${cleanId}`;

  const demoUser: AppUser = {
    uid,
    email: sanitizedName ? `${sanitizedName.toLowerCase().replace(/[^a-z0-9]/g, '.')}@workspace.local` : `${requestedRole}@geminireflect.local`,
    displayName,
    photoURL: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(sanitizedName || roleSeed)}`,
    role: requestedRole,
    isAnonymous: true,
    createdAt: Date.now(),
    lastLoginAt: Date.now(),
    preferredCompanion: 'deredere',
    reflectionIntention: 'Cultivate mindful awareness and emotional clarity.',
    reflectionFrequency: 'daily',
  };

  localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(demoUser));
  window.dispatchEvent(new Event('auth_state_changed'));
  return demoUser;
}

export function switchActiveRole(newRole: UserRole): AppUser | null {
  const local = localStorage.getItem(LOCAL_USER_KEY);
  if (!local) return null;
  try {
    const user = JSON.parse(local) as AppUser;
    user.role = newRole;
    localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(user));
    window.dispatchEvent(new Event('auth_state_changed'));
    return user;
  } catch {
    return null;
  }
}

export async function logout(): Promise<void> {
  if (auth && isFirebaseConfigured) {
    try {
      await fbSignOut(auth);
    } catch (err) {
      console.warn('Firebase sign out note:', err);
    }
  }
  localStorage.removeItem(LOCAL_USER_KEY);
  window.dispatchEvent(new Event('auth_state_changed'));
}

export function subscribeToAuth(callback: (user: AppUser | null) => void): () => void {
  const getLocalUser = (): AppUser | null => {
    const local = localStorage.getItem(LOCAL_USER_KEY);
    if (!local) return null;
    try {
      return JSON.parse(local) as AppUser;
    } catch {
      return null;
    }
  };

  const notifyStateChange = () => {
    // If there is an active Firebase authenticated user, they take precedence
    if (auth?.currentUser) {
      return;
    }
    const localUser = getLocalUser();
    callback(localUser);
  };

  let unsubscribeFirebase = () => {};

  if (auth && isFirebaseConfigured) {
    unsubscribeFirebase = fbOnAuthStateChanged(auth, async (fbUser: FirebaseUser | null) => {
      if (fbUser) {
        const isSuperAdminEmail = fbUser.email === 'hokiantoh@gmail.com';
        let role: UserRole = isSuperAdminEmail ? 'super_admin' : 'user';
        let createdAt = Date.now();
        let preferredCompanion: any = undefined;
        let reflectionIntention: string | undefined = undefined;
        let reflectionFrequency: any = undefined;

        if (db) {
          try {
            const uRef = doc(db, 'users', fbUser.uid);
            const uDoc = await getDoc(uRef);
            if (uDoc.exists()) {
              const data = uDoc.data();
              role = isSuperAdminEmail ? 'super_admin' : (data.role || role);
              createdAt = data.createdAt || createdAt;
              preferredCompanion = data.preferredCompanion;
              reflectionIntention = data.reflectionIntention;
              reflectionFrequency = data.reflectionFrequency;
            } else {
              // Ensure doc exists in Firestore if missing
              await setDoc(uRef, sanitizePayload({
                uid: fbUser.uid,
                email: fbUser.email,
                displayName: fbUser.displayName || 'Reflective User',
                photoURL: fbUser.photoURL,
                role: role,
                isAnonymous: fbUser.isAnonymous,
                createdAt: createdAt,
                lastLoginAt: Date.now(),
                updatedAt: Date.now(),
                preferredCompanion: 'deredere',
                reflectionIntention: 'Cultivate mindful awareness and emotional clarity.',
                reflectionFrequency: 'daily',
              }));
            }
          } catch (err) {
            console.warn('Could not read or initialize user profile in firestore:', err);
          }
        }
        callback({
          uid: fbUser.uid,
          email: fbUser.email,
          displayName: fbUser.displayName || 'Reflective User',
          photoURL: fbUser.photoURL,
          role,
          isAnonymous: fbUser.isAnonymous,
          createdAt,
          lastLoginAt: Date.now(),
          preferredCompanion,
          reflectionIntention,
          reflectionFrequency,
        });
      } else {
        const localUser = getLocalUser();
        callback(localUser);
      }
    });
  } else {
    notifyStateChange();
  }

  // Always listen to local auth_state_changed events so non-Google/guest users immediately trigger UI updates
  window.addEventListener('auth_state_changed', notifyStateChange);

  return () => {
    unsubscribeFirebase();
    window.removeEventListener('auth_state_changed', notifyStateChange);
  };
}

export { collection, doc, setDoc, getDoc, getDocs, deleteDoc, query, orderBy, onSnapshot };
