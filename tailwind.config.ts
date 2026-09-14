import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Warm, creamy-white surface palette.
        cream: {
          50: "#fdfbf6",
          100: "#faf6ee",
          200: "#f4ecdd",
          300: "#ebdfc8",
        },
        // Clay accent (warm, not green) for primary actions and highlights.
        brand: {
          50: "#f9efe9",
          100: "#f0dccf",
          200: "#e2bda6",
          500: "#bd6a49",
          600: "#a9583a",
          700: "#8a462e",
        },
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(60, 45, 30, 0.04), 0 4px 16px rgba(60, 45, 30, 0.05)",
      },
    },
  },
  plugins: [],
};

export default config;
