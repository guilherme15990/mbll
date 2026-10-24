/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        abyss: "#060913",
        surface: "#0a101f",
        panel: "#0d1527",
        panel2: "#131e36",
        panel3: "#182746",
        line: "#1e293b",
        "line-bright": "#334155",
        gold: "#f59e0b",
        "gold-light": "#fde68a",
        mist: "#94a3b8",
        foam: "#f8fafc",
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "monospace"],
      },
      boxShadow: {
        card: "0 4px 20px -2px rgba(0, 0, 0, 0.5)",
        "card-hover": "0 8px 30px -4px rgba(0, 0, 0, 0.6)",
        glow: "0 0 24px rgba(245, 158, 11, 0.2)",
        "glow-cyan": "0 0 24px rgba(56, 189, 248, 0.2)",
        "glow-emerald": "0 0 24px rgba(52, 211, 153, 0.2)",
      },
      animation: {
        fadeIn: "fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
        pulseSlow: "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(4px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};
