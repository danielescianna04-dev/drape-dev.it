import { useState, useEffect, useCallback } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, type User } from 'firebase/auth';
import { auth } from '../lib/firebase';

const ADMIN_EMAILS = ['leonrivas27@gmail.com'];
const TOKEN_REFRESH_INTERVAL = 50 * 60 * 1000; // 50 minuti

interface AuthHook {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signOut: () => void;
  error: string | null;
}

export function useAuth(): AuthHook {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkAdmin = useCallback((u: User | null): boolean => {
    if (!u?.email) return false;
    return ADMIN_EMAILS.includes(u.email);
  }, []);

  const isAdmin = checkAdmin(user);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const interval = setInterval(async () => {
      try {
        await user.getIdToken(true);
      } catch (err) {
        console.error('[auth] Token refresh failed:', err);
      }
    }, TOKEN_REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [user]);

  const handleSignInWithEmail = useCallback(async (email: string, password: string) => {
    setError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      const code = err?.code || '';
      if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
        setError('Email o password non validi');
      } else if (code === 'auth/too-many-requests') {
        setError('Troppi tentativi. Riprova più tardi.');
      } else {
        setError('Errore di accesso');
      }
      console.error('[auth] Email sign-in failed:', err);
    }
  }, []);

  const handleSignOut = useCallback(() => {
    auth.signOut().catch(err => {
      console.error('[auth] Sign-out failed:', err);
    });
  }, []);

  return { user, loading, isAdmin, signInWithEmail: handleSignInWithEmail, signOut: handleSignOut, error };
}
