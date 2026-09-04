import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut as fbSignOut, 
  onAuthStateChanged as fbOnAuthStateChanged,
  signInAnonymously,
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
    
    // Check if user has role in firestore
    let role: UserRole = 'user';
    if (db) {
      try {
        const uDoc = await getDoc(doc(db, 'users', u.uid));
        if (uDoc.exists() && uDoc.data().role) {
          role = uDoc.data().role;
        }
      } catch (err) {
        console.warn('Could not read user role from firestore:', err);
      }
    }

    const appUser: AppUser = {
      uid: u.uid,
      email: u.email,
      displayName: u.displayName || 'Reflective User',
      photoURL: u.photoURL,
      role,
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
  if (auth && isFirebaseConfigured) {
    try {
      const result = await signInAnonymously(auth);
      return {
        uid: result.user.uid,
        email: null,
        displayName: customName || 'Anonymous Journaler',
        photoURL: `https://api.dicebear.com/7.x/bottts/svg?seed=${result.user.uid}`,
        role: requestedRole,
        isAnonymous: true,
      };
    } catch (e) {
      console.warn('Anonymous sign-in on Firebase failed, using local demo user', e);
    }
  }

  const roleSeed = requestedRole === 'super_admin' ? 'admin_aoi' : requestedRole === 'admin' ? 'admin' : requestedRole === 'moderator' ? 'moderator' : 'journaler';
  const demoUser: AppUser = {
    uid: 'user_' + (customName ? customName.toLowerCase().replace(/\s+/g, '_') : 'guest_' + Math.random().toString(36).substring(2, 7)),
    email: customName ? `${customName.toLowerCase().replace(/\s+/g, '.')}@workspace.local` : `${requestedRole}@geminireflect.local`,
    displayName: customName || (requestedRole === 'super_admin' ? 'Super Admin Evaluator' : requestedRole === 'admin' ? 'Admin Evaluator' : requestedRole === 'moderator' ? 'Safety Moderator' : 'Mindful Journaler'),
    photoURL: `https://api.dicebear.com/7.x/bottts/svg?seed=${roleSeed}`,
    role: requestedRole,
    isAnonymous: true,
    createdAt: Date.now(),
    lastLoginAt: Date.now(),
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
    await fbSignOut(auth);
  }
  localStorage.removeItem(LOCAL_USER_KEY);
  window.dispatchEvent(new Event('auth_state_changed'));
}

export function subscribeToAuth(callback: (user: AppUser | null) => void): () => void {
  if (auth && isFirebaseConfigured) {
    return fbOnAuthStateChanged(auth, async (fbUser: FirebaseUser | null) => {
      if (fbUser) {
        let role: UserRole = 'user';
        if (db) {
          try {
            const uDoc = await getDoc(doc(db, 'users', fbUser.uid));
            if (uDoc.exists() && uDoc.data().role) {
              role = uDoc.data().role;
            }
          } catch (err) {
            console.warn('Could not read user role from firestore:', err);
          }
        }
        callback({
          uid: fbUser.uid,
          email: fbUser.email,
          displayName: fbUser.displayName || 'Reflective User',
          photoURL: fbUser.photoURL,
          role,
          isAnonymous: fbUser.isAnonymous,
        });
      } else {
        const local = localStorage.getItem(LOCAL_USER_KEY);
        if (local) {
          try {
            callback(JSON.parse(local));
          } catch {
            callback(null);
          }
        } else {
          callback(null);
        }
      }
    });
  }

  const handler = () => {
    const local = localStorage.getItem(LOCAL_USER_KEY);
    if (local) {
      try {
        callback(JSON.parse(local));
      } catch {
        callback(null);
      }
    } else {
      callback(null);
    }
  };

  handler();
  window.addEventListener('auth_state_changed', handler);
  return () => {
    window.removeEventListener('auth_state_changed', handler);
  };
}

export { collection, doc, setDoc, getDoc, getDocs, deleteDoc, query, orderBy, onSnapshot };
