import type { Config } from "tailwindcss";
// Auto-generated token theme — rebuilt by the Figma sync pipeline
const generatedTokens = require("./src/styles/tailwind-tokens");

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/app/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      ...generatedTokens,
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
