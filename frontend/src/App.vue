<<<<<<< HEAD
<script setup lang="ts">
import { RouterLink, RouterView, useRoute } from 'vue-router';
import { computed } from 'vue';
import ThemeToggle from './components/ThemeToggle.vue';

const route = useRoute();

const navItems = [
  { path: '/', name: 'Dashboard', label: '资源列表' },
  { path: '/sources', name: 'Sources', label: 'RSS 源' },
  { path: '/settings', name: 'Settings', label: '设置' },
];
</script>

<template>
  <div class="app">
    <header class="header">
      <div class="container">
        <nav class="nav">
          <RouterLink to="/" class="nav-brand">PT RSS Monitor</RouterLink>
          <div class="nav-links">
            <RouterLink
              v-for="item in navItems"
              :key="item.path"
              :to="item.path"
              class="nav-link"
              :class="{ active: route.path === item.path }"
            >
              {{ item.label }}
            </RouterLink>
          </div>
          <div class="nav-right">
            <ThemeToggle />
          </div>
        </nav>
      </div>
    </header>
    <main class="main">
      <div class="container">
        <RouterView />
      </div>
    </main>
  </div>
</template>

<style scoped>
=======
<template>
  <div class="app" :class="{ 'dark': isDarkTheme }">
    <header class="header">
      <h1>PT RSS Monitor</h1>
      <div class="header-actions">
        <ThemeToggle />
      </div>
    </header>
    <nav class="nav">
      <router-link to="/" class="nav-link">资源列表</router-link>
      <router-link to="/sources" class="nav-link">RSS 源</router-link>
      <router-link to="/settings" class="nav-link">设置</router-link>
    </nav>
    <main class="main">
      <router-view />
    </main>
    <footer class="footer">
      <p>PT RSS Monitor © 2024</p>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import ThemeToggle from './components/ThemeToggle.vue'

const isDarkTheme = ref(false)

onMounted(() => {
  // 从 localStorage 加载主题
  const savedTheme = localStorage.getItem('theme')
  if (savedTheme) {
    if (savedTheme === 'dark') {
      isDarkTheme.value = true
      document.documentElement.classList.add('dark')
    } else if (savedTheme === 'light') {
      isDarkTheme.value = false
      document.documentElement.classList.remove('dark')
    } else {
      // 跟随系统
      isDarkTheme.value = window.matchMedia('(prefers-color-scheme: dark)').matches
      if (isDarkTheme.value) {
        document.documentElement.classList.add('dark')
      }
    }
  }
})
</script>

<style>
@import './styles/theme.css';

>>>>>>> b3b2b8ce71669aa78e478944f8439346c72c5bd9
.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
<<<<<<< HEAD
}

.header {
  background-color: var(--color-bg-secondary);
  border-bottom: 1px solid var(--color-border);
  position: sticky;
  top: 0;
  z-index: 100;
=======
  background-color: var(--bg-primary);
  color: var(--text-primary);
  transition: background-color 0.3s, color 0.3s;
}

.header {
  background-color: var(--bg-secondary);
  padding: 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.header h1 {
  margin: 0;
  font-size: 1.5rem;
  color: var(--text-primary);
}

.header-actions {
  display: flex;
  gap: 1rem;
}

.nav {
  background-color: var(--bg-secondary);
  padding: 0 1rem;
  border-bottom: 1px solid var(--border);
  display: flex;
  gap: 1rem;
}

.nav-link {
  padding: 0.75rem 1rem;
  color: var(--text-secondary);
  text-decoration: none;
  transition: color 0.2s;
}

.nav-link:hover {
  color: var(--text-primary);
}

.nav-link.router-link-active {
  color: var(--primary);
  font-weight: 500;
  border-bottom: 2px solid var(--primary);
>>>>>>> b3b2b8ce71669aa78e478944f8439346c72c5bd9
}

.main {
  flex: 1;
<<<<<<< HEAD
  padding: var(--spacing-lg) 0;
}
</style>
=======
  padding: 1rem;
}

.footer {
  background-color: var(--bg-secondary);
  padding: 1rem;
  text-align: center;
  color: var(--text-secondary);
  border-top: 1px solid var(--border);
}

@media (max-width: 768px) {
  .header {
    flex-direction: column;
    gap: 1rem;
    text-align: center;
  }

  .nav {
    overflow-x: auto;
    white-space: nowrap;
  }
}
</style>
>>>>>>> b3b2b8ce71669aa78e478944f8439346c72c5bd9
