import { useCallback, useEffect } from 'react';
import { usePreferences } from './usePreferences';
import { preferencesStorage, type ThemePreference } from '@/lib/storage/preferences';

type ResolvedTheme = 'dark' | 'light';

function systemPrefersDark(): boolean {
  return (
    typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
  );
}

/** Resolve a preferência (`system`) para um tema concreto. */
export function resolveTheme(pref: ThemePreference): ResolvedTheme {
  return pref === 'system' ? (systemPrefersDark() ? 'dark' : 'light') : pref;
}

/** Aplica a classe de tema no elemento raiz (`<html>`). */
export function applyThemeClass(resolved: ResolvedTheme): void {
  const root = document.documentElement;
  root.classList.toggle('dark', resolved === 'dark');
  root.classList.toggle('light', resolved === 'light');
}

/**
 * Bootstrap do tema — chamado antes da renderização (em main.tsx) para evitar
 * flash de tema incorreto (FOUC).
 */
export function bootstrapTheme(): void {
  applyThemeClass(resolveTheme(preferencesStorage.getSnapshot().theme));
}

/**
 * Hook de tema: lê a preferência, aplica a classe no `<html>` e reage a
 * mudanças do tema do sistema quando a preferência é `system`.
 */
export function useTheme() {
  const { theme } = usePreferences();
  const resolvedTheme = resolveTheme(theme);

  useEffect(() => {
    applyThemeClass(resolvedTheme);
  }, [resolvedTheme]);

  useEffect(() => {
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyThemeClass(resolveTheme('system'));
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  const setTheme = useCallback((next: ThemePreference) => {
    preferencesStorage.update({ theme: next });
  }, []);

  return { theme, resolvedTheme, setTheme };
}
