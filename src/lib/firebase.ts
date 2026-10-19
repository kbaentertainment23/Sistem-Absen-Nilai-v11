import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  User, 
  signInAnonymously 
} from 'firebase/auth';
import { 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager,
  getFirestore 
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const firestoreDbId = (firebaseConfig as any).firestoreDatabaseId;

let db: any;
try {
  const settings = {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    }),
    experimentalAutoDetectLongPolling: true
  };
  db = firestoreDbId 
    ? initializeFirestore(app, settings, firestoreDbId)
    : initializeFirestore(app, settings);
} catch (e) {
  console.warn('Firestore persistent cache initialization fallback:', e);
  try {
    const fallbackSettings = { experimentalAutoDetectLongPolling: true };
    db = firestoreDbId 
      ? initializeFirestore(app, fallbackSettings, firestoreDbId)
      : initializeFirestore(app, fallbackSettings);
  } catch {
    db = firestoreDbId ? getFirestore(app, firestoreDbId) : getFirestore(app);
  }
}

const provider = new GoogleAuthProvider();

export { app, auth, db, provider };

export const initAuth = (
  onAuthSuccess?: (user: User) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (onAuthSuccess) onAuthSuccess(user);
    } else {
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{ user: User } | null> => {
  try {
    const result = await signInWithPopup(auth, provider);
    return { user: result.user };
  } catch (error: any) {
    console.error('Sign in error:', error);
    // If popup blocked or network fails in iframe preview, fallback to anonymous sign in
    if (
      error?.code === 'auth/popup-blocked' ||
      error?.code === 'auth/popup-closed-by-user' ||
      error?.code === 'auth/network-request-failed'
    ) {
      return await anonymousSignIn();
    }
    throw error;
  }
};

export const anonymousSignIn = async (): Promise<{ user: User | null }> => {
  try {
    const anonResult = await signInAnonymously(auth);
    return { user: anonResult.user };
  } catch (error: any) {
    // If anonymous sign-in is disabled in Firebase Console, fallback smoothly to local session user
    const fallbackUser: any = auth.currentUser || {
      uid: 'guest_teacher_user',
      isAnonymous: true,
      displayName: 'Guru',
    };
    return { user: fallbackUser };
  }
};

export const logout = async () => {
  await auth.signOut();
};
