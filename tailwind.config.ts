import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          '"SF Pro Display"',
          '"PingFang SC"',
          '"Helvetica Neue"',
          '"Microsoft YaHei"',
          "system-ui",
          "sans-serif",
        ],
      },
      colors: {
        // 暖色柔和儿童色板
        ink: {
          DEFAULT: "#1d1d1f",
          soft: "#3a3a3c",
          muted: "#6e6e73",
          faint: "#a1a1a6",
        },
        cream: "#fbf7f0",
        canvas: "#f5f6fa",
        brand: {
          50: "#fff4ed",
          100: "#ffe5d4",
          200: "#ffc9a8",
          300: "#ffa974",
          400: "#ff8a4c",
          500: "#ff6b2c",
          600: "#f04e0e",
        },
        mint: "#5ec8a8",
        sky: "#5ab0ff",
        lavender: "#a78bfa",
        peach: "#ff9eaa",
        sunny: "#ffd166",
      },
      borderRadius: {
        "4xl": "2rem",
        "5xl": "2.5rem",
      },
      boxShadow: {
        soft: "0 2px 8px rgba(17,17,26,0.04), 0 8px 24px rgba(17,17,26,0.06)",
        lift: "0 4px 16px rgba(17,17,26,0.06), 0 16px 48px rgba(17,17,26,0.10)",
        glow: "0 8px 32px rgba(255,107,44,0.22)",
      },
      backdropBlur: {
        xl: "24px",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "pop-in": {
          "0%": { opacity: "0", transform: "scale(0.96)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        float: {
          "0%,100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.5s cubic-bezier(0.22,1,0.36,1) both",
        "pop-in": "pop-in 0.35s cubic-bezier(0.22,1,0.36,1) both",
        float: "float 4s ease-in-out infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
