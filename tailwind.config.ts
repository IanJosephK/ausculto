import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Semantic tokens — values live in index.css (:root = dark, .light overrides)
        page: 'var(--c-page)',
        surface: 'var(--c-surface)',
        surface2: 'var(--c-surface-2)',
        ink: 'var(--c-ink)',
        muted: 'var(--c-muted)',
        edge: 'var(--c-edge)',
        // Raw palette
        gold: {
          DEFAULT: '#B8963E',
          bright: '#D4B25C',
          faint: 'rgba(184, 150, 62, 0.16)',
        },
        charcoal: {
          DEFAULT: '#1C1C1E',
          soft: '#2C2C2E',
        },
        parchment: '#F5F0E8',
      },
      fontFamily: {
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        body: ['Lora', 'Georgia', 'serif'],
        ui: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif'],
      },
      boxShadow: {
        card: '0 2px 12px rgba(0, 0, 0, 0.3)',
        'card-hover': '0 8px 28px rgba(0, 0, 0, 0.45)',
        player: '0 -4px 24px rgba(0, 0, 0, 0.4)',
        pop: '0 4px 20px rgba(0, 0, 0, 0.5)',
      },
      maxWidth: {
        reading: '42rem',
      },
      animation: {
        'fade-in': 'fadeIn 0.25s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        slideUp: {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
