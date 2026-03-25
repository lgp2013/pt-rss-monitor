import { createApp } from 'vue';
import { createRouter, createWebHistory } from 'vue-router';
import App from './App.vue';
import './styles/theme.css';
import { authApi, clearAuthSession, getStoredAuthUser, setAuthSession } from './api';

import Dashboard from './views/Dashboard.vue';
import Statistics from './views/Statistics.vue';
import Sources from './views/Sources.vue';
import Sites from './views/Sites.vue';
import Settings from './views/Settings.vue';
import Login from './views/Login.vue';

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
    { path: '/login', name: 'login', component: Login, meta: { public: true } },
    { path: '/', name: 'dashboard', component: Dashboard },
    { path: '/my-data', name: 'my-data', component: Statistics },
    { path: '/sources', name: 'sources', component: Sources },
    { path: '/site-settings', name: 'site-settings', component: Sites },
    { path: '/settings', name: 'settings', component: Settings },
  ],
});

router.beforeEach(async (to) => {
  const isPublic = Boolean(to.meta.public);
  const storedUser = getStoredAuthUser();

  if (isPublic) {
    if (storedUser && to.path === '/login') {
      return '/';
    }
    return true;
  }

  if (!storedUser) {
    return '/login';
  }

  try {
    const user = await authApi.me();
    const token = localStorage.getItem('auth_token');
    if (token) {
      setAuthSession(token, user);
    }
    return true;
  } catch {
    clearAuthSession();
    return '/login';
  }
});

const app = createApp(App);
app.use(router);
app.mount('#app');
