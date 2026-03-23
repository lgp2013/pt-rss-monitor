# PT RSS Monitor

PT 站点 RSS 订阅管理与资源监控工具。

## 功能特性

- **RSS 源管理** - 添加、编辑、删除 RSS 源，支持分类管理
- **自动抓取** - 支持定时自动抓取，可配置抓取间隔
- **资源列表** - 支持按站点、分类、时间筛选，搜索标题，分页浏览
- **主题切换** - 支持浅色/深色/跟随系统三种主题模式
- **数据管理** - 支持自动清理旧数据，可配置保留天数

## 技术栈

- **后端**: Node.js + Hono + better-sqlite3 + node-cron
- **前端**: Vue 3 + Vite + TypeScript
- **数据库**: SQLite
- **容器化**: Docker

## 快速开始

### 使用 Docker Compose（推荐）

```bash
# 构建并启动
docker-compose up -d

# 查看日志
docker-compose logs -f
```

服务启动后访问 http://localhost:3000

### 手动部署

#### 后端

```bash
cd backend
npm install
npm run dev    # 开发模式
# 或
npm run build
npm start      # 生产模式
```

#### 前端

```bash
cd frontend
npm install
npm run dev    # 开发模式
# 或
npm run build  # 生产构建
```

## 项目结构

```
pt-rss-monitor/
├── backend/
│   ├── src/
│   │   ├── index.ts          # Hono 入口
│   │   ├── db.ts             # SQLite 初始化
│   │   ├── types.ts          # TypeScript 类型
│   │   ├── routes/
│   │   │   ├── rss.ts        # RSS 源管理 API
│   │   │   ├── resource.ts   # 资源列表 API
│   │   │   └── settings.ts   # 设置 API
│   │   └── services/
│   │       └── fetcher.ts    # RSS 抓取 + cron
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── App.vue
│   │   ├── main.ts
│   │   ├── api/              # API 调用
│   │   ├── views/
│   │   │   ├── Dashboard.vue # 资源列表页
│   │   │   ├── Sources.vue   # RSS 源配置页
│   │   │   └── Settings.vue  # 设置页
│   │   ├── components/
│   │   │   ├── SourceCard.vue
│   │   │   ├── ResourceRow.vue
│   │   │   ├── ThemeToggle.vue
│   │   │   └── AddSourceModal.vue
│   │   └── styles/
│   │       └── theme.css     # CSS 变量主题
│   ├── index.html
│   └── package.json
├── Dockerfile
├── docker-compose.yaml
└── README.md
```

## API 接口

### RSS 源管理

| 方法   | 路径                    | 描述         |
|--------|------------------------|--------------|
| GET    | /api/sources           | 获取所有 RSS 源 |
| POST   | /api/sources           | 添加 RSS 源   |
| PUT    | /api/sources/:id       | 更新 RSS 源   |
| DELETE | /api/sources/:id       | 删除 RSS 源   |
| POST   | /api/sources/:id/fetch | 手动抓取      |
| POST   | /api/sources/fetch-all | 抓取所有启用源  |

### 资源管理

| 方法   | 路径                              | 描述           |
|--------|----------------------------------|----------------|
| GET    | /api/resources                   | 获取资源列表    |
| DELETE | /api/resources/:id               | 删除单条资源    |
| POST   | /api/resources/clean             | 清理旧资源      |

### 设置

| 方法   | 路径              | 描述           |
|--------|------------------|----------------|
| GET    | /api/settings    | 获取所有设置    |
| PUT    | /api/settings    | 更新设置       |
| GET    | /api/stats       | 获取统计信息    |

## 数据库

SQLite 数据库文件位于 `data/pt-rss-monitor.db`

### 表结构

**sources** - RSS 源表
- id: 主键
- name: 名称
- url: RSS 地址
- category: 分类
- fetch_interval: 抓取间隔（分钟）
- enabled: 是否启用
- created_at: 创建时间

**resources** - 资源表
- id: 主键
- source_id: RSS 源 ID
- title: 标题
- link: 下载链接
- guid: 全局唯一标识
- pub_date: 发布时间
- seeders: 做种数
- leechers: 下载数
- downloads: 总下载次数
- free_tag: 免费标记
- size: 大小
- created_at: 抓取时间

**settings** - 设置表
- key: 键
- value: 值

## 环境变量

| 变量           | 默认值                | 描述           |
|---------------|----------------------|----------------|
| PORT          | 3000                 | 服务端口        |
| DB_PATH       | ./data/pt-rss-monitor.db | 数据库路径   |
| FRONTEND_DIST | ../frontend-dist     | 前端静态文件目录 |

## 开发说明

### RSS 解析规则

解析 `<item>` 中的字段，自动提取：
- 免费标记: `free`, `免费`, `0%`, `100%` → "FREE"
- 折扣: `\d+%` → "50%" 等
- 大小: `\d+\.?\d*\s*[GMKT]B?`
- 做种: `seeders:\s*\d+`

### 主题配置

主题使用 CSS 变量实现，支持：
- 浅色主题
- 深色主题
- 跟随系统

保存在 localStorage，key 为 `theme`。
