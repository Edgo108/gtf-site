import type { Config } from "tailwindcss";

// Thème "tactique" du GTF — utilisé sur toutes les pages internes
// (dashboard, enquêtes, etc.) une fois l'utilisateur connecté.
// La page d'accueil publique aura son propre thème clair, séparé de celui-ci.
export default {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        gtf: {
          bg: "#0A0C0F",
          panel: "#12151A",
          "panel-alt": "#1A1E24",
          border: "#262B33",
          text: "#E8EAED",
          "text-muted": "#8B94A0",
          blue: "#3E6FA6",
          "blue-hover": "#5B94D6",
          red: "#B23A32",
          green: "#4B8B6B",
          amber: "#C99A3E",
        },
      },
      fontFamily: {
        display: ["var(--font-oswald)", "sans-serif"],
        sans: ["var(--font-ibm-plex-sans)", "sans-serif"],
        mono: ["var(--font-ibm-plex-mono)", "monospace"],
      },
    },
  },
  plugins: [],
} satisfies Config;
