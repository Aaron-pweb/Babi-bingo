import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@babi-bingo/shared': path.resolve(__dirname, '../../packages/shared/src'),
    },
  },
  server: {
    proxy: { 
      '/api': {
        target: 'https://babi-bingo.onrender.com',
        changeOrigin: true,
        secure: false, 
      },
    },
  }.
});

