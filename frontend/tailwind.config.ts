import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Per the deck (slide 5): each agent has a brand color.
        agent: {
          legal: "#EC4899",     // Legal Skeptic, pink
          data: "#0F172A",      // Data Expert, near-black
          rights: "#6366F1",    // Human Rights, indigo
          clarity: "#10B981",   // Clarity Critique, green
          partisan: "#EF4444",  // Partisan Checker, red
          question: "#F59E0B",  // Question Master, amber
        },
      },
    },
  },
  plugins: [],
};
export default config;
