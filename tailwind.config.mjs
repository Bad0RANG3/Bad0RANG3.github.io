/** @type {import('tailwindcss').Config} */
import typography from '@tailwindcss/typography';
import daisyui from 'daisyui';

export default {
  content: ['./src/**/*.{astro,ts,md,mdx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ["'MiSans'", 'sans-serif'],
        mono: ["'JetBrains Mono'", 'monospace'],
      },
    },
  },
  plugins: [typography, daisyui],
  daisyui: {
    themes: [
      {
        dark: {
          'primary':        'oklch(62% .18 190)',
          'primary-content': 'oklch(97% .01 185)',
          'secondary':       'oklch(72% .12 175)',
          'secondary-content':'oklch(25% .05 175)',
          'accent':          'oklch(78% .10 200)',
          'accent-content':  'oklch(25% .05 200)',
        },
      },
    ],
    darkTheme: 'dark',
  },
};
