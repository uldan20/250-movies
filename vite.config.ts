import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// base is relative so the built site works from any sub-path (GitHub Pages included).
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
})
