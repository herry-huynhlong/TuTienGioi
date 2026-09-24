import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#101513",
        jade: "#2dd4bf",
        gold: "#d6b25e",
        paper: "#f4efe3"
      }
    }
  },
  plugins: []
} satisfies Config;
