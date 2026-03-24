<script setup lang="ts">
import { RouterLink, RouterView, useRoute } from 'vue-router';
import { computed } from 'vue';
import ThemeToggle from './components/ThemeToggle.vue';

const route = useRoute();

const navItems = [
  { path: '/', name: 'Dashboard', label: '资源列表' },
  { path: '/sources', name: 'Sources', label: 'RSS 源' },
  { path: '/search', name: 'Search', label: '搜索' },
  { path: '/sites', name: 'Sites', label: '站点设置' },
  { path: '/mydata', name: 'MyData', label: '我的数据' },
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
.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.header {
  background-color: var(--color-bg-secondary);
  border-bottom: 1px solid var(--color-border);
  position: sticky;
  top: 0;
  z-index: 100;
}

.main {
  flex: 1;
  padding: var(--spacing-lg) 0;
}
</style>
