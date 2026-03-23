<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { resourcesApi } from '../api';

const resources = ref<any[]>([]);
const sources = ref<any[]>([]);
const loading = ref(true);

// Stats
const stats = ref({
  total: 0,
  today: 0,
  thisWeek: 0,
  thisMonth: 0,
});

// By source
const bySource = computed(() => {
  const map: Record<string, number> = {};
  for (const r of resources.value) {
    const name = r.source_name || '未知';
    map[name] = (map[name] || 0) + 1;
  }
  return Object.entries(map)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
});

// By resolution
const byResolution = computed(() => {
  const map: Record<string, number> = {
    '2160p': 0,
    '1080p': 0,
    '720p': 0,
    '480p': 0,
    'Other': 0,
  };
  
  for (const r of resources.value) {
    const title = r.title.toLowerCase();
    if (title.includes('2160p')) map['2160p']++;
    else if (title.includes('1080p')) map['1080p']++;
    else if (title.includes('720p')) map['720p']++;
    else if (title.includes('480p')) map['480p']++;
    else map['Other']++;
  }
  
  return Object.entries(map)
    .map(([name, count]) => ({ name, count }))
    .filter(x => x.count > 0);
});

// By free tag
const byFreeTag = computed(() => {
  const map: Record<string, number> = {
    'FREE': 0,
    '50%': 0,
    '30%': 0,
    'None': 0,
  };
  
  for (const r of resources.value) {
    if (r.free_tag === 'FREE') map['FREE']++;
    else if (r.free_tag?.includes('%')) map[r.free_tag]++;
    else map['None']++;
  }
  
  return Object.entries(map)
    .map(([name, count]) => ({ name, count }))
    .filter(x => x.count > 0);
});

// Total size by source
const totalSizeBySource = computed(() => {
  const map: Record<string, number> = {};
  for (const r of resources.value) {
    const name = r.source_name || '未知';
    const sizeStr = r.size || '0';
    const size = parseFloat(sizeStr) || 0;
    map[name] = (map[name] || 0) + size;
  }
  return Object.entries(map)
    .map(([name, size]) => ({ name, size: size.toFixed(2) }))
    .sort((a, b) => parseFloat(b.size) - parseFloat(a.size));
});

// Recent activity (last 7 days)
const recentActivity = computed(() => {
  const days: Record<string, number> = {};
  const now = new Date();
  
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = `${d.getMonth() + 1}/${d.getDate()}`;
    days[key] = 0;
  }
  
  for (const r of resources.value) {
    const d = new Date(r.created_at);
    const key = `${d.getMonth() + 1}/${d.getDate()}`;
    if (key in days) {
      days[key]++;
    }
  }
  
  return Object.entries(days).map(([date, count]) => ({ date, count }));
});

const maxActivityCount = computed(() => {
  return Math.max(...recentActivity.value.map(x => x.count), 1);
});

async function loadData() {
  loading.value = true;
  try {
    // Load resources
    const data = await resourcesApi.list({ limit: 10000 });
    resources.value = data.data;
    
    // Load sources
    sources.value = await sourcesApi.list();
    
    // Calculate stats
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);
    const monthStart = new Date(todayStart);
    monthStart.setMonth(monthStart.getMonth() - 1);
    
    stats.value = {
      total: resources.value.length,
      today: resources.value.filter(r => new Date(r.created_at) >= todayStart).length,
      thisWeek: resources.value.filter(r => new Date(r.created_at) >= weekStart).length,
      thisMonth: resources.value.filter(r => new Date(r.created_at) >= monthStart).length,
    };
    
  } catch (error) {
    console.error('Failed to load data:', error);
  } finally {
    loading.value = false;
  }
}

// Get bar width percentage
function getBarWidth(count: number, max: number): string {
  return max > 0 ? `${(count / max * 100).toFixed(1)}%` : '0%';
}

