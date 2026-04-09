import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        wmdm: {
          bg: "#0a0a0f",
          surface: "#14141f",
          border: "#1e1e2e",
          accent: "#6366f1",
          "accent-hover": "#818cf8",
          text: "#e2e8f0",
          "text-muted": "#94a3b8",
          success: "#22c55e",
          warning: "#f59e0b",
          error: "#ef4444",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
