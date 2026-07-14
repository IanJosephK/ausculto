import { useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { OwlLogo } from './OwlLogo';
import { AuthModal } from './AuthModal';
import { BookmarkIcon, SearchIcon, UserIcon, XIcon } from './icons';
import { useAuth } from '../hooks/useAuth';
import { isSupabaseConfigured } from '../lib/supabase';
import { useInstallPrompt } from '../hooks/useInstallPrompt';

export function Layout() {
  const { user } = useAuth();
  const [authOpen, setAuthOpen] = useState(false);
  const location = useLocation();
  const install = useInstallPrompt();
  const onHome = location.pathname === '/';

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-40 border-b border-edge bg-page/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
          <Link to="/" className="flex items-center gap-2.5" aria-label="Ausculto home">
            <OwlLogo size={30} />
            <span className="font-display text-xl font-semibold tracking-wide">Ausculto</span>
          </Link>
          <div className="flex-1" />
          {onHome && (
            <button
              onClick={() => document.getElementById('library-search')?.focus()}
              aria-label="Search the library"
              className="rounded-lg p-2 text-muted transition-colors hover:bg-surface hover:text-ink"
            >
              <SearchIcon />
            </button>
          )}
          <Link
            to="/saved"
            aria-label="My Library — bookmarks, highlights and notes"
            className="rounded-lg p-2 text-muted transition-colors hover:bg-surface hover:text-ink"
          >
            <BookmarkIcon />
          </Link>
          {isSupabaseConfigured &&
            (user ? (
              <Link
                to="/profile"
                aria-label="Profile and settings"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-gold font-ui text-sm font-semibold text-charcoal"
              >
                {(user.email ?? 'R')[0].toUpperCase()}
              </Link>
            ) : (
              <button
                onClick={() => setAuthOpen(true)}
                className="rounded-lg px-3 py-1.5 text-sm text-gold transition-colors hover:bg-gold-faint"
              >
                Sign in
              </button>
            ))}
          {!isSupabaseConfigured && (
            <Link
              to="/profile"
              aria-label="Settings"
              className="rounded-lg p-2 text-muted transition-colors hover:bg-surface hover:text-ink"
            >
              <UserIcon />
            </Link>
          )}
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      {install.shouldShow && (
        <div className="fixed bottom-4 left-1/2 z-40 flex w-[calc(100%-2rem)] max-w-md -translate-x-1/2 items-center gap-3 rounded-xl border border-edge bg-surface p-3 shadow-pop animate-slide-up">
          <OwlLogo size={36} />
          <div className="flex-1 text-sm">
            <p className="font-medium">Enjoying Ausculto?</p>
            <p className="text-muted">Add it to your home screen for offline listening.</p>
          </div>
          <button
            onClick={() => void install.install()}
            className="rounded-lg bg-gold px-3 py-1.5 text-sm font-semibold text-charcoal hover:bg-gold-bright"
          >
            Install
          </button>
          <button
            onClick={install.dismiss}
            aria-label="Dismiss install suggestion"
            className="rounded-lg p-1.5 text-muted hover:text-ink"
          >
            <XIcon size={16} />
          </button>
        </div>
      )}

      {authOpen && <AuthModal onClose={() => setAuthOpen(false)} />}
    </div>
  );
}
