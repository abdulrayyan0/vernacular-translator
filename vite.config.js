import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Lingoduct Vernacular Pedagogy Assistant',
        short_name: 'Lingoduct',
        description:
          'Classroom translation and speech assistant for vernacular education',
        theme_color: '#0284c7',
        background_color: '#ffffff',
        display: 'standalone',
      },
      workbox: {
        runtimeCaching: [
          {
            urlPattern: /\.(?:js|css|html|svg|png)$/,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'static-assets',
            },
          },
        ],
      },
    }),
  ],
})
