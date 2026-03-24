<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { settingsApi, resourcesApi, sourcesApi, keywordRulesApi } from '../api';
import ThemeToggle from '../components/ThemeToggle.vue';

const settings = ref({
  global_fetch_interval: '30',
  auto_fetch_enabled: 'true',
  theme: 'system',
  resources_retention_days: '30',
});
const stats = ref({
  total_sources: 0,
  total_resources: 0,
  sources_by_category: {} as Record<string, number>,
  resources_today: 0,
});
const loading = ref(false);
const saving = ref(false);

// Category management
const categories = ref<string[]>([]);
const newCategory = ref('');
const sources = ref<any[]>([]);

// Keyword Rules
const keywordRules = ref<any[]>([]);
const showRuleDialog = ref(false);
const editingRule = ref<any>(null);
const ruleForm = ref({
  name: '',
  keywords: '',
  exclude: '',
  source_ids: [] as number[],
  enabled: true,
});

async function loadSettings() {
  loading.value = true;
  try {
    const [settingsData, statsData, categoriesData, sourcesData, rulesData] = await Promise.all([
      settingsApi.get(),
      settingsApi.getStats(),
      settingsApi.getCategories(),
      sourcesApi.list(),
      keywordRulesApi.list(),
    ]);
    settings.value = { ...settings.value, ...settingsData };
    stats.value = statsData;
    categories.value = categoriesData.categories || [];
    sources.value = sourcesData;
    keywordRules.value = rulesData;
  } catch (error) {
    console.error('Failed to load settings:', error);
  } finally {
    loading.value = false;
  }
}

async function saveSettings() {
  saving.value = true;
  try {
    await settingsApi.update(settings.value);
    alert('设置已保存');
  } catch (error) {
    console.error('Failed to save settings:', error);
    alert('保存失败');
  } finally {
    saving.value = false;
  }
}

async function cleanOldResources() {
  const days = parseInt(settings.value.resources_retention_days, 10);
  if (!confirm(`确定清理 ${days} 天前的资源？`)) return;

  try {
    const result = await resourcesApi.clean(days);
    alert(`已清理 ${result.deleted} 条旧资源`);
    loadSettings();
  } catch (error) {
    console.error('Failed to clean resources:', error);
    alert('清理失败');
  }
}

async function cleanAllResources() {
  if (!confirm('确定清理所有资源？此操作不可恢复！')) return;
  if (!confirm('再次确认：删除所有资源？')) return;

  try {
    await resourcesApi.clean(0);
    alert('已清理所有资源');
    loadSettings();
  } catch (error) {
    console.error('Failed to clean all resources:', error);
    alert('清理失败');
  }
}

async function addCategory() {
  const cat = newCategory.value.trim();
  if (!cat) return;
  if (categories.value.includes(cat)) {
    alert('分类已存在');
    return;
  }
  categories.value.push(cat);
  newCategory.value = '';
}

async function deleteCategory(category: string) {
  if (!confirm(`确定删除分类 "${category}"？`)) return;
  
  categories.value = categories.value.filter(c => c !== category);
}

async function updateSourceCategory(sourceId: number, newCategory: string) {
  try {
    await sourcesApi.update(sourceId, { category: newCategory });
    await loadSettings();
  } catch (error) {
    console.error('Failed to update source category:', error);
  }
}

// Keyword Rules
function openAddRule() {
  editingRule.value = null;
  ruleForm.value = { name: '', keywords: '', exclude: '', source_ids: [], enabled: true };
  showRuleDialog.value = true;
}

function openEditRule(rule: any) {
  editingRule.value = rule;
  ruleForm.value = {
    name: rule.name,
    keywords: rule.keywords.join(', '),
    exclude: rule.exclude.join(', '),
    source_ids: rule.source_ids,
    enabled: rule.enabled,
  };
  showRuleDialog.value = true;
}

