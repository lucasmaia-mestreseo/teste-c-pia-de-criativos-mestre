import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: [
      // MODO DEMO (npm run dev:demo): swap the real Supabase client for an
      // in-browser simulation with fictitious data — no login, no AI calls.
      ...(mode === "demo"
        ? [{ find: /^@\/integrations\/supabase\/client$/, replacement: path.resolve(__dirname, "./src/demo/demoClient.ts") }]
        : []),
      { find: "@", replacement: path.resolve(__dirname, "./src") },
    ],
    dedupe: ["react", "react-dom", "react/jsx-runtime"],
  },
  optimizeDeps: {
    include: ["react", "react-dom", "@tanstack/react-query"],
  },
}));
