import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { api } from '@/api/client';
import type { Language, TokenPair } from '@/api/types';
import { currentLanguage, initI18n, setLanguage } from '@/i18n';

import { loadServerAddress } from '@/config';
import { clearTokens, getRefreshToken, loadTokens, onSessionChange, saveTokens } from './tokens';

/**
 * App-level session state. The flow a farmer sees:
 *   first launch → choose language → phone + code → (short profile) → home
 */
type Status = 'loading' | 'needsLanguage' | 'signedOut' | 'signedIn';

interface Session {
  status: Status;
  language: Language;
  chooseLanguage: (language: Language) => Promise<void>;
  signIn: (tokens: TokenPair) => Promise<void>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('loading');
  const [language, setLanguageState] = useState<Language>('en');

  useEffect(() => {
    let active = true;
    (async () => {
      await loadServerAddress();
      const saved = await initI18n();
      const signedIn = await loadTokens();
      if (!active) return;
      setLanguageState(currentLanguage());
      setStatus(saved === null ? 'needsLanguage' : signedIn ? 'signedIn' : 'signedOut');
    })();
    const unsubscribe = onSessionChange((signedIn) => {
      setStatus((previous) => (previous === 'needsLanguage' ? previous : signedIn ? 'signedIn' : 'signedOut'));
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const chooseLanguage = useCallback(async (next: Language) => {
    await setLanguage(next);
    setLanguageState(next);
    setStatus((previous) =>
      previous === 'needsLanguage' ? (getRefreshToken() ? 'signedIn' : 'signedOut') : previous,
    );
  }, []);

  const signIn = useCallback(async (tokens: TokenPair) => {
    await saveTokens(tokens);
  }, []);

  const signOut = useCallback(async () => {
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      // Revoke on the server too; sign out locally even when offline.
      await api('/auth/logout', { method: 'POST', body: { refresh_token: refreshToken }, auth: false }).catch(
        () => undefined,
      );
    }
    await clearTokens();
  }, []);

  const value = useMemo(
    () => ({ status, language, chooseLanguage, signIn, signOut }),
    [status, language, chooseLanguage, signIn, signOut],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error('useSession must be used inside SessionProvider');
  return session;
}