async function saveRule() {
  const { name, keywords, exclude, source_ids, enabled } = ruleForm.value;
  if (!name.trim() || !keywords.trim()) {
    alert('名称和关键词不能为空');
    return;
  }
  const keywordList = keywords.split(',').map(k => k.trim()).filter(Boolean);
  const excludeList = exclude.split(',').map(k => k.trim()).filter(Boolean);

  try {
    if (editingRule.value) {
      await keywordRulesApi.update(editingRule.value.id, { name, keywords: keywordList, exclude: excludeList, source_ids, enabled });
    } else {
      await keywordRulesApi.create({ name, keywords: keywordList, exclude: excludeList, source_ids, enabled });
    }
    showRuleDialog.value = false;
    await loadSettings();
  } catch (error) {
    console.error('Failed to save rule:', error);
    alert('保存失败');
  }
}

async function toggleRule(rule: any) {
  try {
    await keywordRulesApi.update(rule.id, { enabled: !rule.enabled });
    await loadSettings();
  } catch (error) {
    console.error('Failed to toggle rule:', error);
  }
}

async function deleteRule(id: number) {
  if (!confirm('确定删除这条规则？')) return;
  try {
    await keywordRulesApi.delete(id);
    await loadSettings();
  } catch (error) {
    console.error('Failed to delete rule:', error);
  }
}

onMounted(() => {
  loadSettings();
});
</script>

