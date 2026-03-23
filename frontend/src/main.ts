import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import App from './App.vue'
import Dashboard from './views/Dashboard.vue'
import Sources from './views/Sources.vue'
import Settings from './views/Settings.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', component: Dashboard },
    { path: '/sources', component: Sources },
    { path: '/settings', component: Settings }
  ]
})

const app = createApp(App)
app.use(router)
app.mount('#app')