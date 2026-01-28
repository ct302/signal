/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      screens: {
        'xs': '375px',  // Small phones (iPhone SE)
      },
      minHeight: {
        'touch': '44px',  // Minimum touch target size
      },
      minWidth: {
        'touch': '44px',  // Minimum touch target size
      },
      spacing: {
        'safe-bottom': 'env(safe-area-inset-bottom, 0px)',
      },
    },
  },
  plugins: [],
}
