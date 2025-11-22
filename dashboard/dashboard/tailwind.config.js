/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [require('@spartan-ng/brain/hlm-tailwind-preset')], // ✅ Spartan preset
  content: [
    "./src/**/*.{html,ts}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}