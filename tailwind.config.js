/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./index.tsx",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: '#F4EFEA',
        ink: '#383838',
        'duck-yellow': '#FFD700',
        'link-blue': '#007AFF',
        'terminal-red': '#FF5F56',
        'terminal-green': '#27C93F',
      },
      fontFamily: {
        mono: ['"Aeonik Mono"', 'ui-monospace', 'Menlo', 'Consolas', 'monospace'],
        sans: ['Inter', 'sans-serif'],
      },
      boxShadow: {
        'brutal': '2px 2px 0px #383838',
        'brutal-lg': '4px 4px 0px rgba(0,0,0,0.1)',
        'terminal': '6px 6px 0px rgba(0,0,0,0.1)',
      },
      letterSpacing: {
        'tight-mono': '0.32px',
        'wide-head': '1.44px',
      },
      fontSize: {
        'mega': ['72px', { lineHeight: '86.4px' }],
        'card': ['20px', { lineHeight: '28px' }],
      },
      transitionDuration: {
        'brutal': '200ms',
      },
    },
  },
  plugins: [],
}
