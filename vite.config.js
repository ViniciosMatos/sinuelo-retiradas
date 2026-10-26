import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/',
  server: {
    allowedHosts: [
      'tux-dealt-old.ngrok-free.dev',
    ],
    host: true, // Permite acesso externo via ngrok
    port: 5173, // ou a porta que você usa
    strictPort: false,
    watch: {
      usePolling: true,
    },
  },
})
