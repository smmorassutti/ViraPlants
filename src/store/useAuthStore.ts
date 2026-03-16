import {create} from 'zustand';
import type {Session, User} from '@supabase/supabase-js';

type AuthState = {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
};

type AuthActions = {
  setSession: (session: Session | null) => void;
  setLoading: (loading: boolean) => void;
};

type AuthStore = AuthState & AuthActions;

export const useAuthStore = create<AuthStore>((set) => ({
  session: null,
  user: null,
  isLoading: true,
  isAuthenticated: false,

  setSession: (session) =>
    set({
      session,
      user: session?.user ?? null,
      isAuthenticated: !!session,
    }),

  setLoading: (isLoading) => set({isLoading}),
}));
