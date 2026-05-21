/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Apple-like dark mode palette
        bg: '#000000',
        'bg-elevated': '#0a0a0a',
        surface: {
          1: 'rgba(28, 28, 30, 0.72)',
          2: 'rgba(44, 44, 46, 0.72)',
          3: 'rgba(58, 58, 60, 0.72)',
        },
        label: {
          DEFAULT: '#ffffff',
          secondary: 'rgba(235, 235, 245, 0.6)',
          tertiary: 'rgba(235, 235, 245, 0.3)',
          quaternary: 'rgba(235, 235, 245, 0.18)',
        },
        separator: {
          DEFAULT: 'rgba(255, 255, 255, 0.08)',
          strong: 'rgba(255, 255, 255, 0.14)',
        },
        accent: {
          DEFAULT: '#0a84ff',
          hover: '#1f8eff',
          pressed: '#0570e0',
        },
        // Apple system colors
        sys: {
          green: '#30d158',
          red: '#ff453a',
          orange: '#ff9f0a',
          yellow: '#ffd60a',
          pink: '#ff375f',
          purple: '#bf5af2',
          teal: '#64d2ff',
          indigo: '#5e5ce6',
        },
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Display"',
          '"SF Pro Text"',
          'Inter',
          'system-ui',
          '"Helvetica Neue"',
          'sans-serif',
        ],
        mono: [
          '"SF Mono"',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Monaco',
          'Consolas',
          'monospace',
        ],
      },
      borderRadius: {
        '2xs': '4px',
        xs: '6px',
        sm: '8px',
        md: '10px',
        lg: '12px',
        xl: '16px',
        '2xl': '20px',
        '3xl': '24px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(0, 0, 0, 0.3), 0 8px 24px rgba(0, 0, 0, 0.18)',
        elevated: '0 4px 12px rgba(0, 0, 0, 0.5), 0 16px 48px rgba(0, 0, 0, 0.32)',
        focus: '0 0 0 3px rgba(10, 132, 255, 0.35)',
      },
      transitionTimingFunction: {
        'apple': 'cubic-bezier(0.4, 0, 0.2, 1)',
        'spring': 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
      },
    },
  },
  plugins: [],
};
