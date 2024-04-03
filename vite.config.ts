import { defineVitConfig } from '@zardoy/vit'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
    base: './',
    plugins: [
        react({
            babel: {
                configFile: false,
            },
        }),
    ],
})
