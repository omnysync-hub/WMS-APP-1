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
        hvac: {
          DEFAULT: "#06B6D4",
          dark: "#0891B2",
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
