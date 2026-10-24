/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        // ── single source of truth — extracted from the Dashboard reference ──
        // warm editorial palette: cream canvas, taupe lines, lavender soft-accent
        canvas: "#fbfaf8", // page background
        ink: "#111111", // primary text
        line: {
          DEFAULT: "#d7d2ca", // card / panel border
          soft: "#eeeae4", // inner row dividers
        },
        lavender: {
          DEFAULT: "#d7c1ff", // soft-accent fill: icon boxes, tags, primary buttons, rank #1
          text: "#8d68ff", // accent text / deltas
        },
        blush: {
          DEFAULT: "#ff91a7", // avatar / secondary action icon
          soft: "#ff9faf",
          dismiss: "#ffd7dc", // dismiss / danger-soft button
        },
        sprout: "#ccead2", // success/"Enabled" badge bg
        // keep violet alias for any non-migrated spots
        accent: { DEFAULT: "#8d68ff", soft: "#d7c1ff", softText: "#4c2f9e" },
        sidebar: { DEFAULT: "#111719", active: "#d7c1ff", muted: "#8a8a93" },
      },
      borderRadius: {
        card: "3px", // canonical card/panel radius (near-square)
        chip: "2px", // badges / tags / inner tiles
      },
      // ── responsive tokens (RESPONSIVE_DESIGN_RULES.md) ──
      spacing: {
        page: "clamp(16px, 2vw, 40px)", // page padding
        section: "clamp(16px, 2vw, 32px)", // gaps between blocks
        card: "clamp(12px, 1.5vw, 24px)", // gaps between / inside cards
      },
      maxWidth: {
        content: "1920px", // design base — content centers beyond this
      },
      width: {
        rpanel: "360px", // fixed right panel (Auto Mode / Quick Actions)
      },
      minWidth: {
        card: "240px", // cards never crush below this
      },
      boxShadow: {
        card: "0 1px 2px 0 rgb(16 16 18 / 0.03)",
        drawer: "-8px 0 24px -12px rgb(0 0 0 / 0.15)",
      },
    },
  },
  plugins: [],
}
