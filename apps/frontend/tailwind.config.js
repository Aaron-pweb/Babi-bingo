/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        outfit: ['Outfit', 'sans-serif'],
        inter:  ['Inter', 'sans-serif'],
      },
      colors: {
        // Map Tailwind classes to CSS variables so dark/light mode is automatic
        bg:       'var(--bg)',
        surface:  'var(--surface)',
        surface2: 'var(--surface2)',
        border:   'var(--border)',
        text:     'var(--text)',
        dim:      'var(--dim)',
        muted:    'var(--muted)',
        gold:     'var(--gold)',
        'gold-light': 'var(--gold-light)',
        // Bingo columns (static — never change with theme)
        B: '#60a5fa',
        I: '#a78bfa',
        N: '#fbbf24',
        G: '#34d399',
        O: '#f87171',
      },
    },
  },
  plugins: [],
};
