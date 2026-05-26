/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: { outfit: ['Outfit', 'sans-serif'] },
      colors: {
        bg:      '#09090f',
        surface: '#111118',
        border:  '#1e1e2e',
        gold:    '#f5a623',
        'gold-light': '#fbbf24',
        muted:   '#4a4a6a',
        dim:     '#6b6b8a',
        B: '#60a5fa',
        I: '#a78bfa',
        N: '#fbbf24',
        G: '#34d399',
        O: '#f87171',
      },
      animation: {
        'number-in': 'numberIn 0.5s cubic-bezier(0.16,1,0.3,1) both',
        'fade-in':   'fadeIn 0.3s ease both',
        'pulse-glow':'pulseGlow 2s ease-in-out infinite',
        'win':       'winPop 0.6s cubic-bezier(0.16,1,0.3,1) both',
      },
      keyframes: {
        numberIn: { '0%': { opacity: 0, transform: 'scale(0.5) translateY(40px)' }, '100%': { opacity: 1, transform: 'scale(1) translateY(0)' } },
        fadeIn:   { '0%': { opacity: 0 }, '100%': { opacity: 1 } },
        pulseGlow:{ '0%,100%': { opacity: 0.8 }, '50%': { opacity: 1 } },
        winPop:   { '0%': { opacity: 0, transform: 'scale(0.3)' }, '60%': { transform: 'scale(1.1)' }, '100%': { opacity: 1, transform: 'scale(1)' } },
      },
    },
  },
  plugins: [],
};
