import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
const base = process.env.NODE_ENV === 'development' ? '/' : '/family-recipes/';

export default defineConfig({
  base,
  plugins: [react()],
})
