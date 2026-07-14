import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

/**
 * "X people reading" counts — distinct sharers with activity in the last 7
 * days, via the reader_counts() RPC (aggregates only, no user data exposed).
 * Signed-in users also get live updates through a Realtime subscription.
 */
export function useReaderCounts(): Record<string, number> {
  const { user } = useAuth();
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!supabase) return;
    let cancelled = false;
    let throttle: ReturnType<typeof setTimeout> | undefined;

    const fetchCounts = async () => {
      const { data, error } = await supabase!.rpc('reader_counts');
      if (cancelled || error || !data) return;
      const next: Record<string, number> = {};
      for (const row of data as { book_slug: string; readers: number }[]) {
        next[row.book_slug] = Number(row.readers);
      }
      setCounts(next);
    };

    void fetchCounts();

    // Live-ish updates for signed-in users; RLS limits the subscription to
    // shared activity rows, and we only use it as a refetch signal.
    const channel = user
      ? supabase
          .channel('reading-activity-counts')
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'reading_activity' },
            () => {
              clearTimeout(throttle);
              throttle = setTimeout(() => void fetchCounts(), 10_000);
            },
          )
          .subscribe()
      : null;

    return () => {
      cancelled = true;
      clearTimeout(throttle);
      if (channel) void supabase?.removeChannel(channel);
    };
  }, [user]);

  return counts;
}
