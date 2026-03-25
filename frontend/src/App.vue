<script setup lang="ts">
import { RouterLink, RouterView, useRoute, useRouter } from 'vue-router';
import { computed, ref, watch } from 'vue';
import ThemeToggle from './components/ThemeToggle.vue';
import { authApi, clearAuthSession, getStoredAuthUser } from './api';

const route = useRoute();
const router = useRouter();
const currentUser = ref(getStoredAuthUser());

const navItems = [
  { path: '/', label: '资源列表' },
  { path: '/my-data', label: '我的数据' },
  { path: '/sources', label: 'RSS 源' },
  { path: '/site-settings', label: '站点设置' },
  { path: '/settings', label: '系统设置' },
];

const isLoginPage = computed(() => route.path === '/login');

watch(
  () => route.fullPath,
  () => {
    currentUser.value = getStoredAuthUser();
  },
  { immediate: true },
);

async function handleLogout() {
  try {
    await authApi.logout();
  } catch {
    // Ignore logout request failures and clear the local session anyway.
  }
  clearAuthSession();
  currentUser.value = null;
  await router.push('/login');
}
</script>

<template>
  <div class="app">
    <header v-if="!isLoginPage" class="header">
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
            <span v-if="currentUser" class="current-user">{{ currentUser.username }}</span>
            <ThemeToggle />
            <button class="logout-btn" type="button" @click="handleLogout">退出登录</button>
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
  backdrop-filter: blur(10px);
}

.main {
  flex: 1;
  padding: var(--spacing-lg) 0;
}

.current-user {
  font-size: 14px;
  color: var(--color-text-secondary);
}

.logout-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 38px;
  padding: 0 14px;
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color var(--transition-fast), border-color var(--transition-fast), color var(--transition-fast);
}

.logout-btn:hover {
  background: var(--color-bg-tertiary);
  border-color: var(--color-text-muted);
}
</style>
