import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initTelegramApp } from './telegram/init.ts'
import { takeChatIdFromLocation } from './telegram/deepLink.ts'

initTelegramApp()
const initialChatId = takeChatIdFromLocation()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App initialChatId={initialChatId} />
  </StrictMode>,
)