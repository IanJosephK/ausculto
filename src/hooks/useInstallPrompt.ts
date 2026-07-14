import { useEffect, useState } from 'react';
import { useStore } from '../store/useStore';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    listeners.forEach((l) => l());
  });
}

/** Minimum listening time before we suggest installing (spec: 5+ minutes). */
const INSTALL_SUGGEST_SECONDS = 5 * 60;

export function useInstallPrompt() {
  const [available, setAvailable] = useState(deferredPrompt !== null);
  const totalListenSeconds = useStore((s) => s.totalListenSeconds);
  const dismissed = useStore((s) => s.installPromptDismissed);
  const dismiss = useStore((s) => s.dismissInstallPrompt);

  useEffect(() => {
    const update = () => setAvailable(deferredPrompt !== null);
    listeners.add(update);
    return () => {
      listeners.delete(update);
    };
  }, []);

  const shouldShow = available && !dismissed && totalListenSeconds >= INSTALL_SUGGEST_SECONDS;

  const install = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    deferredPrompt = null;
    setAvailable(false);
    if (choice.outcome === 'dismissed') dismiss();
  };

  return { shouldShow, install, dismiss };
}
