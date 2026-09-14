/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{vue,js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        blue: {
          50: "rgb(var(--brand-50-rgb) / <alpha-value>)",
          100: "rgb(var(--brand-100-rgb) / <alpha-value>)",
          200: "rgb(var(--brand-200-rgb) / <alpha-value>)",
          300: "rgb(var(--brand-300-rgb) / <alpha-value>)",
          400: "rgb(var(--brand-400-rgb) / <alpha-value>)",
          500: "rgb(var(--brand-500-rgb) / <alpha-value>)",
          600: "rgb(var(--brand-600-rgb) / <alpha-value>)",
          700: "rgb(var(--brand-700-rgb) / <alpha-value>)",
          800: "rgb(var(--brand-800-rgb) / <alpha-value>)",
          900: "rgb(var(--brand-900-rgb) / <alpha-value>)",
          950: "rgb(var(--brand-950-rgb) / <alpha-value>)",
        },
      },
    },
  },
  plugins: [],
};