<template>
  <div class="settings">
    <h1 class="page-title">设置</h1>

    <div v-if="loading" class="loading">
      <div class="spinner"></div>
    </div>

    <template v-else>
      <!-- Stats -->
      <section class="settings-section">
        <h2 class="section-title">统计信息</h2>
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-label">RSS 源</div>
            <div class="stat-value">{{ stats.total_sources }}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">总资源</div>
            <div class="stat-value">{{ stats.total_resources }}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">今日新增</div>
            <div class="stat-value">{{ stats.resources_today }}</div>
          </div>
        </div>

        <div v-if="Object.keys(stats.sources_by_category).length > 0" class="category-stats">
          <h3>按分类统计</h3>
          <div class="category-tags">
            <span
              v-for="(count, category) in stats.sources_by_category"
              :key="category"
              class="tag"
            >
              {{ category }}: {{ count }}
            </span>
          </div>
        </div>
      </section>

      <!-- Category Management -->
      <section class="settings-section">
        <h2 class="section-title">分类管理</h2>
        <p class="section-description">管理 RSS 源的分类，用于筛选资源</p>
        
        <div class="category-list">
          <div v-for="category in categories" :key="category" class="category-item">
            <div class="category-info">
              <span class="category-name">{{ category }}</span>
              <span class="category-count">{{ stats.sources_by_category[category] || 0 }} 个源</span>
            </div>
            <button class="btn btn-small btn-danger" @click="deleteCategory(category)">删除</button>
          </div>
          <div v-if="categories.length === 0" class="empty-message">
            暂无分类，添加新分类后可在 RSS 源配置中选择
          </div>
        </div>

        <div class="add-category-form">
          <input
            v-model="newCategory"
            type="text"
            class="input"
            placeholder="输入新分类名称..."
            @keyup.enter="addCategory"
          />
          <button class="btn btn-primary" @click="addCategory">添加</button>
        </div>
      </section>

      <!-- Source Categories -->
      <section class="settings-section">
        <h2 class="section-title">RSS 源分类</h2>
        <p class="section-description">为 RSS 源分配分类</p>
        
        <div class="source-category-list">
          <div v-for="source in sources" :key="source.id" class="source-category-item">
            <div class="source-name">{{ source.name }}</div>
            <select
              :value="source.category"
              class="select"
              @change="updateSourceCategory(source.id, ($event.target as HTMLSelectElement).value)"
            >
              <option value="">未分类</option>
              <option v-for="cat in categories" :key="cat" :value="cat">
                {{ cat }}
              </option>
            </select>
          </div>
          <div v-if="sources.length === 0" class="empty-message">
            暂无 RSS 源
          </div>
        </div>
      </section>

      <!-- Theme -->
      <section class="settings-section">
        <h2 class="section-title">外观</h2>
        <div class="setting-row">
          <div class="setting-info">
            <div class="setting-label">主题</div>
            <div class="setting-description">选择应用的主题外观</div>
          </div>
          <ThemeToggle />
        </div>
      </section>

      <!-- Fetch Settings -->
      <section class="settings-section">
        <h2 class="section-title">抓取设置</h2>

        <div class="setting-row">
          <div class="setting-info">
            <div class="setting-label">全局抓取间隔</div>
            <div class="setting-description">定时抓取 RSS 源的时间间隔（分钟）</div>
          </div>
          <div class="setting-control">
            <input
              v-model="settings.global_fetch_interval"
              type="number"
              class="input"
              min="1"
              max="1440"
              style="width: 100px"
            />
            <span class="unit">分钟</span>
          </div>
        </div>

        <div class="setting-row">
          <div class="setting-info">
            <div class="setting-label">自动抓取</div>
            <div class="setting-description">开启后自动按间隔抓取 RSS 源</div>
          </div>
          <div class="setting-control">
            <label class="toggle">
              <input
                v-model="settings.auto_fetch_enabled"
                type="checkbox"
                true-value="true"
                false-value="false"
              />
              <span class="toggle-slider"></span>
            </label>
          </div>
        </div>
      </section>

      <!-- Keyword Rules -->
      <section class="settings-section">
        <h2 class="section-title">关键词监控</h2>
        <p class="section-description">设置关键词规则，新资源匹配时会在日志中告警。多个关键词用逗号分隔，所有关键词都匹配时触发（AND 逻辑）</p>

        <div class="rules-list">
          <div v-if="keywordRules.length === 0" class="empty-message">
            暂无监控规则，添加后可追踪符合条件的新资源
          </div>

          <div v-for="rule in keywordRules" :key="rule.id" class="rule-item">
            <div class="rule-header">
              <div class="rule-info">
                <label class="toggle toggle-sm">
                  <input type="checkbox" :checked="rule.enabled" @change="toggleRule(rule)" />
                  <span class="toggle-slider"></span>
                </label>
                <span class="rule-name">{{ rule.name }}</span>
                <span v-if="rule.match_count > 0" class="rule-badge">{{ rule.match_count }}次匹配</span>
              </div>
              <div class="rule-actions">
                <button class="btn btn-small" @click="openEditRule(rule)">编辑</button>
                <button class="btn btn-small btn-danger" @click="deleteRule(rule.id)">删除</button>
              </div>
            </div>
            <div class="rule-detail">
              <span class="rule-kw">
                <span class="label-text">匹配</span>
                <code>{{ rule.keywords.join(', ') }}</code>
              </span>
              <span v-if="rule.exclude.length > 0" class="rule-kw">
                <span class="label-text">排除</span>
                <code>{{ rule.exclude.join(', ') }}</code>
              </span>
              <span v-if="rule.source_ids.length > 0" class="rule-kw">
                <span class="label-text">站点</span>
                <span>{{ rule.source_ids.length }} 个站点</span>
              </span>
              <span v-else class="rule-kw">
                <span class="label-text">站点</span>
                <span>全部站点</span>
              </span>
              <span v-if="rule.last_matched_at" class="rule-kw">
                <span class="label-text">最近匹配</span>
                <span>{{ new Date(rule.last_matched_at).toLocaleString('zh-CN') }}</span>
              </span>
            </div>
          </div>
        </div>

        <div class="rule-add-row">
          <button class="btn btn-primary" @click="openAddRule">添加规则</button>
        </div>
      </section>

      <!-- Rule Dialog -->
      <div v-if="showRuleDialog" class="dialog-overlay" @click.self="showRuleDialog = false">
        <div class="dialog">
          <h3 class="dialog-title">{{ editingRule ? '编辑规则' : '添加规则' }}</h3>
          <div class="form-group">
            <label class="form-label">规则名称</label>
            <input v-model="ruleForm.name" type="text" class="input" placeholder="例如：4K蓝光免费电影" />
          </div>
          <div class="form-group">
            <label class="form-label">匹配关键词 <span class="hint">（多个用逗号分隔，全部匹配才触发）</span></label>
            <input v-model="ruleForm.keywords" type="text" class="input" placeholder="例如：4K, 蓝光, 免费" />
          </div>
          <div class="form-group">
            <label class="form-label">排除关键词 <span class="hint">（包含这些词则跳过）</span></label>
            <input v-model="ruleForm.exclude" type="text" class="input" placeholder="例如：韩剧, 日韩" />
          </div>
          <div class="form-group">
            <label class="form-label">应用站点 <span class="hint">（不选则应用于全部站点）</span></label>
            <div class="source-checkboxes">
              <label v-for="source in sources" :key="source.id" class="source-check">
                <input type="checkbox" :value="source.id" v-model="ruleForm.source_ids" />
                {{ source.name }}
              </label>
            </div>
          </div>
          <div class="dialog-footer">
            <button class="btn" @click="showRuleDialog = false">取消</button>
            <button class="btn btn-primary" @click="saveRule">保存</button>
          </div>
        </div>
      </div>

      <!-- Data Management -->
      <section class="settings-section">
        <h2 class="section-title">数据管理</h2>

        <div class="setting-row">
          <div class="setting-info">
            <div class="setting-label">资源保留天数</div>
            <div class="setting-description">超过此天数的资源将被自动清理</div>
          </div>
          <div class="setting-control">
            <input
              v-model="settings.resources_retention_days"
              type="number"
              class="input"
              min="1"
              max="365"
              style="width: 100px"
            />
            <span class="unit">天</span>
          </div>
        </div>

        <div class="setting-actions">
          <button class="btn" @click="cleanOldResources">清理旧资源</button>
          <button class="btn btn-danger" @click="cleanAllResources">清空所有资源</button>
        </div>
      </section>

      <!-- Save -->
      <div class="settings-footer">
        <button class="btn btn-primary" :disabled="saving" @click="saveSettings">
          {{ saving ? '保存中...' : '保存设置' }}
        </button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.settings {
  padding: 20px;
  max-width: 900px;
  margin: 0 auto;
}

