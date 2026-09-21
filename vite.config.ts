import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [
        react(),
        VitePWA({
          registerType: 'autoUpdate',
          manifest: {
            name: 'TaxFlow GST Compliance',
            short_name: 'TaxFlow',
            description: 'Intelligent GST Compliance & Analytics Platform',
            theme_color: '#0f172a',
          },
          workbox: {
            maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
            globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
            runtimeCaching: [
              {
                urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
                handler: 'NetworkFirst',
                options: {
                  cacheName: 'api-cache',
                  expiration: {
                    maxEntries: 100,
                    maxAgeSeconds: 60 * 60 * 24 // 24 hours
                  },
                  cacheableResponse: {
                    statuses: [0, 200]
                  }
                }
              }
            ]
          }
        })
      ],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        rollupOptions: {
          output: {
            manualChunks(id) {
              if (id.includes('node_modules')) {
                if (id.includes('lucide-react')) return 'vendor-icons';
                if (id.includes('recharts') || id.includes('d3')) return 'vendor-charts';
                if (id.includes('jspdf') || id.includes('html2canvas') || id.includes('xlsx')) return 'vendor-exports';
              }
            },
          },
        },
        chunkSizeWarningLimit: 600
      }
    };
});
