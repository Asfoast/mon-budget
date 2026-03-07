import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "/mon-budget/",
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon-192.png", "icon-512.png"],
      manifest: {
        name: "Prism Finance",
        short_name: "Finance",
        description: "Suivi de budget personnel",
        start_url: "/mon-budget/",
        scope: "/mon-budget/",
        display: "standalone",
        orientation: "portrait",
        background_color: "#0A2342",
        theme_color: "#0A2342",
        icons: [
          {
            src: "/mon-budget/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any"
          },
          {
            src: "/mon-budget/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "maskable"
          },
          {
            src: "/mon-budget/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any"
          },
          {
            src: "/mon-budget/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable"
          }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,ico}"],
        navigateFallback: "/mon-budget/index.html",
        navigateFallbackDenylist: [/^\/api/]
      }
    })
  ]
});
