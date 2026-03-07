import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// ⚠️ Remplacez "mon-budget" par le nom exact de votre dépôt GitHub
export default defineConfig({
  plugins: [react()],
  base: '/mon-budget/',
})
