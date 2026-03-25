<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { authApi, setAuthSession } from '../api';

const router = useRouter();
const username = ref('admin');
const password = ref('admin@123');
const loading = ref(false);
const errorMessage = ref('');

async function handleLogin() {
  loading.value = true;
  errorMessage.value = '';
  try {
    const result = await authApi.login(username.value.trim(), password.value);
    setAuthSession(result.token, result.user);
    await router.push('/');
  } catch (error) {
    errorMessage.value = (error as Error).message || '登录失败';
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <div class="login-page">
    <div class="login-backdrop"></div>
    <div class="login-overlay"></div>

    <section class="login-hero">
      <div class="hero-copy">
        <span class="hero-eyebrow">PT RSS Monitor</span>
        <h1 class="hero-title">统一管理 RSS、站点和资源列表</h1>
        <p class="hero-description">
          登录后进入资源聚合、站点设置、用户数据和系统管理。
        </p>
      </div>
    </section>

    <section class="login-panel">
      <div class="login-card">
        <div class="login-card-header">
          <h2 class="login-title">系统登录</h2>
        </div>

        <div class="form-group">
          <label class="form-label">用户名</label>
          <input v-model="username" type="text" class="input" autocomplete="username" />
        </div>

        <div class="form-group">
          <label class="form-label">密码</label>
          <input
            v-model="password"
            type="password"
            class="input"
            autocomplete="current-password"
            @keyup.enter="handleLogin"
          />
        </div>

        <p v-if="errorMessage" class="error-message">{{ errorMessage }}</p>

        <button class="login-btn" :disabled="loading" @click="handleLogin">
          {{ loading ? '登录中...' : '进入系统' }}
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.login-page {
  position: relative;
  min-height: 100vh;
  margin: calc(var(--spacing-lg) * -1);
  display: grid;
  grid-template-columns: minmax(320px, 1.1fr) minmax(360px, 460px);
  overflow: hidden;
  background: #07080b;
}

.login-backdrop {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(90deg, rgba(5, 8, 12, 0.86) 0%, rgba(5, 8, 12, 0.66) 42%, rgba(5, 8, 12, 0.9) 100%),
    url('/login-bg.jpg');
  background-size: cover;
  background-position: center;
  filter: saturate(1.05);
  transform: scale(1.02);
}

.login-overlay {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 20% 20%, rgba(220, 38, 38, 0.22), transparent 32%),
    radial-gradient(circle at 80% 65%, rgba(245, 158, 11, 0.16), transparent 30%);
  pointer-events: none;
}

.login-hero,
.login-panel {
  position: relative;
  z-index: 1;
}

.login-hero {
  display: flex;
  align-items: center;
  padding: 56px 56px 56px 72px;
}

.hero-copy {
  max-width: 560px;
}

.hero-eyebrow {
  display: inline-flex;
  margin-bottom: 16px;
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.82);
  font-size: 12px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.hero-title {
  margin: 0;
  color: #fff;
  font-size: clamp(36px, 4vw, 58px);
  line-height: 1.06;
  letter-spacing: -0.03em;
}

.hero-description {
  margin: 20px 0 0;
  max-width: 460px;
  color: rgba(255, 255, 255, 0.76);
  font-size: 17px;
  line-height: 1.7;
}

.login-panel {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
}

.login-card {
  width: 100%;
  padding: 28px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 24px;
  background: rgba(10, 11, 15, 0.74);
  backdrop-filter: blur(18px);
  box-shadow: 0 28px 70px rgba(0, 0, 0, 0.4);
}

.login-card-header {
  margin-bottom: 24px;
}

.login-title {
  margin: 0;
  color: #fff;
  font-size: 28px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}

.form-label {
  color: rgba(255, 255, 255, 0.88);
  font-size: 14px;
}

.input {
  width: 100%;
  padding: 14px 16px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.06);
  color: #fff;
  font-size: 15px;
  transition: border-color 0.2s ease, background 0.2s ease, box-shadow 0.2s ease;
}

.input::placeholder {
  color: rgba(255, 255, 255, 0.38);
}

.input:focus {
  outline: none;
  border-color: rgba(239, 68, 68, 0.68);
  background: rgba(255, 255, 255, 0.08);
  box-shadow: 0 0 0 4px rgba(239, 68, 68, 0.12);
}

.error-message {
  margin: 0 0 16px;
  color: #fca5a5;
  font-size: 14px;
}

.login-btn {
  width: 100%;
  padding: 14px 16px;
  border: none;
  border-radius: 14px;
  background: linear-gradient(135deg, #dc2626, #f97316);
  color: #fff;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease;
  box-shadow: 0 18px 36px rgba(220, 38, 38, 0.26);
}

.login-btn:hover:not(:disabled) {
  transform: translateY(-1px);
}

.login-btn:disabled {
  opacity: 0.72;
  cursor: not-allowed;
}

@media (max-width: 1080px) {
  .login-page {
    grid-template-columns: 1fr;
  }

  .login-hero {
    min-height: 280px;
    padding: 40px 28px 12px;
    align-items: flex-end;
  }

  .login-panel {
    padding: 20px 20px 36px;
  }
}

@media (max-width: 640px) {
  .login-page {
    margin: -16px;
  }

  .login-hero {
    padding: 32px 20px 8px;
  }

  .login-panel {
    padding: 16px 16px 28px;
  }

  .login-card {
    padding: 22px;
    border-radius: 20px;
  }

  .hero-title {
    font-size: 34px;
  }
}
</style>
