/** @type {import('tailwindcss').Config} */
import typography from '@tailwindcss/typography';
import daisyui from 'daisyui';

export default {
  content: ['./src/**/*.{astro,ts}'],
  safelist: ['lyric-block', 'lyric-en', 'lyric-cn', 'lyric-ja', 'album-cover'],
  theme: {
    extend: {
      fontFamily: {
        sans: ["'MiSans'", 'system-ui', 'sans-serif'],
        mono: ["'JetBrains Mono'", 'ui-monospace', 'monospace'],
        display: ["'MiSans'", 'system-ui', 'sans-serif'],
      },
      letterSpacing: {
        tightest: '-0.07em',
        mega: '0.32em',
      },
      boxShadow: {
        punch: '0 22px 60px -20px color-mix(in oklab, var(--color-primary) 40%, transparent)',
        hard: '10px 10px 0 0 var(--color-ink)',
        hardCoral: '10px 10px 0 0 var(--color-primary)',
        hardCitrus: '10px 10px 0 0 var(--color-secondary)',
        hardTeal: '10px 10px 0 0 var(--color-accent)',
      },
      animation: {
        marquee: 'marquee 26s linear infinite',
        'marquee-slow': 'marquee 42s linear infinite',
        drift: 'drift 11s ease-in-out infinite',
        'spin-slow': 'spin 20s linear infinite',
        float: 'float 5s ease-in-out infinite',
      },
      keyframes: {
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        drift: {
          '0%, 100%': { transform: 'translate3d(0,0,0) rotate(0deg)' },
          '50%': { transform: 'translate3d(14px,-20px,0) rotate(4deg)' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
      },
    },
  },
  plugins: [typography, daisyui],
  daisyui: {
    // daisyUI 5 only accepts built-in theme names here.
    // Custom "paper" tokens are injected via CSS in global.css.
    themes: ['light --default'],
    darkTheme: 'light',
    logs: false,
  },
};
