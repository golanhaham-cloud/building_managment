import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f0f6f5",
          100: "#d9e9e6",
          200: "#b3d3cd",
          500: "#3f8a7d",
          600: "#316d63",
          700: "#28564f",
        },
        status: {
          paid: "#22a366",
          partial: "#e0a521",
          unpaid: "#e0483f",
        },
      },
      fontFamily: {
        sans: ["Assistant", "Heebo", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
export default config;
