import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
export default defineConfig({
    plugins: [
        react(),
        VitePWA({
            registerType: 'prompt', // Show "Update available" / Reload; user chooses when to reload
            includeAssets: ['favicon.ico', 'apple-touch-icon.png', '*.svg'],
            manifest: {
                name: 'Perry Park Ward',
                short_name: 'Ward',
                description: 'Scheduling & communication for the Executive Secretary',
                theme_color: '#1a365d',
                background_color: '#ffffff',
                display: 'standalone',
                start_url: '/',
                icons: [
                    { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
                ],
            },
            workbox: {
                globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
                navigateFallback: '/index.html',
                runtimeCaching: [
                    { urlPattern: /^https:\/\/.*\.(?:png|jpg|jpeg|svg|gif|webp)$/, handler: 'CacheFirst', options: { cacheName: 'images' } },
                ],
            },
            devOptions: { enabled: true, suppressWarnings: true },
        }),
    ],
    resolve: { alias: { '@': path.resolve(__dirname, './src') } },
});
