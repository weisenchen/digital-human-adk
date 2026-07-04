/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
      "./src/**/*.{js,ts,jsx,tsx}",
      './pages/**/*.{js,ts,jsx,tsx}',
      './components/**/*.{js,ts,jsx,tsx}',
    ],
  theme: {
    extend: {
      colors: {
        // DESIGN.md token mapping
        brand: {
          primary: '#1A202C',
          secondary: '#4A5568',
          tertiary: '#6B46C1',
          'tertiary-light': '#E9D8FD',
          accent: '#667EEA',
          surface: '#FFFFFF',
          background: '#F7FAFC',
        },
        bubble: {
          user: '#EDF2F7',
          ai: '#EBF4FF',
        },
        muted: '#A0AEC0',
        'border-light': '#E2E8F0',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        sm: '6px',
        md: '12px',
        lg: '16px',
        xl: '20px',
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)',
        elevated: '0 4px 6px rgba(0,0,0,0.07), 0 2px 4px rgba(0,0,0,0.06)',
        modal: '0 10px 15px rgba(0,0,0,0.1), 0 4px 6px rgba(0,0,0,0.05)',
      },
      spacing: {
        '4.5': '18px',
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
