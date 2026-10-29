import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  // Relative asset paths so the static build works on GitHub Pages or any sub-path.
  base: "./",
  plugins: [react(), tailwindcss()],
  server: { port: 5174 },
  preview: { port: 5174 },
});
