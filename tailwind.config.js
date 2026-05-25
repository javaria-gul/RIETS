/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cyber: {
          bg: "#080c16",
          card: "rgba(13, 20, 35, 0.6)",
          border: "rgba(255, 255, 255, 0.08)",
          text: "#f8fafc",
          primary: "#06b6d4", // cyan
          secondary: "#8b5cf6", // violet
          accent: "#f43f5e", // rose
          warning: "#f59e0b", // amber
          success: "#10b981", // emerald
        }
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.5)',
        'glass-hover': '0 8px 32px 0 rgba(6, 182, 212, 0.15)',
        'glow-cyan': '0 0 15px rgba(6, 182, 212, 0.3)',
      },
      animation: {
        'pulse-fast': 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'flash-red': 'flashRed 1.5s infinite',
        'glow-cyan': 'glowCyan 2s infinite',
      },
      keyframes: {
        flashRed: {
          '0%, 100%': { backgroundColor: 'rgba(244, 63, 94, 0.1)', borderColor: 'rgba(244, 63, 94, 0.3)' },
          '50%': { backgroundColor: 'rgba(244, 63, 94, 0.35)', borderColor: 'rgba(244, 63, 94, 0.9)', boxShadow: '0 0 15px rgba(244, 63, 94, 0.4)' },
        },
        glowCyan: {
          '0%, 100%': { boxShadow: '0 0 5px rgba(6, 182, 212, 0.2)' },
          '50%': { boxShadow: '0 0 20px rgba(6, 182, 212, 0.6)' },
        }
      }
    },
  },
  plugins: [],
}
