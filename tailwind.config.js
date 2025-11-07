/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./renderer.js"
  ],
  theme: {
    extend: {
      fontFamily: {
        'sans': ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      colors: {
        'remote': {
          'bg': '#2a2d3a',
          'panel': '#363b4a',
          'button': '#4a505e',
          'active': '#5a67d8',
          'text': '#e2e8f0',
          'accent': '#3182ce'
        }
      },
      boxShadow: {
        'remote': '0 8px 32px rgba(0, 0, 0, 0.3)',
        'button': '0 2px 8px rgba(0, 0, 0, 0.15)',
        'button-pressed': 'inset 0 2px 4px rgba(0, 0, 0, 0.3)',
        'led': '0 0 20px rgba(59, 130, 246, 0.8)'
      }
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
}