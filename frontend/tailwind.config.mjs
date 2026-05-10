export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        walmart: "#f6f7f8", // <- Color de fondo tipo Walmart
        /** Identidad Zona Market (manual de marca) */
        zm: {
          green: "#4F772D",
          "green-dark": "#3d5f24",
          sidebar: "#2c4819",
          red: "#E63946",
          yellow: "#FDC639",
          cream: "#fafcf7",
        },
      },
      fontFamily: {
        zm: ['"Poppins"', "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
