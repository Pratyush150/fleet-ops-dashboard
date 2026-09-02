/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Every colour is a CSS custom property defined on :root and overridden
        // by [data-theme], so the theme toggle is a single attribute swap and
        // no colour is trapped inside a media query.
        app: 'var(--bg-app)',
        panel: 'var(--bg-panel)',
        raised: 'var(--bg-raised)',
        sunken: 'var(--bg-sunken)',
        line: 'var(--border-default)',
        'line-strong': 'var(--border-strong)',
        ink: 'var(--text-primary)',
        'ink-muted': 'var(--text-muted)',
        'ink-faint': 'var(--text-faint)',
        accent: 'var(--accent)',
        'accent-soft': 'var(--accent-soft)',
        nominal: 'var(--status-nominal)',
        warning: 'var(--status-warning)',
        critical: 'var(--status-critical)',
        offline: 'var(--status-offline)',
        info: 'var(--status-info)',
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
        sans: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
