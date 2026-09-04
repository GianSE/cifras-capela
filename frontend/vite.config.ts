import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Minha Biblioteca de Cifras',
        short_name: 'Cifras',
        description:
          'Biblioteca pessoal de cifras musicais: rápida, offline, com transposição perfeita.',
        lang: 'pt-BR',
        theme_color: '#030d1a',
        background_color: '#fbf9f4',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        categories: ['music', 'productivity'],
        // JPEG, não PNG: a arte é fotográfica e em PNG o ícone de 512 pesava
        // 408 KB contra 54 KB aqui. Como o fundo é branco e não há
        // transparência a preservar, não se perde nada.
        icons: [
          { src: '/icons/icon-192.jpg', sizes: '192x192', type: 'image/jpeg', purpose: 'any' },
          { src: '/icons/icon-512.jpg', sizes: '512x512', type: 'image/jpeg', purpose: 'any' },
          {
            src: '/icons/maskable-512.jpg',
            sizes: '512x512',
            type: 'image/jpeg',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Pré-cacheia o app + todas as músicas (offline total).
        globPatterns: ['**/*.{js,css,html,svg,png,jpg,woff,woff2,ttf,json,cho}'],
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            // Músicas adicionadas depois do build.
            urlPattern: ({ url }) => url.pathname.startsWith('/songs/'),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'songs',
              expiration: { maxEntries: 1000, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: { maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Isola o núcleo do React num chunk próprio (cacheável entre deploys).
        manualChunks(id) {
          if (/node_modules[\\/](react|react-dom|react-router|scheduler)[\\/]/.test(id)) {
            return 'react';
          }
          return undefined;
        },
      },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    include: [
      'tests/**/*.test.ts',
      'tests/**/*.test.tsx',
      'src/**/*.test.ts',
      'src/**/*.test.tsx',
    ],
  },
});