.page-title {
  font-size: 24px;
  font-weight: 700;
  margin-bottom: 24px;
  color: var(--color-text-primary);
}

.settings-section {
  background: var(--color-bg-secondary);
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 16px;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 8px;
  color: var(--color-text-primary);
}

.section-description {
  font-size: 13px;
  color: var(--color-text-secondary);
  margin-bottom: 16px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin-bottom: 16px;
}

.stat-card {
  background: var(--color-bg-primary);
  padding: 16px;
  border-radius: 6px;
  text-align: center;
}

.stat-label {
  font-size: 13px;
  color: var(--color-text-secondary);
  margin-bottom: 4px;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: var(--color-text-primary);
}

.category-stats {
  margin-top: 16px;
}

.category-stats h3 {
  font-size: 14px;
  margin-bottom: 8px;
  color: var(--color-text-primary);
}

.category-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tag {
  background: var(--color-bg-tertiary);
  padding: 4px 12px;
  border-radius: 4px;
  font-size: 13px;
  color: var(--color-text-secondary);
}

.category-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
}

.category-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: var(--color-bg-primary);
  border-radius: 6px;
}

.category-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.category-name {
  font-weight: 500;
  color: var(--color-text-primary);
}

.category-count {
  font-size: 13px;
  color: var(--color-text-secondary);
}

.add-category-form {
  display: flex;
  gap: 8px;
}

.add-category-form .input {
  flex: 1;
}

.source-category-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.source-category-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: var(--color-bg-primary);
  border-radius: 6px;
}

.source-name {
  font-weight: 500;
  color: var(--color-text-primary);
}

.source-category-item .select {
  width: 150px;
}

.setting-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid var(--color-border);
}

.setting-row:last-child {
  border-bottom: none;
}

.setting-info {
  flex: 1;
}

