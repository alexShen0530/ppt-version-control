/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: 'rgb(var(--c-paper) / <alpha-value>)',
        surface: 'rgb(var(--c-surface) / <alpha-value>)',
        raised: 'rgb(var(--c-raised) / <alpha-value>)',
        ink: 'rgb(var(--c-ink) / <alpha-value>)',
        inksoft: 'rgb(var(--c-inksoft) / <alpha-value>)',
        mute: 'rgb(var(--c-slate) / <alpha-value>)',
        faint: 'rgb(var(--c-faint) / <alpha-value>)',
        line: 'rgb(var(--c-line) / <alpha-value>)',
        line2: 'rgb(var(--c-line2) / <alpha-value>)',
        blueprint: 'rgb(var(--c-blueprint) / <alpha-value>)',
        success: 'rgb(var(--c-success) / <alpha-value>)',
        danger: 'rgb(var(--c-danger) / <alpha-value>)',
        warn: 'rgb(var(--c-warn) / <alpha-value>)',
      },
      fontFamily: {
        sans: [
          'Instrument Sans',
          'Noto Sans SC',
          'PingFang SC',
          'Hiragino Sans GB',
          'Microsoft YaHei',
          'system-ui',
          'sans-serif',
        ],
      },
      fontSize: {
        micro: ['11px', { lineHeight: '14px' }],
        caption: ['12px', { lineHeight: '16px' }],
        body: ['13px', { lineHeight: '18px' }],
        base: ['14px', { lineHeight: '20px' }],
      },
      borderRadius: {
        card: '10px',
        thumb: '6px',
        field: '7px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(23, 26, 32, 0.04)',
        'card-hover': '0 2px 10px -2px rgba(23, 26, 32, 0.10)',
        lift: '0 12px 32px -12px rgba(23, 26, 32, 0.28)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'rise-in': {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 160ms ease-out',
        'rise-in': 'rise-in 200ms cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [],
}
