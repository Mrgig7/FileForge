/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        // Premium Dark Theme Palette (Zinc-based for neutral, Violet/Indigo for accents)
        background: '#09090b', // Zinc 950
        surface: '#18181b',    // Zinc 900
        'surface-hover': '#27272a', // Zinc 800
        border: '#27272a',     // Zinc 800
        input: '#27272a',
        
        primary: {
          DEFAULT: '#6366f1', // Indigo 500
          hover: '#4f46e5',   // Indigo 600
          foreground: '#ffffff'
        },
        secondary: {
          DEFAULT: '#27272a', // Zinc 800
          hover: '#3f3f46',   // Zinc 700
          foreground: '#fafafa' // Zinc 50
        },
        muted: {
          DEFAULT: '#71717a', // Zinc 500
          foreground: '#a1a1aa' // Zinc 400
        },
        destructive: {
          DEFAULT: '#ef4444', // Red 500
          hover: '#dc2626',   // Red 600
        },
        success: {
          DEFAULT: '#10b981', // Emerald 500
        },
        warning: {
          DEFAULT: '#f59e0b', // Amber 500
        }
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      boxShadow: {
        'sm': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        'DEFAULT': '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)',
        'md': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
        'lg': '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
        'xl': '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
        'glow': '0 0 20px rgba(99, 102, 241, 0.15)',
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.37)'
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'pulse-subtle': 'pulseSubtle 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        pulseSubtle: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.8' },
        }
      }
    }
  },
  plugins: [],
} 