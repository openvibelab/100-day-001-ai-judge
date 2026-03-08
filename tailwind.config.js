/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{vue,js}"],
  theme: {
    extend: {
      colors: {
        brand: {
          orange: '#ff6b35',
          'orange-light': '#ff8c5a',
          'orange-dark': '#e85d2a',
          dark: '#16213e',
          teal: '#4ecdc4',
          cream: '#fef9f4',
          blue: '#667eea',
        }
      },
      fontFamily: {
        sans: ['-apple-system', '"PingFang SC"', '"Microsoft YaHei"', '"Helvetica Neue"', 'Arial', 'sans-serif'],
      },
      boxShadow: {
        'soft': '0 2px 8px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.03)',
        'soft-lg': '0 4px 12px rgba(0,0,0,0.06), 0 16px 40px rgba(0,0,0,0.05)',
        'glow-orange': '0 4px 24px rgba(255,107,53,0.25)',
        'glow-orange-lg': '0 8px 32px rgba(255,107,53,0.35)',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.25rem',
      },
    },
  },
  plugins: [],
}
