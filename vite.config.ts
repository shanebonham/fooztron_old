import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const API = `http://localhost:${process.env.FOOZTRON_PORT ?? 4010}`;

export default defineConfig({
  plugins: [react()],
  root: '.',
  build: {
    outDir: 'dist',
    chunkSizeWarningLimit: 2500,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three', '@react-three/fiber', '@react-three/drei', '@react-three/postprocessing', 'postprocessing'],
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': API,
      '/metrics': API,
      '/ws': { target: API.replace('http', 'ws'), ws: true },
    },
  },
  test: {
    include: ['tests/**/*.test.ts'],
  },
} as any);