.setting-label {
  font-weight: 500;
  color: var(--color-text-primary);
  margin-bottom: 2px;
}

.setting-description {
  font-size: 13px;
  color: var(--color-text-secondary);
}

.setting-control {
  display: flex;
  align-items: center;
  gap: 8px;
}

.setting-actions {
  display: flex;
  gap: 8px;
  margin-top: 16px;
}

.toggle {
  position: relative;
  display: inline-block;
  width: 48px;
  height: 24px;
}

.toggle input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--color-bg-tertiary);
  transition: 0.3s;
  border-radius: 24px;
}

.toggle-slider:before {
  position: absolute;
  content: "";
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: 0.3s;
  border-radius: 50%;
}

.toggle input:checked + .toggle-slider {
  background-color: var(--color-accent);
}

.toggle input:checked + .toggle-slider:before {
  transform: translateX(24px);
}

.settings-footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

.empty-message {
  text-align: center;
  padding: 24px;
  color: var(--color-text-secondary);
  font-size: 14px;
}

.btn {
  padding: 8px 16px;
  border-radius: 6px;
  border: none;
  background: var(--color-bg-tertiary);
  color: var(--color-text-primary);
  cursor: pointer;
  font-size: 14px;
  transition: background-color 0.2s;
}

.btn:hover {
  background: var(--color-border);
}

.btn-primary {
  background: var(--color-accent);
  color: white;
}

.btn-primary:hover {
  background: var(--color-accent-hover);
}

.btn-danger {
  background: #dc2626;
  color: white;
}

.btn-danger:hover {
  background: #b91c1c;
}

.btn-small {
  padding: 4px 12px;
  font-size: 13px;
}

.input, .select {
  padding: 8px 12px;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
  font-size: 14px;
}

.input:focus, .select:focus {
  outline: none;
  border-color: var(--color-accent);
}

.unit {
  color: var(--color-text-secondary);
  font-size: 14px;
}

.loading {
  display: flex;
  justify-content: center;
  padding: 48px;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-accent);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 600px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }

  .setting-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .setting-control {
    width: 100%;
  }
}

/* Keyword Rules */
.rules-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 16px;
}

.rule-item {
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 14px;
}

.rule-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.rule-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.rule-name {
  font-weight: 600;
  font-size: 15px;
  color: var(--color-text-primary);
}

.rule-badge {
  background: var(--color-accent);
  color: white;
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 10px;
}

.rule-actions {
  display: flex;
  gap: 6px;
}

.rule-detail {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  font-size: 13px;
  color: var(--color-text-secondary);
}

.rule-kw {
  display: flex;
  align-items: center;
  gap: 4px;
}

.rule-kw code {
  background: var(--color-bg-tertiary);
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 12px;
  color: var(--color-text-primary);
}

.label-text {
  color: var(--color-text-muted);
  font-size: 12px;
}

.rule-add-row {
  margin-top: 12px;
}

/* Rule Dialog */
.dialog-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.dialog {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 24px;
  width: 480px;
  max-width: 90vw;
  max-height: 85vh;
  overflow-y: auto;
}

.dialog-title {
  font-size: 18px;
  font-weight: 700;
  margin-bottom: 20px;
  color: var(--color-text-primary);
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 20px;
}

.form-group {
  margin-bottom: 16px;
}

.form-label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-secondary);
  margin-bottom: 6px;
}

.form-label .hint {
  font-weight: 400;
  color: var(--color-text-muted);
}

.source-checkboxes {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  max-height: 150px;
  overflow-y: auto;
  padding: 8px;
  background: var(--color-bg-primary);
  border-radius: 6px;
}

.source-check {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
}

.source-check:hover {
  background: var(--color-bg-tertiary);
}

.toggle-sm {
  width: 36px;
  height: 18px;
}

.toggle-sm .toggle-slider:before {
  height: 14px;
  width: 14px;
}

.toggle-sm input:checked + .toggle-slider:before {
  transform: translateX(18px);
}
</style>
