<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { sitesApi, userDataApi, type Site, type UserData, type UserDataHistory } from '../api';

interface UserDataRow extends Site {
  userData?: UserData;
}

const loading = ref(false);
const saving = ref(false);
const batchRunning = ref(false);
const showBatchOpenModal = ref(false);
const batchOpenUrls = ref<string[]>([]);
const sources = ref<Site[]>([]);
const userData = ref<UserData[]>([]);
const history = ref<UserDataHistory[]>([]);
const search = ref('');
const category = ref('');
const status = ref('');
const showEditModal = ref(false);
const showHistoryModal = ref(false);
const syncingSourceId = ref<number | null>(null);
const activeRow = ref<UserDataRow | null>(null);
const selectedIds = ref<number[]>([]);

const form = ref({
  username: '',
  user_id: '',
  level_name: '',
  uploaded: 0,
  downloaded: 0,
  ratio: '',
  true_uploaded: '',
  true_downloaded: '',
  true_ratio: '',
  uploads: 0,
  seeding: 0,
  seeding_size: 0,
  bonus: 0,
  bonus_per_hour: 0,
  invites: 0,
  join_time: '',
  last_access_at: '',
  message_count: 0,
  status: 'success',
});

const rows = computed<UserDataRow[]>(() => {
  const dataMap = new Map(userData.value.map((item) => [item.site_id, item]));
  return sources.value.map((source) => ({
    ...source,
    userData: dataMap.get(source.id),
  }));
});

const categories = computed(() => [...new Set(rows.value.map((item) => item.category).filter(Boolean))]);

const filteredRows = computed(() => {
  const keyword = search.value.trim().toLowerCase();
  return rows.value.filter((item) => {
    const matchesKeyword =
      !keyword ||
      [item.custom_name, item.name, item.site_url, item.userData?.username, item.userData?.level_name]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword));

    const matchesCategory = !category.value || item.category === category.value;
    const matchesStatus = !status.value || (item.userData?.status || 'missing') === status.value;
    return matchesKeyword && matchesCategory && matchesStatus;
  });
});

const selectedRows = computed(() => filteredRows.value.filter((row) => selectedIds.value.includes(row.id)));
const allSelected = computed(() => filteredRows.value.length > 0 && filteredRows.value.every((row) => selectedIds.value.includes(row.id)));

const summary = computed(() => {
  const items = userData.value;
  return {
    configuredSites: sources.value.length,
    dataSites: items.length,
    uploaded: items.reduce((sum, item) => sum + (item.uploaded || 0), 0),
    downloaded: items.reduce((sum, item) => sum + (item.downloaded || 0), 0),
    seedingSize: items.reduce((sum, item) => sum + (item.seeding_size || 0), 0),
    bonus: items.reduce((sum, item) => sum + (item.bonus || 0), 0),
  };
});

function formatBytes(value: number | null | undefined): string {
  const num = Number(value || 0);
  if (!Number.isFinite(num) || num <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  let size = num;
  let index = 0;
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }
  return `${size.toFixed(index === 0 ? 0 : 2)} ${units[index]}`;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString('zh-CN');
}

function formatRatio(value: number | null | undefined): string {
  if (value == null) return '-';
  if (!Number.isFinite(value)) return '∞';
  return value.toFixed(2);
}

