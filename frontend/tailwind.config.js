/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx}",
    './pages/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      // ── MD3 Color System ──────────────────────────────────────
      colors: {
        'md': {
          primary: '#6B46C1',
          'on-primary': '#FFFFFF',
          'primary-container': '#E9D8FD',
          'on-primary-container': '#1A202C',
          secondary: '#4A5568',
          'on-secondary': '#FFFFFF',
          'secondary-container': '#EDF2F7',
          'on-secondary-container': '#1A202C',
          tertiary: '#667EEA',
          'on-tertiary': '#FFFFFF',
          'tertiary-container': '#EBF4FF',
          'on-tertiary-container': '#1A202C',
          error: '#E53E3E',
          'on-error': '#FFFFFF',
          'error-container': '#FED7D7',
          'on-error-container': '#1A202C',
          surface: '#FFFFFF',
          'on-surface': '#1A202C',
          'surface-variant': '#F7FAFC',
          'on-surface-variant': '#4A5568',
          outline: '#E2E8F0',
          'outline-variant': '#CBD5E0',
          background: '#F7FAFC',
          'on-background': '#1A202C',
          'inverse-surface': '#1A202C',
          'inverse-on-surface': '#FFFFFF',
          'surface-tint': '#6B46C1',
          // App-specific bubble colors
          'bubble-user': '#EDF2F7',
          'bubble-ai': '#EBF4FF',
        },
      },

      // ── MD3 Type Scale ─────────────────────────────────────────
      fontSize: {
        'display-lg': ['57px', { lineHeight: '64px', fontWeight: '400' }],
        'display-md': ['45px', { lineHeight: '52px', fontWeight: '400' }],
        'display-sm': ['36px', { lineHeight: '44px', fontWeight: '400' }],
        'headline-lg': ['32px', { lineHeight: '40px', fontWeight: '400' }],
        'headline-md': ['28px', { lineHeight: '36px', fontWeight: '400' }],
        'headline-sm': ['24px', { lineHeight: '32px', fontWeight: '400' }],
        'title-lg': ['22px', { lineHeight: '28px', fontWeight: '500' }],
        'title-md': ['16px', { lineHeight: '24px', fontWeight: '500' }],
        'title-sm': ['14px', { lineHeight: '20px', fontWeight: '500' }],
        'body-lg': ['16px', { lineHeight: '24px', fontWeight: '400' }],
        'body-md': ['14px', { lineHeight: '20px', fontWeight: '400' }],
        'body-sm': ['12px', { lineHeight: '16px', fontWeight: '400' }],
        'label-lg': ['14px', { lineHeight: '20px', fontWeight: '500' }],
        'label-md': ['12px', { lineHeight: '16px', fontWeight: '500' }],
        'label-sm': ['11px', { lineHeight: '16px', fontWeight: '500' }],
      },

      // ── MD3 Shape (Corner Radius) ──────────────────────────────
      borderRadius: {
        'shape-none': '0px',
        'shape-xs': '4px',
        'shape-sm': '8px',
        'shape-md': '12px',
        'shape-lg': '16px',
        'shape-xl': '28px',
        'shape-full': '9999px',
      },

      // ── MD3 Elevation (Shadow + Surface Tint) ─────────────────
      boxShadow: {
        'elevation-0': '0 0 0 rgba(0,0,0,0)',
        'elevation-1': '0 1px 3px 1px rgba(0,0,0,0.15), 0 1px 2px 0 rgba(0,0,0,0.30)',
        'elevation-2': '0 2px 6px 2px rgba(0,0,0,0.15), 0 1px 2px 0 rgba(0,0,0,0.30)',
        'elevation-3': '0 4px 8px 3px rgba(0,0,0,0.15), 0 1px 3px 0 rgba(0,0,0,0.30)',
        'elevation-4': '0 6px 10px 4px rgba(0,0,0,0.15), 0 2px 3px 0 rgba(0,0,0,0.30)',
        'elevation-5': '0 8px 12px 6px rgba(0,0,0,0.15), 0 4px 4px 0 rgba(0,0,0,0.30)',
        // Kept for backward compat
        card: '0 1px 3px 1px rgba(0,0,0,0.15), 0 1px 2px 0 rgba(0,0,0,0.30)',
        elevated: '0 4px 8px 3px rgba(0,0,0,0.15), 0 1px 3px 0 rgba(0,0,0,0.30)',
      },

      // ── MD3 Motion (Duration + Easing) ─────────────────────────
      transitionDuration: {
        'motion-xs': '50ms',
        'motion-sm': '100ms',
        'motion-md': '200ms',
        'motion-lg': '300ms',
        'motion-xl': '400ms',
      },
      transitionTimingFunction: {
        'emphasized': 'cubic-bezier(0.2, 0, 0, 1.0)',
        'emphasized-decelerate': 'cubic-bezier(0.05, 0.7, 0.1, 1.0)',
        'emphasized-accelerate': 'cubic-bezier(0.3, 0, 0.8, 0.15)',
        'standard': 'cubic-bezier(0.2, 0, 0, 1.0)',
        'standard-decelerate': 'cubic-bezier(0, 0, 0, 1.0)',
        'standard-accelerate': 'cubic-bezier(0.3, 0, 1, 1.0)',
      },
      animation: {
        'md-bounce': 'md-bounce 400ms cubic-bezier(0.2, 0, 0, 1.0) infinite',
        'md-fade-in': 'md-fade-in 200ms cubic-bezier(0, 0, 0, 1.0)',
        'md-pulse': 'md-pulse 1500ms cubic-bezier(0.2, 0, 0, 1.0) infinite',
      },
      keyframes: {
        'md-bounce': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-6px)' },
        },
        'md-fade-in': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'md-pulse': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.4' },
        },
      },

      // ── Legacy (DESIGN.md compat) ──────────────────────────────
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      spacing: {
        '4.5': '18px',
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
