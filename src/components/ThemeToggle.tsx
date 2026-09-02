import type { ThemeName } from '../hooks/useTheme';

export interface ThemeToggleProps {
  readonly theme: ThemeName;
  readonly onToggle: () => void;
}

/** Two-state theme switch. The label states the target, not the current theme. */
export function ThemeToggle({ theme, onToggle }: ThemeToggleProps): JSX.Element {
  const target = theme === 'dark' ? 'light' : 'dark';
  return (
    <button
      type="button"
      onClick={onToggle}
      className="rounded border border-line bg-raised px-2.5 py-1 text-xs text-ink hover:bg-panel"
      aria-label={`Switch to ${target} theme`}
    >
      {theme === 'dark' ? 'Light theme' : 'Dark theme'}
    </button>
  );
}
