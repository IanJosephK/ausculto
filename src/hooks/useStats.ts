import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useStore } from '../store/useStore';
import { useAuth } from './useAuth';
import { todayKey } from '../lib/format';

export interface ReadingStats {
  booksCompleted: number;
  totalListenSeconds: number;
  /** Consecutive days (ending today or yesterday) with any listening */
  streakDays: number;
}

/**
 * Personal reading stats. Local daily activity is always counted; when signed
 * in, cloud activity from other devices is merged in (max per day, since local
 * listening is also mirrored to the cloud).
 */
export function useStats(): ReadingStats {
  const { user } = useAuth();
  const localActivity = useStore((s) => s.activity);
  const completed = useStore((s) => s.completed);
  const [cloudActivity, setCloudActivity] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!user || !supabase) {
      setCloudActivity({});
      return;
    }
    let cancelled = false;
    void supabase
      .from('reading_activity')
      .select('date, duration_seconds')
      .eq('user_id', user.id)
      .then(({ data }) => {
        if (cancelled || !data) return;
        const byDay: Record<string, number> = {};
        for (const row of data as { date: string; duration_seconds: number }[]) {
          byDay[row.date] = (byDay[row.date] ?? 0) + row.duration_seconds;
        }
        setCloudActivity(byDay);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  return useMemo(() => {
    const days = new Set([...Object.keys(localActivity), ...Object.keys(cloudActivity)]);
    let total = 0;
    for (const day of days) {
      total += Math.max(localActivity[day] ?? 0, cloudActivity[day] ?? 0);
    }

    // Streak: walk backwards from today; a missing today doesn't break the
    // streak until the day is over.
    let streak = 0;
    const cursor = new Date();
    if (!days.has(todayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
    while (days.has(todayKey(cursor))) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }

    return { booksCompleted: completed.length, totalListenSeconds: total, streakDays: streak };
  }, [localActivity, cloudActivity, completed]);
}
