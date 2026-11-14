/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#0D7A5F",
          dark: "#0A5F49",
        },
        bike: {
          DEFAULT: "#F59E0B",
          dark: "#D97706",
        },
        zinc: {
          950: "#09090B",
          900: "#121215",
          800: "#27272A",
          700: "#3F3F46",
          400: "#A1A1AA",
          500: "#71717A",
        },
      },
    },
  },
  plugins: [],
};
