import type { Config } from "tailwindcss";
const generatedTokens = require("./src/styles/tailwind-tokens");

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/app/**/*.{ts,tsx}",
  ],
  safelist: [
    "text-critical", "bg-critical", "border-critical",
    "text-stable",   "bg-stable",   "border-stable",
    "text-warning",  "bg-warning",  "border-warning",
    "text-success",  "bg-success",  "border-success",
    "bg-critical/5", "bg-critical/10", "bg-critical/15",
    "bg-warning/10", "bg-warning/15",
    "bg-success/10", "bg-success/15",
    "bg-stable/15",  "border-stable/30",
    "border-critical/30", "border-critical/40", "border-critical/50",
    "border-warning/30",  "border-success/30",
  ],
  theme: {
    extend: {
      ...generatedTokens,
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
