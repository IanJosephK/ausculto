import { useEffect } from 'react';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useStore } from '../store/useStore';
import { XIcon } from './icons';

export function AuthModal({ onClose }: { onClose: () => void }) {
  const { user } = useAuth();
  const theme = useStore((s) => s.theme);

  // Close once sign-in completes
  useEffect(() => {
    if (user) onClose();
  }, [user, onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!supabase) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Sign in to Ausculto"
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-edge bg-surface p-6 shadow-pop animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-2 flex items-start justify-between">
          <div>
            <h2 className="font-display text-xl font-semibold">Welcome back</h2>
            <p className="mt-1 text-sm text-muted">
              Sign in to sync your progress, highlights, and notes across devices.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close sign-in dialog"
            className="rounded-lg p-1.5 text-muted hover:bg-surface2 hover:text-ink"
          >
            <XIcon size={18} />
          </button>
        </div>
        <div className="auth-container">
          <Auth
            supabaseClient={supabase}
            providers={['google']}
            redirectTo={typeof window !== 'undefined' ? window.location.href : undefined}
            theme={theme === 'dark' ? 'dark' : 'default'}
            appearance={{
              theme: ThemeSupa,
              variables: {
                default: {
                  colors: {
                    brand: '#B8963E',
                    brandAccent: '#D4B25C',
                    brandButtonText: '#1C1C1E',
                    inputText: 'var(--c-ink)',
                    inputBackground: 'var(--c-page)',
                    inputBorder: 'var(--c-edge)',
                    inputLabelText: 'var(--c-muted)',
                    anchorTextColor: '#B8963E',
                    messageText: 'var(--c-muted)',
                  },
                  fonts: {
                    bodyFontFamily: `-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`,
                    buttonFontFamily: `-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif`,
                  },
                  radii: {
                    borderRadiusButton: '10px',
                    inputBorderRadius: '10px',
                  },
                },
              },
            }}
          />
        </div>
      </div>
    </div>
  );
}
