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

const applyStoredBrandVars = () => {
	const stored = localStorage.getItem('print-designer-brand-vars')
	if (!stored) return
	try {
		const vars = JSON.parse(stored) as Record<string, string>
		if (!vars || typeof vars !== 'object') return
		const root = document.documentElement
		Object.entries(vars).forEach(([key, value]) => {
			root.style.setProperty(key, value)
		})
	} catch {
		// Ignore invalid storage
	}
}

applyStoredBrandVars()

app.use(pinia)
app.use(i18n)
app.mount('#app')

