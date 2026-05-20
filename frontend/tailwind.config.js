/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans:  ['DM Sans', 'system-ui', 'sans-serif'],
        head:  ['Syne', 'sans-serif'],
        mono:  ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      colors: {
        cf: {
          bg:       '#0A0E1A',
          surface:  '#0D1525',
          card:     '#141C2E',
          subtle:   '#1E2A42',
          border:   'rgba(255,255,255,0.07)',
          accent:   '#00E5B0',
          blue:     '#3D7BFF',
          amber:    '#FFB800',
          pink:     '#FF5078',
          text:     '#F0F4FF',
          muted:    '#8892AA',
        },
      },
      borderColor: {
        DEFAULT: 'rgba(255,255,255,0.07)',
      },
      animation: {
        'fade-up':     'fadeUp 0.4s ease both',
        'fade-in':     'fadeIn 0.3s ease both',
        'pulse-green': 'pulseGreen 2s infinite',
        'spin-slow':   'spin 2s linear infinite',
      },
      keyframes: {
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(14px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        pulseGreen: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(0,229,176,0.3)' },
          '50%':      { boxShadow: '0 0 0 8px rgba(0,229,176,0)' },
        },
      },
      boxShadow: {
        'accent':  '0 8px 24px rgba(0,229,176,0.3)',
        'blue':    '0 8px 24px rgba(61,123,255,0.3)',
        'card':    '0 4px 24px rgba(0,0,0,0.4)',
        'tooltip': '0 8px 32px rgba(0,0,0,0.5)',
      },
      backdropBlur: {
        xs: '4px',
      },
    },
  },
  plugins: [],
};
