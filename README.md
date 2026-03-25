# PT RSS Monitor

PT RSS Monitor 是一个用于管理 PT RSS 订阅、资源列表、站点配置和用户数据的本地 Web 应用。

当前项目包含：
- RSS 源管理
- 资源列表抓取、筛选、分页和详情展示
- 站点设置
- 我的数据
- 系统设置
- 登录认证和密码管理

## 技术栈

- 后端：Node.js + Hono + TypeScript + node-cron + rss-parser
- 前端：Vue 3 + Vue Router + Vite + TypeScript
- 数据存储：JSON 文件持久化
- 容器部署：Docker / Docker Compose

## 当前实现说明

- 后端默认端口：`3000`
- 前端开发端口：`5173`
- 数据文件默认位置：`backend/data/pt-rss-monitor.json`
- 生产模式下，后端会同时提供 API 和前端静态文件
- 开发模式下，建议分别启动后端和前端

## 默认账号

系统初始化时会自动创建管理员账号：

- 用户名：`admin`
- 密码：`admin@123`

管理员支持：
- 登录系统
- 修改密码
- 在系统设置中重置 `admin` 密码

## 目录结构

```text
repo/
├─ backend/
│  ├─ src/
│  │  ├─ index.ts
│  │  ├─ db.ts
│  │  ├─ middleware/
│  │  ├─ routes/
│  │  ├─ services/
│  │  └─ types.ts
│  ├─ data/
│  └─ package.json
├─ frontend/
│  ├─ src/
│  │  ├─ api/
│  │  ├─ components/
│  │  ├─ styles/
│  │  ├─ views/
│  │  ├─ App.vue
│  │  └─ main.ts
│  ├─ public/
│  └─ package.json
├─ Dockerfile
├─ docker-compose.yml
├─ docker-compose.yaml
└─ README.md
```

## 本地开发

### 1. 安装依赖

后端：

```bash
cd backend
npm install
```

前端：

```bash
cd frontend
npm install
```

### 2. 启动后端

```bash
cd backend
npm run build
npm start
```

说明：
- 这个仓库的 `npm run dev` 在部分 Windows 环境里可能会受到 `tsx/esbuild` 子进程权限限制影响。
- 如果你在本机遇到 `spawn EPERM`，优先使用 `npm run build && npm start`。

### 3. 启动前端

```bash
cd frontend
npm run dev -- --host 127.0.0.1
```

### 4. 访问地址

- 前端开发环境：`http://127.0.0.1:5173`
- 后端接口：`http://127.0.0.1:3000`
- 健康检查：`http://127.0.0.1:3000/api/health`

## Docker 部署

### 构建镜像

```bash
docker build -t pt-rss-monitor:latest .
```

### 运行容器

```bash
docker run -d \
  --name pt-rss-monitor \
  -p 3000:3000 \
  -v pt-rss-monitor-data:/app/data \
  -e NODE_ENV=production \
  -e PORT=3000 \
  -e DB_PATH=/app/data/pt-rss-monitor.json \
  pt-rss-monitor:latest
```

### 使用 Docker Compose

```bash
docker compose up -d --build
```

访问：

- `http://localhost:3000`

## 环境变量

| 变量名 | 默认值 | 说明 |
|---|---|---|
| `PORT` | `3000` | 后端服务端口 |
| `DB_PATH` | `./data/pt-rss-monitor.json` | JSON 数据文件路径 |
| `FRONTEND_DIST` | `../frontend/dist` | 前端静态文件目录 |
| `NODE_ENV` | `production` | 运行环境 |

## 主要 API

### 认证

- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/logout`
- `POST /api/auth/change-password`
- `POST /api/auth/reset-admin-password`

### RSS 源

- `GET /api/sources`
- `POST /api/sources`
- `PUT /api/sources/:id`
- `DELETE /api/sources/:id`
- `POST /api/sources/:id/fetch`
- `POST /api/sources/fetch-all`

### 站点设置

- `GET /api/sites`
- `POST /api/sites`
- `PUT /api/sites/:id`
- `DELETE /api/sites/:id`

### 资源列表

- `GET /api/resources`
- `DELETE /api/resources/:id`
- `POST /api/resources/clean`
- `POST /api/resources/clean-all`

### 我的数据

- `GET /api/user-data`
- `PUT /api/user-data/:siteId`
- `GET /api/user-data/:siteId/history`
- `POST /api/user-data/:siteId/refresh`

### 系统设置

- `GET /api/settings`
- `PUT /api/settings`
- `GET /api/settings/stats`
- `GET /api/settings/categories`
- `POST /api/settings/categories`
- `DELETE /api/settings/categories/:name`

## 数据存储

当前项目不使用 SQLite。

所有数据默认保存在 JSON 文件中：

- `backend/data/pt-rss-monitor.json`

主要数据包括：
- RSS 源
- 站点配置
- 资源列表
- 系统设置
- 用户信息
- 登录会话
- 用户数据历史

## 背景图说明

登录页背景图默认读取：

- `frontend/public/login-bg.jpg`

如果你希望登录页显示自定义背景图，把图片放到这个路径即可。
