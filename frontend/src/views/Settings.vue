<template>
<div class="settings">
<h1>设置</h1>
<div class="settings-card">
<h2>全局设置</h2>
<form @submit.prevent="saveSettings">
<div class="form-group">
<label for="refreshInterval">刷新间隔（分钟）</label>
<input type="number" id="refreshInterval" v-model.number="settings.refreshInterval" min="1" max="1440" />
</div>
<div class="form-group">
<label for="maxItems">最大资源数量</label>
<input type="number" id="maxItems" v-model.number="settings.maxItems" min="10" max="1000" />
</div>
<div class="form-actions">
<button type="submit" class="save-button">保存设置</button>
</div>
</form>
</div>
<div class="settings-card">
<h2>关于</h2>
<div class="about-info">
<p><strong>版本：</strong>1.0.0</p>
<p><strong>描述：</strong>PT RSS Monitor 是一个用于监控 PT 站点 RSS 资源的工具</p>
<p><strong>作者：</strong>lgp2013</p>
</div>
</div>
</div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { getSettings, updateSettings } from '../api';

const settings = ref({
refreshInterval: 30,
maxItems: 500
});

onMounted(async () => {
await loadSettings();
});

async function loadSettings() {
try {
const loadedSettings = await getSettings();
settings.value = loadedSettings;
} catch (error) {
console.error('加载设置失败:', error);
}
}

async function saveSettings() {
try {
await updateSettings(settings.value);
alert('设置保存成功');
} catch (error) {
console.error('保存设置失败:', error);
alert('保存设置失败');
}
}
</script>

<style scoped>
.settings {
padding: 20px;
max-width: 800px;
margin: 0 auto;
}

h1 {
font-size: 2rem;
margin-bottom: 30px;
color: var(--text-primary);
}

.settings-card {
background: var(--bg-secondary);
padding: 20px;
border-radius: 8px;
box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
margin-bottom: 30px;
}

.settings-card h2 {
font-size: 1.5rem;
margin-bottom: 20px;
color: var(--text-primary);
border-bottom: 1px solid var(--border);
padding-bottom: 10px;
}

.form-group {
margin-bottom: 20px;
}

.form-group label {
display: block;
margin-bottom: 8px;
color: var(--text-secondary);
font-weight: 500;
}

.form-group input {
width: 100%;
padding: 10px;
border: 1px solid var(--border);
border-radius: 4px;
background: var(--bg-primary);
color: var(--text-primary);
font-size: 1rem;
}

.form-group input:focus {
outline: none;
border-color: var(--primary);
box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
}

.form-actions {
margin-top: 30px;
}

.save-button {
background: var(--primary);
color: white;
border: none;
padding: 10px 20px;
border-radius: 4px;
cursor: pointer;
font-size: 1rem;
transition: background-color 0.2s;
}

.save-button:hover {
background: var(--primary-hover);
}

.about-info p {
margin-bottom: 10px;
color: var(--text-primary);
}

.about-info strong {
color: var(--text-secondary);
}

@media (max-width: 768px) {
.settings {
padding: 10px;
}
}
</style>