function toNumberOrNull(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function syncSelection() {
  const validIds = new Set(rows.value.map((row) => row.id));
  selectedIds.value = selectedIds.value.filter((id) => validIds.has(id));
}

function getSelectedRowsSnapshot(): UserDataRow[] {
  const selectedSet = new Set(selectedIds.value);
  return rows.value.filter((row) => selectedSet.has(row.id));
}

async function loadData() {
  loading.value = true;
  try {
    const [sourceItems, dataItems] = await Promise.all([sitesApi.list(), userDataApi.list()]);
    sources.value = sourceItems;
    userData.value = dataItems;
    syncSelection();
  } finally {
    loading.value = false;
  }
}

function toggleSelectAll(checked: boolean) {
  if (!checked) {
    selectedIds.value = selectedIds.value.filter((id) => !filteredRows.value.some((row) => row.id === id));
    return;
  }

  const merged = new Set(selectedIds.value);
  filteredRows.value.forEach((row) => merged.add(row.id));
  selectedIds.value = [...merged];
}

function toggleRowSelection(id: number, checked: boolean) {
  if (checked) {
    if (!selectedIds.value.includes(id)) {
      selectedIds.value = [...selectedIds.value, id];
    }
    return;
  }
  selectedIds.value = selectedIds.value.filter((item) => item !== id);
}

function clearSelection() {
  selectedIds.value = [];
}

function openEdit(row: UserDataRow) {
  activeRow.value = row;
  const current = row.userData;
  form.value = {
    username: current?.username || '',
    user_id: current?.user_id || '',
    level_name: current?.level_name || '',
    uploaded: current?.uploaded || 0,
    downloaded: current?.downloaded || 0,
    ratio: current?.ratio == null ? '' : String(current.ratio),
    true_uploaded: current?.true_uploaded == null ? '' : String(current.true_uploaded),
    true_downloaded: current?.true_downloaded == null ? '' : String(current.true_downloaded),
    true_ratio: current?.true_ratio == null ? '' : String(current.true_ratio),
    uploads: current?.uploads || 0,
    seeding: current?.seeding || 0,
    seeding_size: current?.seeding_size || 0,
    bonus: current?.bonus || 0,
    bonus_per_hour: current?.bonus_per_hour || 0,
    invites: current?.invites || 0,
    join_time: current?.join_time || '',
    last_access_at: current?.last_access_at || '',
    message_count: current?.message_count || 0,
    status: current?.status || 'success',
  };
  showEditModal.value = true;
}

async function saveUserData() {
  if (!activeRow.value) return;
  saving.value = true;
  try {
    await userDataApi.save(activeRow.value.id, {
      username: form.value.username || null,
      user_id: form.value.user_id || null,
      level_name: form.value.level_name || null,
      uploaded: form.value.uploaded,
      downloaded: form.value.downloaded,
      ratio: toNumberOrNull(form.value.ratio),
      true_uploaded: toNumberOrNull(form.value.true_uploaded),
      true_downloaded: toNumberOrNull(form.value.true_downloaded),
      true_ratio: toNumberOrNull(form.value.true_ratio),
      uploads: form.value.uploads,
      seeding: form.value.seeding,
      seeding_size: form.value.seeding_size,
      bonus: form.value.bonus,
      bonus_per_hour: form.value.bonus_per_hour,
      invites: form.value.invites,
      join_time: form.value.join_time || null,
      last_access_at: form.value.last_access_at || null,
      message_count: form.value.message_count,
      status: form.value.status,
    });
    showEditModal.value = false;
    await loadData();
  } finally {
    saving.value = false;
  }
}

async function openHistory(row: UserDataRow) {
  activeRow.value = row;
  history.value = await userDataApi.history(row.id);
  showHistoryModal.value = true;
}

function openLogin(row: UserDataRow) {
  if (!row.site_url) {
    alert('该站点未配置网站地址');
    return;
  }
  window.open(row.site_url, '_blank', 'noopener,noreferrer');
}

async function refreshUserData(row: UserDataRow) {
  syncingSourceId.value = row.id;
  try {
    const result = await userDataApi.refresh(row.id);
    if (result.need_login) {
      if (result.site_url) {
        window.open(result.site_url, '_blank', 'noopener,noreferrer');
      }
      alert('当前站点未登录或 Cookie 无效，已为你打开站点，请先登录后再刷新。');
    } else if (!result.success) {
      alert(result.error || '刷新抓取失败');
    }
    await loadData();
  } catch (error) {
    alert(error instanceof Error ? error.message : '刷新抓取失败');
  } finally {
    syncingSourceId.value = null;
  }
}

async function batchRefresh() {
  const targets = getSelectedRowsSnapshot();
  if (!targets.length) return;

  batchRunning.value = true;
  const resultSummary = {
    success: 0,
    needLogin: 0,
    failed: 0,
  };

  try {
    for (const row of targets) {
      syncingSourceId.value = row.id;
      try {
        const result = await userDataApi.refresh(row.id);
        if (result.need_login) {
          resultSummary.needLogin += 1;
        } else if (result.success) {
          resultSummary.success += 1;
        } else {
          resultSummary.failed += 1;
        }
      } catch {
        resultSummary.failed += 1;
      }
    }
    await loadData();
  } finally {
    syncingSourceId.value = null;
    batchRunning.value = false;
  }

  alert(`刷新完成：成功 ${resultSummary.success} 个，需登录 ${resultSummary.needLogin} 个，失败 ${resultSummary.failed} 个。`);
}

async function copyBatchUrls() {
  if (!batchOpenUrls.value.length) return;
  const text = batchOpenUrls.value.join('\n');
  try {
    await navigator.clipboard.writeText(text);
    alert('已复制站点链接。');
  } catch {
    alert('复制失败，请手动复制链接。');
  }
}

function batchOpenSites() {
  const targets = getSelectedRowsSnapshot();
  const urls = targets.map((row) => row.site_url).filter(Boolean) as string[];
  if (!urls.length) {
    alert('没有可打开的站点地址。');
    return;
  }
  batchOpenUrls.value = urls;
  showBatchOpenModal.value = true;
}

async function batchDeleteSites() {
  const targets = getSelectedRowsSnapshot();
  if (!targets.length) return;
  if (!confirm(`确定删除已选中的 ${targets.length} 个站点吗？`)) return;

  batchRunning.value = true;
  try {
    for (const row of targets) {
      await sitesApi.delete(row.id);
    }
    clearSelection();
    await loadData();
  } finally {
    batchRunning.value = false;
  }
}

function buildPoints(items: UserDataHistory[], field: 'uploaded' | 'downloaded' | 'bonus'): string {
  if (items.length === 0) return '';
  const ordered = [...items].reverse();
  const values = ordered.map((item) => Number(item[field] || 0));
  const max = Math.max(...values, 1);
  return values
    .map((value, index) => {
      const x = ordered.length === 1 ? 0 : (index / (ordered.length - 1)) * 300;
      const y = 80 - (value / max) * 80;
      return `${x},${y}`;
    })
    .join(' ');
}

onMounted(loadData);
</script>

<template>
  <div class="my-data-page">
    <div class="page-header">
      <div>
        <h1 class="page-title">我的数据</h1>
        <p class="page-subtitle">按站点维护账号数据，支持刷新抓取、打开站点和删除站点。</p>
      </div>
      <button class="btn" @click="loadData">刷新</button>
    </div>

    <div class="summary-grid">
      <div class="summary-card">
        <div class="summary-label">已配置站点</div>
        <div class="summary-value">{{ summary.configuredSites }}</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">已录入数据</div>
        <div class="summary-value">{{ summary.dataSites }}</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">总上传</div>
        <div class="summary-value">{{ formatBytes(summary.uploaded) }}</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">总下载</div>
        <div class="summary-value">{{ formatBytes(summary.downloaded) }}</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">总做种体积</div>
        <div class="summary-value">{{ formatBytes(summary.seedingSize) }}</div>
      </div>
      <div class="summary-card">
        <div class="summary-label">总魔力</div>
        <div class="summary-value">{{ summary.bonus.toFixed(2) }}</div>
      </div>
    </div>

    <div class="toolbar card">
      <input v-model="search" class="input search-input" placeholder="搜索站点、用户名、等级" />
      <select v-model="category" class="select">
        <option value="">全部分类</option>
        <option v-for="item in categories" :key="item" :value="item">{{ item }}</option>
      </select>
      <select v-model="status" class="select">
        <option value="">全部状态</option>
        <option value="success">正常</option>
        <option value="warning">预警</option>
        <option value="error">异常</option>
        <option value="missing">未录入</option>
      </select>
    </div>

    <div class="batch-toolbar card">
      <div class="batch-left">
        <label class="checkbox-label">
          <input :checked="allSelected" type="checkbox" @change="toggleSelectAll(($event.target as HTMLInputElement).checked)" />
          <span>全选当前列表</span>
        </label>
        <span class="selected-count">已选 {{ selectedRows.length }} 个站点</span>
      </div>
      <div class="batch-actions">
        <button class="btn" :disabled="!selectedRows.length || batchRunning" @click="batchRefresh">
          {{ batchRunning ? '处理中...' : '刷新抓取' }}
        </button>
        <button class="btn" :disabled="!selectedRows.length" @click="batchOpenSites">打开站点</button>
        <button class="btn btn-danger" :disabled="!selectedRows.length || batchRunning" @click="batchDeleteSites">删除站点</button>
      </div>
    </div>

    <div v-if="loading" class="loading"><div class="spinner"></div></div>

    <div v-else class="card table-card">
      <table class="data-table">
        <thead>
          <tr>
            <th class="checkbox-col">
              <input :checked="allSelected" type="checkbox" @change="toggleSelectAll(($event.target as HTMLInputElement).checked)" />
            </th>
            <th>站点</th>
            <th>用户</th>
            <th>等级</th>
            <th>上传 / 下载</th>
            <th>分享率</th>
            <th>做种</th>
            <th>魔力</th>
            <th>加入时间</th>
            <th>更新时间</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in filteredRows" :key="row.id">
            <td class="checkbox-col">
              <input
                :checked="selectedIds.includes(row.id)"
                type="checkbox"
                @change="toggleRowSelection(row.id, ($event.target as HTMLInputElement).checked)"
              />
            </td>
            <td>
              <div class="site-cell">
                <strong>{{ row.custom_name || row.name }}</strong>
                <span class="text-muted">{{ row.category || '未分类' }}</span>
              </div>
            </td>
            <td>{{ row.userData?.username || '-' }}</td>
            <td>{{ row.userData?.level_name || '-' }}</td>
            <td>
              <div class="stack-cell">
                <span>↑ {{ formatBytes(row.userData?.uploaded) }}</span>
                <span>↓ {{ formatBytes(row.userData?.downloaded) }}</span>
              </div>
            </td>
            <td>{{ formatRatio(row.userData?.ratio) }}</td>
            <td>
              <div class="stack-cell">
                <span>{{ row.userData?.seeding ?? 0 }} 个</span>
                <span>{{ formatBytes(row.userData?.seeding_size) }}</span>
              </div>
            </td>
            <td>
              <div class="stack-cell">
                <span>{{ (row.userData?.bonus ?? 0).toFixed(2) }}</span>
                <span class="text-muted">{{ (row.userData?.bonus_per_hour ?? 0).toFixed(2) }}/h</span>
              </div>
            </td>
            <td>{{ formatDate(row.userData?.join_time) }}</td>
            <td>
              <span :class="['status-badge', row.userData?.status || 'missing']">
                {{ row.userData?.status || 'missing' }}
              </span>
              <div class="text-muted">{{ formatDate(row.userData?.updated_at) }}</div>
            </td>
            <td>
              <div class="action-row">
                <button class="btn btn-small" @click="openEdit(row)">编辑</button>
                <button class="btn btn-small" @click="openHistory(row)">历史</button>
                <button class="btn btn-small" @click="openLogin(row)">打开站点</button>
                <button class="btn btn-small btn-primary" :disabled="syncingSourceId === row.id" @click="refreshUserData(row)">
                  {{ syncingSourceId === row.id ? '刷新中...' : '刷新抓取' }}
                </button>
              </div>
            </td>
          </tr>
          <tr v-if="filteredRows.length === 0">
            <td colspan="11" class="empty-cell">当前没有匹配的数据</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="showBatchOpenModal" class="modal-overlay" @click.self="showBatchOpenModal = false">
      <div class="modal batch-open-modal">
        <div class="modal-header">
          <h2>已选站点链接</h2>
          <button class="modal-close" @click="showBatchOpenModal = false">&times;</button>
        </div>
        <p class="modal-note">浏览器会拦截普通网页一次点击打开多个第三方标签页。这里保留可逐个打开的链接，并支持一键复制全部链接。</p>
        <div class="modal-footer batch-open-actions">
          <button class="btn" @click="copyBatchUrls">复制全部链接</button>
          <button class="btn" @click="showBatchOpenModal = false">关闭</button>
        </div>
        <div class="batch-url-list">
          <a
            v-for="url in batchOpenUrls"
            :key="url"
            :href="url"
            target="_blank"
            rel="noopener noreferrer"
            class="batch-url-item"
          >
            {{ url }}
          </a>
        </div>
      </div>
    </div>

    <div v-if="showEditModal && activeRow" class="modal-overlay" @click.self="showEditModal = false">
      <div class="modal large-modal">
        <div class="modal-header">
          <h2>{{ activeRow.custom_name || activeRow.name }} - 数据编辑</h2>
          <button class="modal-close" @click="showEditModal = false">&times;</button>
        </div>
        <div class="modal-grid">
          <div class="form-group"><label>用户名</label><input v-model="form.username" class="input" /></div>
          <div class="form-group"><label>用户 ID</label><input v-model="form.user_id" class="input" /></div>
          <div class="form-group"><label>等级</label><input v-model="form.level_name" class="input" /></div>
          <div class="form-group">
            <label>状态</label>
            <select v-model="form.status" class="select">
              <option value="success">success</option>
              <option value="warning">warning</option>
              <option value="error">error</option>
            </select>
          </div>
          <div class="form-group"><label>上传字节</label><input v-model.number="form.uploaded" type="number" class="input" /></div>
          <div class="form-group"><label>下载字节</label><input v-model.number="form.downloaded" type="number" class="input" /></div>
          <div class="form-group"><label>分享率</label><input v-model="form.ratio" class="input" /></div>
          <div class="form-group"><label>真实分享率</label><input v-model="form.true_ratio" class="input" /></div>
          <div class="form-group"><label>真实上传字节</label><input v-model="form.true_uploaded" class="input" /></div>
          <div class="form-group"><label>真实下载字节</label><input v-model="form.true_downloaded" class="input" /></div>
          <div class="form-group"><label>发布数</label><input v-model.number="form.uploads" type="number" class="input" /></div>
          <div class="form-group"><label>做种数</label><input v-model.number="form.seeding" type="number" class="input" /></div>
          <div class="form-group"><label>做种体积字节</label><input v-model.number="form.seeding_size" type="number" class="input" /></div>
          <div class="form-group"><label>魔力</label><input v-model.number="form.bonus" type="number" class="input" /></div>
          <div class="form-group"><label>每小时魔力</label><input v-model.number="form.bonus_per_hour" type="number" class="input" /></div>
          <div class="form-group"><label>邀请数</label><input v-model.number="form.invites" type="number" class="input" /></div>
          <div class="form-group"><label>未读消息</label><input v-model.number="form.message_count" type="number" class="input" /></div>
          <div class="form-group"><label>加入时间</label><input v-model="form.join_time" type="datetime-local" class="input" /></div>
          <div class="form-group"><label>最后访问</label><input v-model="form.last_access_at" type="datetime-local" class="input" /></div>
        </div>
        <div class="modal-footer">
          <button class="btn" @click="showEditModal = false">取消</button>
          <button class="btn btn-primary" :disabled="saving" @click="saveUserData">
            {{ saving ? '保存中...' : '保存并记录快照' }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="showHistoryModal && activeRow" class="modal-overlay" @click.self="showHistoryModal = false">
      <div class="modal history-modal">
        <div class="modal-header">
          <h2>{{ activeRow.custom_name || activeRow.name }} - 历史快照</h2>
          <button class="modal-close" @click="showHistoryModal = false">&times;</button>
        </div>
        <div v-if="history.length" class="history-content">
          <div class="chart-box">
            <svg viewBox="0 0 300 80" class="trend-chart">
              <polyline :points="buildPoints(history, 'uploaded')" class="trend-line upload"></polyline>
              <polyline :points="buildPoints(history, 'downloaded')" class="trend-line download"></polyline>
              <polyline :points="buildPoints(history, 'bonus')" class="trend-line bonus"></polyline>
            </svg>
            <div class="chart-legend">
              <span><i class="legend-dot upload"></i>上传</span>
              <span><i class="legend-dot download"></i>下载</span>
              <span><i class="legend-dot bonus"></i>魔力</span>
            </div>
          </div>
          <div class="history-list">
            <div v-for="item in history" :key="item.history_id" class="history-item">
              <div><strong>{{ formatDate(item.snapshot_at) }}</strong></div>
              <div>上传 {{ formatBytes(item.uploaded) }} / 下载 {{ formatBytes(item.downloaded) }}</div>
              <div>分享率 {{ formatRatio(item.ratio) }} / 魔力 {{ item.bonus.toFixed(2) }}</div>
            </div>
          </div>
        </div>
        <div v-else class="empty-state">暂无历史快照</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.my-data-page {
  max-width: 1400px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 20px;
}

.page-title {
  font-size: 28px;
  margin: 0 0 6px;
}

.page-subtitle {
  margin: 0;
  color: var(--color-text-secondary);
}

.summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.summary-card,
.card {
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  border-radius: 12px;
  padding: 16px;
}

.summary-label {
  color: var(--color-text-secondary);
  font-size: 13px;
  margin-bottom: 8px;
}

.summary-value {
  font-size: 24px;
  font-weight: 700;
}

.toolbar,
.batch-toolbar,
.batch-left,
.batch-actions,
.batch-open-actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  align-items: center;
}

.toolbar,
.batch-toolbar {
  margin-bottom: 16px;
}

.search-input {
  flex: 1;
  min-width: 220px;
}

.selected-count,
.text-muted,
.modal-note {
  color: var(--color-text-secondary);
  font-size: 12px;
}

.checkbox-label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.table-card {
  overflow-x: auto;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
}

.data-table th,
.data-table td {
  padding: 12px 10px;
  border-bottom: 1px solid var(--color-border);
  text-align: left;
  vertical-align: top;
}

.data-table th {
  color: var(--color-text-secondary);
  font-size: 13px;
  white-space: nowrap;
}

.checkbox-col {
  width: 42px;
}

.site-cell,
.stack-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.action-row {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.status-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 12px;
  text-transform: uppercase;
}

.status-badge.success {
  background: rgba(34, 197, 94, 0.12);
  color: #15803d;
}

.status-badge.warning {
  background: rgba(245, 158, 11, 0.12);
  color: #b45309;
}

.status-badge.error,
.status-badge.missing {
  background: rgba(239, 68, 68, 0.12);
  color: #b91c1c;
}

.empty-cell,
.empty-state {
  padding: 32px;
  text-align: center;
  color: var(--color-text-secondary);
}

.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
  padding: 20px;
}

