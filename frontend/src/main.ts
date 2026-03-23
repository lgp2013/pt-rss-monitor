<<<<<<< HEAD
import { createApp } from 'vue';
import { createRouter, createWebHistory } from 'vue-router';
import App from './App.vue';
import './styles/theme.css';

import Dashboard from './views/Dashboard.vue';
import Sources from './views/Sources.vue';
import Settings from './views/Settings.vue';

// Theme initialization
function initTheme() {
  const savedTheme = localStorage.getItem('theme');
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

  if (savedTheme === 'dark' || (savedTheme === 'system' && prefersDark) || (!savedTheme && prefersDark)) {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
}

initTheme();

// Listen for system theme changes
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'system' || !savedTheme) {
    initTheme();
  }
});

// Router
const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'dashboard', component: Dashboard },
    { path: '/sources', name: 'sources', component: Sources },
    { path: '/settings', name: 'settings', component: Settings },
  ],
});

const app = createApp(App);
app.use(router);
app.mount('#app');
=======
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
>>>>>>> b3b2b8ce71669aa78e478944f8439346c72c5bd9
