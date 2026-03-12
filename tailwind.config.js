/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{vue,js}"],
  theme: {
    extend: {
      colors: {
        brand: {
          orange: '#c85d24',
          'orange-light': '#d97a45',
          'orange-dark': '#a84b1c',
          dark: '#2c2416',
          teal: '#5a8a7a',
          cream: '#faf7f2',
          blue: '#5a7a9e',
        },
        surface: {
          DEFAULT: '#f0ebe3',
          warm: '#e8e0d4',
        },
        ink: {
          DEFAULT: '#2c2416',
          secondary: '#7a6f5f',
          muted: '#a09585',
        }
      },
      fontFamily: {
        sans: ['"Source Sans 3"', '"Noto Sans SC"', '"PingFang SC"', '"Microsoft YaHei"', 'sans-serif'],
        serif: ['"DM Serif Display"', '"Noto Serif SC"', 'Georgia', 'serif'],
      },
      boxShadow: {
        'soft': '0 2px 8px rgba(44, 36, 22, 0.04), 0 8px 24px rgba(44, 36, 22, 0.03)',
        'soft-lg': '0 4px 12px rgba(44, 36, 22, 0.06), 0 16px 40px rgba(44, 36, 22, 0.05)',
        'warm': '0 4px 16px rgba(44, 36, 22, 0.08)',
        'warm-lg': '0 8px 32px rgba(44, 36, 22, 0.10)',
      },
      borderRadius: {
        'lg': '0.625rem',
        'xl': '0.875rem',
      },
    },
  },
  plugins: [],
}
