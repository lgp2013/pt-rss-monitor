<template>
<div class="settings">
<h1>设置</h1>
<div class="settings-card">
<h2>抓取设置</h2>
<form @submit.prevent="saveSettings">
<div class="form-group">
<label for="globalFetchInterval">抓取间隔（分钟）</label>
<input type="number" id="globalFetchInterval" v-model.number="settings.globalFetchInterval" min="1" max="1440" />
</div>
<div class="form-group">
<label for="autoFetchEnabled">自动抓取</label>
<select id="autoFetchEnabled" v-model="settings.autoFetchEnabled">
<option :value="true">启用</option>
<option :value="false">禁用</option>
</select>
</div>
<div class="form-group">
<label for="resourcesRetentionDays">资源保留天数</label>
<input type="number" id="resourcesRetentionDays" v-model.number="settings.resourcesRetentionDays" min="1" max="365" />
</div>
<div class="form-actions">
<button type="submit" class="save-button">保存设置</button>
</div>
</form>
</div>
<div class="settings-card">
<h2>显示设置</h2>
<div class="form-group">
<label for="theme">主题</label>
<select id="theme" v-model="settings.theme">
<option value="system">跟随系统</option>
<option value="light">浅色</option>
<option value="dark">深色</option>
</select>
</div>
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
globalFetchInterval: 30,
autoFetchEnabled: true,
resourcesRetentionDays: 30,
theme: 'system'
});

onMounted(async () => {
await loadSettings();
});

async function loadSettings() {
try {
const loadedSettings = await getSettings();
settings.value = {
globalFetchInterval: parseInt(loadedSettings.global_fetch_interval) || 30,
autoFetchEnabled: loadedSettings.auto_fetch_enabled === 'true',
resourcesRetentionDays: parseInt(loadedSettings.resources_retention_days) || 30,
theme: loadedSettings.theme || 'system'
};
} catch (error) {
console.error('加载设置失败:', error);
}
}

async function saveSettings() {
try {
await updateSettings({
global_fetch_interval: settings.value.globalFetchInterval.toString(),
auto_fetch_enabled: settings.value.autoFetchEnabled.toString(),
resources_retention_days: settings.value.resourcesRetentionDays.toString(),
theme: settings.value.theme
});
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

.form-group input,
.form-group select {
width: 100%;
padding: 10px;
border: 1px solid var(--border);
border-radius: 4px;
background: var(--bg-primary);
color: var(--text-primary);
font-size: 1rem;
}

.form-group input:focus,
.form-group select:focus {
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
