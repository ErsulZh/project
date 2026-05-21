import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

// GitHub Pages project site: https://<user>.github.io/<repo>/
const pagesBase = process.env.VITE_BASE_PATH ?? "/";

export default defineConfig({
  base: pagesBase,
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:5000",
        changeOrigin: true
      }
    }
  }
});