.modal {
  width: min(1100px, 100%);
  max-height: 90vh;
  overflow: auto;
  background: var(--color-bg-primary);
  border-radius: 16px;
  border: 1px solid var(--color-border);
  padding: 20px;
}

.history-modal {
  width: min(900px, 100%);
}

.batch-open-modal {
  width: min(760px, 100%);
}

.batch-url-list {
  display: grid;
  gap: 10px;
  margin-top: 16px;
}

.batch-url-item {
  padding: 12px 14px;
  border-radius: 10px;
  background: var(--color-bg-secondary);
  border: 1px solid var(--color-border);
  color: var(--color-accent);
  text-decoration: none;
  word-break: break-all;
}

.batch-url-item:hover {
  border-color: var(--color-accent);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.modal-close {
  border: none;
  background: transparent;
  font-size: 28px;
  cursor: pointer;
  color: var(--color-text-secondary);
}

.modal-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 18px;
}

.history-content {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.chart-box,
.history-list {
  background: var(--color-bg-secondary);
  border-radius: 12px;
  padding: 14px;
}

.trend-chart {
  width: 100%;
  height: 120px;
}

.trend-line {
  fill: none;
  stroke-width: 3;
}

.trend-line.upload,
.legend-dot.upload {
  stroke: #2563eb;
  background: #2563eb;
}

.trend-line.download,
.legend-dot.download {
  stroke: #dc2626;
  background: #dc2626;
}

.trend-line.bonus,
.legend-dot.bonus {
  stroke: #16a34a;
  background: #16a34a;
}

.chart-legend {
  display: flex;
  gap: 16px;
  font-size: 13px;
}

.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  display: inline-block;
  margin-right: 6px;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.history-item {
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--color-bg-primary);
  border: 1px solid var(--color-border);
  font-size: 13px;
  line-height: 1.5;
}

.btn {
  padding: 10px 14px;
  border-radius: 10px;
  border: 1px solid var(--color-border);
  background: var(--color-bg-tertiary);
  color: var(--color-text-primary);
  cursor: pointer;
}

.btn-small {
  padding: 6px 10px;
  font-size: 12px;
}

.btn-primary {
  background: var(--color-accent);
  color: #fff;
  border-color: var(--color-accent);
}

.btn-danger {
  border-color: rgba(239, 68, 68, 0.25);
  background: rgba(239, 68, 68, 0.08);
  color: #b91c1c;
}

.input,
.select {
  padding: 10px 12px;
  border: 1px solid var(--color-border);
  border-radius: 10px;
  background: var(--color-bg-primary);
  color: var(--color-text-primary);
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

@media (max-width: 900px) {
  .history-content {
    grid-template-columns: 1fr;
  }

  .page-header {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
