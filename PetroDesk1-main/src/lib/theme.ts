export type ThemeMode = 'light' | 'dark';

const THEME_STORAGE_KEY = 'petrodesk_theme';

export function getInitialTheme(): ThemeMode {
  if (typeof window === 'undefined') return 'light';
  const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (saved === 'dark' || saved === 'light') return saved;
  return 'light';
}

export function applyTheme(mode: ThemeMode): void {
  if (typeof window === 'undefined') return;
  const root = document.documentElement;
  root.classList.toggle('dark', mode === 'dark');
  root.style.colorScheme = mode;
  window.localStorage.setItem(THEME_STORAGE_KEY, mode);
}
