import { useEffect, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useStats } from '../hooks/useStats';
import { useStore } from '../store/useStore';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { AuthModal } from '../components/AuthModal';
import { formatDuration } from '../lib/format';
import { MoonIcon, SunIcon } from '../components/icons';

export default function Profile() {
  const { user, loading, signOut } = useAuth();
  const stats = useStats();
  const theme = useStore((s) => s.theme);
  const setTheme = useStore((s) => s.setTheme);
  const [authOpen, setAuthOpen] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [shareActivity, setShareActivity] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!user || !supabase) return;
    void supabase
      .from('profiles')
      .select('display_name, share_activity')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setDisplayName(data.display_name ?? '');
          setShareActivity(data.share_activity ?? true);
        }
      });
  }, [user]);

  const saveProfile = async () => {
    if (!user || !supabase) return;
    await supabase
      .from('profiles')
      .upsert({ id: user.id, display_name: displayName.trim() || 'Reader', share_activity: shareActivity });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="font-display text-2xl font-semibold">
        {user ? 'Profile' : 'Settings & stats'}
      </h1>

      {/* Reading stats — available to everyone */}
      <section aria-label="Reading stats" className="mt-6 grid grid-cols-3 gap-3">
        {[
          { label: 'Books finished', value: String(stats.booksCompleted) },
          { label: 'Time listened', value: formatDuration(stats.totalListenSeconds) },
          { label: 'Day streak', value: String(stats.streakDays) },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-edge bg-surface p-4 text-center">
            <p className="font-display text-2xl font-semibold text-gold">{s.value}</p>
            <p className="mt-1 text-xs text-muted">{s.label}</p>
          </div>
        ))}
      </section>

      {/* Appearance */}
      <section aria-label="Appearance" className="mt-6 rounded-xl border border-edge bg-surface p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">Appearance</h2>
            <p className="mt-0.5 text-xs text-muted">Dark is Ausculto's natural habitat.</p>
          </div>
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            className="flex items-center gap-2 rounded-lg border border-edge px-3 py-2 text-sm text-muted transition-colors hover:border-gold hover:text-gold"
          >
            {theme === 'dark' ? <SunIcon size={16} /> : <MoonIcon size={16} />}
            {theme === 'dark' ? 'Light mode' : 'Dark mode'}
          </button>
        </div>
      </section>

      {/* Account */}
      <section aria-label="Account" className="mt-6 rounded-xl border border-edge bg-surface p-5">
        {!isSupabaseConfigured ? (
          <>
            <h2 className="text-sm font-semibold">Account</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Everything you do is saved on this device. To enable sign-in, cloud sync, and social
              features, add <code className="rounded bg-page px-1 py-0.5 text-xs">VITE_SUPABASE_URL</code> and{' '}
              <code className="rounded bg-page px-1 py-0.5 text-xs">VITE_SUPABASE_ANON_KEY</code> to a{' '}
              <code className="rounded bg-page px-1 py-0.5 text-xs">.env</code> file and run the migrations
              in <code className="rounded bg-page px-1 py-0.5 text-xs">supabase/migrations/</code>.
            </p>
          </>
        ) : loading ? (
          <p className="text-sm text-muted">Checking session…</p>
        ) : !user ? (
          <>
            <h2 className="text-sm font-semibold">Account</h2>
            <p className="mt-2 text-sm text-muted">
              You're reading as a guest — everything is saved on this device. Sign in to sync your
              progress, bookmarks, highlights, and notes across devices.
            </p>
            <button
              onClick={() => setAuthOpen(true)}
              className="mt-4 rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-charcoal hover:bg-gold-bright"
            >
              Sign in or create account
            </button>
          </>
        ) : (
          <div className="space-y-4">
            <div>
              <label htmlFor="display-name" className="block text-xs font-medium text-muted">
                Display name
              </label>
              <input
                id="display-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="mt-1.5 w-full rounded-lg border border-edge bg-page px-3 py-2 text-sm outline-none focus:border-gold"
              />
            </div>
            <div>
              <p className="text-xs font-medium text-muted">Email</p>
              <p className="mt-1 text-sm">{user.email}</p>
            </div>
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={shareActivity}
                onChange={(e) => setShareActivity(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-[#B8963E]"
              />
              <span className="text-sm">
                Share my reading activity
                <span className="block text-xs text-muted">
                  Counts you (anonymously) in “X people reading” on book cards. Never shows your name.
                </span>
              </span>
            </label>
            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={() => void saveProfile()}
                className="rounded-lg bg-gold px-4 py-2 text-sm font-semibold text-charcoal hover:bg-gold-bright"
              >
                {saved ? 'Saved ✓' : 'Save'}
              </button>
              <button
                onClick={() => void signOut()}
                className="rounded-lg border border-edge px-4 py-2 text-sm text-muted transition-colors hover:border-red-400 hover:text-red-400"
              >
                Sign out
              </button>
            </div>
          </div>
        )}
      </section>

      <p className="mt-8 text-center text-xs leading-relaxed text-muted">
        Audio from <a className="text-gold hover:underline" href="https://librivox.org" target="_blank" rel="noreferrer">LibriVox</a> ·
        Text from <a className="text-gold hover:underline" href="https://www.gutenberg.org" target="_blank" rel="noreferrer">Project Gutenberg</a>
        <br />
        All books are in the public domain. Ausculto is free and open source.
      </p>

      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} />}
    </div>
  );
}
