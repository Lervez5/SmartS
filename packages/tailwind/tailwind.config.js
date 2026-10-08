module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx}",
    "./packages/ui/src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#16a34a",
        brand: {
          light: "#4ade80",
          dark: "#166534",
        },
        secondary: "#64748b",
        success: "#10b981",
        warning: "#f59e0b",
        danger: "#ef4444",
      },
    },
  },
  plugins: [],
};
