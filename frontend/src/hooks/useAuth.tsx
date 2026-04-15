'use client';
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { onAuthStateChanged, User, signInWithPopup, signOut as fbSignOut } from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';
import api from '../lib/api';

interface AuthCtx {
  user: User | null;
  dbUser: any | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({} as AuthCtx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [dbUser, setDbUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      setUser(fbUser);
      if (fbUser) {
        try {
          const token = await fbUser.getIdToken();
          const { data } = await api.post('/auth/sync-user', { id_token: token });
          setDbUser(data);
        } catch {
          setDbUser(null);
        }
      } else {
        setDbUser(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const signInWithGoogle = async () => {
    await signInWithPopup(auth, googleProvider);
  };

  const signOut = async () => {
    await fbSignOut(auth);
    setDbUser(null);
  };

  return <Ctx.Provider value={{ user, dbUser, loading, signInWithGoogle, signOut }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
