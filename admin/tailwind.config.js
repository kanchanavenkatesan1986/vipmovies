/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        netflix: {
          red: "#E50914",
          darkRed: "#B9090B",
          black: "#141414",
          darkBg: "#0B0B0B",
          card: "rgba(22, 22, 26, 0.75)",
          border: "rgba(255, 255, 255, 0.08)",
          muted: "#999999",
          gray: "#2F2F2F"
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      backdropBlur: {
        xs: '2px',
      }
    },
  },
  plugins: [],
}
