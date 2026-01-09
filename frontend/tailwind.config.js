/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        dark: {
          bg: '#0a0e14',
          surface: '#161b22',
          border: 'rgba(255, 255, 255, 0.1)',
        },
        text: {
          primary: '#e6edf3',
          secondary: '#8b949e',
        },
        disciplinas: {
          portugues: '#3b82f6',
          matematica: '#f59e0b',
          constitucional: '#8b5cf6',
          administrativo: '#ec4899',
          informatica: '#06b6d4',
          logica: '#10b981',
          ingles: '#f97316',
          atualidades: '#eab308',
          geografia: '#14b8a6',
          historia: '#a855f7',
          fisica: '#0ea5e9',
          quimica: '#84cc16',
        },
        semantic: {
          success: '#10b981',
          warning: '#fbbf24',
          error: '#ef4444',
          info: '#06b6d4',
        },
      },
      fontFamily: {
        sans: ['Inter', 'IBM Plex Sans', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      keyframes: {
        slideInRight: {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        pulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
      },
      animation: {
        slideInRight: 'slideInRight 300ms cubic-bezier(0.4, 0, 0.2, 1)',
        fadeIn: 'fadeIn 200ms ease-out',
        pulse: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      scale: {
        '98': '0.98',
      },
    },
  },
  plugins: [],
}
