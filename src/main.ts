import { createApp } from 'vue'
import { createPinia } from 'pinia'
import i18n from './locales'
import './style.css'
import App from './App.vue'
import { useTheme } from './composables/useTheme'

const pinia = createPinia()
const app = createApp(App)

// Initialize theme
useTheme()

app.use(pinia)
app.use(i18n)
app.mount('#app')

