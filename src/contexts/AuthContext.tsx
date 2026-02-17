import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import {
  type User,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, isFirebaseConfigured } from '@/lib/firebase';

interface AuthContextType {
  user: User | null;
  username: string | null;
  loading: boolean;
  firebaseReady: boolean;
  signUp: (email: string, password: string, username?: string) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

function generateUsername(): string {
  return 'Scholar' + Math.floor(1000 + Math.random() * 9000);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // If Firebase isn't configured, skip auth entirely — let users through
    if (!isFirebaseConfigured || !auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser && db) {
        try {
          const profileDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (profileDoc.exists()) {
            setUsername(profileDoc.data().username || null);
          }
        } catch (err) {
          console.error('Failed to fetch user profile:', err);
        }
      } else {
        setUsername(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const signUp = async (email: string, password: string, desiredUsername?: string) => {
    if (!auth || !db) throw new Error('Firebase is not configured');
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const uname = desiredUsername?.trim() || generateUsername();
    await setDoc(doc(db, 'users', cred.user.uid), {
      email,
      username: uname,
      createdAt: serverTimestamp(),
    });
    setUsername(uname);
  };

  const signIn = async (email: string, password: string) => {
    if (!auth) throw new Error('Firebase is not configured');
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signOut = async () => {
    if (!auth) return;
    await firebaseSignOut(auth);
    setUser(null);
    setUsername(null);
  };

  return (
    <AuthContext.Provider value={{ user, username, loading, firebaseReady: isFirebaseConfigured, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
