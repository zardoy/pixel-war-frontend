/// <reference types="@zardoy/vit/twin-sc" />
/// <reference types="vite/client" />
import { renderToDom } from '@zardoy/react-util'
import 'tailwindcss/tailwind.css'
import App from './App'
import App2 from './App2'
import { NextUIProvider } from '@nextui-org/react'
import { createModal, config } from './wagmi'
import { WagmiConfig } from 'wagmi'
import GlobalToast, { globalToast } from './GlobalToast'

createModal()

window.addEventListener('error', e => {
    console.error(e)
    globalToast.value = e.message
    globalToast.open = true
})

window.addEventListener('unhandledrejection', e => {
    const err = e.reason
    let message = err.message
    globalToast.value = message
    globalToast.open = true
})

renderToDom(
    <WagmiConfig config={config}>
        <NextUIProvider>
            <GlobalToast />
            <App2 />
        </NextUIProvider>
    </WagmiConfig>,
    {
        strictMode: false,
    },
)
