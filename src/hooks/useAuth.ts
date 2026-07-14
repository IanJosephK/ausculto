import { create } from 'zustand';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { syncOnLogin } from '../lib/sync';

interface AuthState {
  user: User | null;
  /** true until the initial getSession() resolves */
  loading: boolean;
}

const useAuthStore = create<AuthState>(() => ({
  user: null,
  loading: supabase !== null,
}));

// Module-level init: one subscription for the whole app.
if (supabase) {
  supabase.auth.getSession().then(({ data }) => {
    useAuthStore.setState({ user: data.session?.user ?? null, loading: false });
  });
  let lastUserId: string | null = null;
  supabase.auth.onAuthStateChange((_event, session) => {
    const user = session?.user ?? null;
    useAuthStore.setState({ user, loading: false });
    if (user && user.id !== lastUserId) {
      lastUserId = user.id;
      void ensureProfile(user);
      void syncOnLogin(user);
    }
    if (!user) lastUserId = null;
  });
}

async function ensureProfile(user: User) {
  if (!supabase) return;
  const displayName =
    (user.user_metadata.full_name as string | undefined) ?? user.email?.split('@')[0] ?? 'Reader';
  await supabase
    .from('profiles')
    .upsert({ id: user.id, display_name: displayName }, { onConflict: 'id', ignoreDuplicates: true });
}

export function useAuth() {
  const { user, loading } = useAuthStore();
  return {
    user,
    loading,
    signOut: async () => {
      await supabase?.auth.signOut();
    },
  };
}
