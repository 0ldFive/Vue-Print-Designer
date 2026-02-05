import { createApp } from 'vue'
import { createPinia } from 'pinia'
import i18n from './locales'
import './style.css'
import App from './App.vue'

const pinia = createPinia()
const app = createApp(App)

const applyTheme = (theme: string) => {
  const root = document.documentElement
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  const isDark = theme === 'dark' ? true : theme === 'light' ? false : mq.matches
  root.classList.toggle('dark', isDark)
}

const initTheme = () => {
  const theme = localStorage.getItem('print-designer-theme') || 'system'
  applyTheme(theme)
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  const handleChange = () => {
    const t = localStorage.getItem('print-designer-theme') || 'system'
    if (t === 'system') applyTheme('system')
  }
  mq.addEventListener?.('change', handleChange)
}

app.use(pinia)
app.use(i18n)
app.mount('#app')

initTheme()