// Get chart bar height
function getBarHeight(count: number): string {
  return maxActivityCount.value > 0 ? `${(count / maxActivityCount.value * 100).toFixed(1)}%` : '0%';
}

onMounted(() => {
  loadData();
});
</script>

<template>
  <div class="statistics-page">
    <h1 class="page-title">我的数据</h1>

    <div v-if="loading" class="loading">
      <div class="spinner"></div>
    </div>

    <template v-else>
      <!-- Overview Stats -->
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">总资源</div>
          <div class="stat-value">{{ stats.total }}</div>
        </div>
        <div class="stat-card highlight">
          <div class="stat-label">今日新增</div>
          <div class="stat-value">{{ stats.today }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">本周新增</div>
          <div class="stat-value">{{ stats.thisWeek }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">本月新增</div>
          <div class="stat-value">{{ stats.thisMonth }}</div>
        </div>
      </div>

      <!-- Recent Activity Chart -->
      <div class="chart-card">
        <h2 class="chart-title">最近7天活动</h2>
        <div class="bar-chart">
          <div 
            v-for="day in recentActivity" 
            :key="day.date" 
            class="bar-column"
          >
            <div class="bar-wrapper">
              <div 
                class="bar" 
                :style="{ height: getBarHeight(day.count) }"
              >
                <span class="bar-value">{{ day.count }}</span>
              </div>
            </div>
            <div class="bar-label">{{ day.date }}</div>
          </div>
        </div>
      </div>

      <div class="charts-row">
        <!-- By Source -->
        <div class="chart-card">
          <h2 class="chart-title">按站点分布</h2>
          <div class="horizontal-bars">
            <div 
              v-for="item in bySource" 
              :key="item.name" 
              class="bar-item"
            >
              <div class="bar-info">
                <span class="bar-name">{{ item.name }}</span>
                <span class="bar-count">{{ item.count }}</span>
              </div>
              <div class="bar-track">
                <div 
                  class="bar-fill" 
                  :style="{ width: getBarWidth(item.count, bySource[0]?.count || 1) }"
                ></div>
              </div>
            </div>
          </div>
        </div>

        <!-- By Resolution -->
        <div class="chart-card">
          <h2 class="chart-title">按清晰度分布</h2>
          <div class="pie-chart-container">
            <div class="pie-chart">
              <div 
                v-for="(item, idx) in byResolution" 
                :key="item.name"
                class="pie-segment"
                :class="`color-${idx + 1}`"
                :style="{
                  '--offset': getPieOffset(idx),
                  '--total': byResolution.reduce((sum, x) => sum + x.count, 0)
                }"
              >
              </div>
            </div>
            <div class="pie-legend">
              <div 
                v-for="(item, idx) in byResolution" 
                :key="item.name"
                class="legend-item"
              >
                <span class="legend-color" :class="`color-${idx + 1}`"></span>
                <span class="legend-name">{{ item.name }}</span>
                <span class="legend-count">{{ item.count }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- By Free Tag -->
      <div class="chart-card">
        <h2 class="chart-title">按折扣分布</h2>
        <div class="horizontal-bars">
          <div 
            v-for="item in byFreeTag" 
            :key="item.name" 
            class="bar-item"
          >
            <div class="bar-info">
              <span class="bar-name">{{ item.name === 'None' ? '无折扣' : item.name }}</span>
              <span class="bar-count">{{ item.count }}</span>
            </div>
            <div class="bar-track">
              <div 
                class="bar-fill free" 
                :style="{ width: getBarWidth(item.count, byFreeTag[0]?.count || 1) }"
              ></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Size by Source -->
      <div class="chart-card">
        <h2 class="chart-title">各站点资源大小估算</h2>
        <div class="horizontal-bars">
          <div 
            v-for="item in totalSizeBySource" 
            :key="item.name" 
            class="bar-item"
          >
            <div class="bar-info">
              <span class="bar-name">{{ item.name }}</span>
              <span class="bar-count">{{ item.size }} GB</span>
            </div>
            <div class="bar-track">
              <div 
                class="bar-fill size" 
                :style="{ width: getBarWidth(parseFloat(item.size), parseFloat(totalSizeBySource[0]?.size || '1')) }"
              ></div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.statistics-page {
  padding: 20px;
  max-width: 1400px;
  margin: 0 auto;
}

.page-title {
  font-size: 24px;
  font-weight: 700;
  margin-bottom: 24px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}

.stat-card {
  background: var(--color-bg-secondary);
  padding: 20px;
  border-radius: 8px;
  text-align: center;
}

.stat-card.highlight {
  background: var(--color-accent);
  color: white;
}

.stat-card.highlight .stat-label {
  color: rgba(255,255,255,0.8);
}

.stat-label {
  font-size: 13px;
  color: var(--color-text-secondary);
  margin-bottom: 8px;
}

.stat-value {
  font-size: 32px;
  font-weight: 700;
  color: var(--color-text-primary);
}

.chart-card {
  background: var(--color-bg-secondary);
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 16px;
}

.chart-title {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 20px;
  color: var(--color-text-primary);
}

.charts-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

/* Bar Chart */
.bar-chart {
  display: flex;
  justify-content: space-around;
  align-items: flex-end;
  height: 200px;
  padding-top: 20px;
}

.bar-column {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
}

.bar-wrapper {
  height: 160px;
  display: flex;
  align-items: flex-end;
  width: 100%;
  justify-content: center;
}

.bar {
  width: 60%;
  max-width: 40px;
  background: var(--color-accent);
  border-radius: 4px 4px 0 0;
  position: relative;
  min-height: 2px;
  transition: height 0.3s;
}

.bar-value {
  position: absolute;
  top: -20px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 12px;
  color: var(--color-text-secondary);
}

.bar-label {
  margin-top: 8px;
  font-size: 12px;
  color: var(--color-text-secondary);
}

/* Horizontal Bars */
.horizontal-bars {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.bar-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.bar-info {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
}

.bar-name {
  color: var(--color-text-primary);
}

.bar-count {
  color: var(--color-text-secondary);
}

.bar-track {
  height: 8px;
  background: var(--color-bg-tertiary);
  border-radius: 4px;
  overflow: hidden;
}

.bar-fill {
  height: 100%;
  background: var(--color-accent);
  border-radius: 4px;
  transition: width 0.3s;
}

.bar-fill.free {
  background: var(--color-success);
}

.bar-fill.size {
  background: #8b5cf6;
}

/* Pie Chart */
.pie-chart-container {
  display: flex;
  align-items: center;
  gap: 24px;
}

.pie-chart {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  background: conic-gradient(
    var(--color-accent) calc(var(--offset) / var(--total) * 360deg),
    var(--color-accent) calc((var(--offset) + var(--count)) / var(--total) * 360deg),
    var(--color-bg-tertiary) calc((var(--offset) + var(--count)) / var(--total) * 360deg)
  );
  position: relative;
}

.pie-segment {
  position: absolute;
  width: 100%;
  height: 100%;
}

.pie-legend {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.legend-color {
  width: 12px;
  height: 12px;
  border-radius: 2px;
}

.legend-color.color-1 { background: #3b82f6; }
.legend-color.color-2 { background: #10b981; }
.legend-color.color-3 { background: #8b5cf6; }
.legend-color.color-4 { background: #f59e0b; }
.legend-color.color-5 { background: #6b7280; }

.legend-name {
  flex: 1;
  color: var(--color-text-primary);
}

.legend-count {
  color: var(--color-text-secondary);
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
  to { transform: rotate(360deg); }
}

@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .charts-row {
    grid-template-columns: 1fr;
  }
  
  .pie-chart-container {
    flex-direction: column;
  }
}
</style>
