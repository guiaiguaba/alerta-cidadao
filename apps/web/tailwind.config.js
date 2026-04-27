/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // === BASE (dark command center) ===
        void:    '#060810',
        base:    '#0A0C12',
        surface: '#111520',
        panel:   '#161B28',
        border:  '#1E2535',
        muted:   '#252D3F',

        // === TEXT ===
        primary:   '#E8EDF5',
        secondary: '#8A96A8',
        tertiary:  '#4E5A6B',

        // === BRAND AMBER ===
        amber: {
          50:  '#FFFBEB', 100: '#FEF3C7', 200: '#FDE68A',
          300: '#FCD34D', 400: '#FBBF24', 500: '#F59E0B',
          600: '#D97706', 700: '#B45309', 800: '#92400E', 900: '#78350F',
        },

        // === SEVERITY ===
        critical: { DEFAULT: '#EF4444', bg: '#1A0808', border: '#3D1515' },
        high:     { DEFAULT: '#F97316', bg: '#1A0D04', border: '#3D2010' },
        medium:   { DEFAULT: '#EAB308', bg: '#1A1602', border: '#3D3408' },
        low:      { DEFAULT: '#22C55E', bg: '#031A0B', border: '#083D1A' },
        info:     { DEFAULT: '#3B82F6', bg: '#020B1A', border: '#071E3D' },

        // === STATUS ===
        status: {
          open:        '#F97316',
          assigned:    '#3B82F6',
          in_progress: '#8B5CF6',
          resolved:    '#22C55E',
          rejected:    '#EF4444',
          duplicate:   '#6B7280',
        },
      },

      fontFamily: {
        sans:    ['IBM Plex Sans', 'system-ui', 'sans-serif'],
        mono:    ['IBM Plex Mono', 'ui-monospace', 'monospace'],
        display: ['IBM Plex Sans Condensed', 'system-ui', 'sans-serif'],
      },

      fontSize: {
        '2xs': ['0.65rem', { lineHeight: '1rem' }],
        xs:    ['0.75rem', { lineHeight: '1.125rem' }],
        sm:    ['0.8125rem', { lineHeight: '1.25rem' }],
        base:  ['0.9375rem', { lineHeight: '1.5rem' }],
      },

      boxShadow: {
        'glow-amber':    '0 0 20px rgba(245, 158, 11, 0.15)',
        'glow-critical': '0 0 20px rgba(239, 68, 68, 0.2)',
        'panel':         '0 1px 0 rgba(255,255,255,0.04), 0 4px 24px rgba(0,0,0,0.4)',
        'inset-top':     'inset 0 1px 0 rgba(255,255,255,0.06)',
      },

      backgroundImage: {
        'grid-dots':  'radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px)',
        'amber-glow': 'radial-gradient(ellipse at 50% 0%, rgba(245,158,11,0.08) 0%, transparent 60%)',
      },

      backgroundSize: {
        'dots': '24px 24px',
      },

      animation: {
        'pulse-slow':   'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'slide-in':     'slideIn 0.2s ease-out',
        'fade-in':      'fadeIn 0.3s ease-out',
        'ping-once':    'ping 0.6s cubic-bezier(0, 0, 0.2, 1) 1',
      },

      keyframes: {
        slideIn: { from: { transform: 'translateX(100%)' }, to: { transform: 'translateX(0)' } },
        fadeIn:  { from: { opacity: 0 }, to: { opacity: 1 } },
      },
    },
  },
  plugins: [],
};
