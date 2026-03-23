import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import cron from 'node-cron';
import { readFileSync, existsSync } from 'fs';
import { resolve, join } from 'path';
import rss from './routes/rss.js';
import resource from './routes/resource.js';
import settings from './routes/settings.js';
import { fetchAllSources } from './services/fetcher.js';
import db from './db.js';

const app = new Hono();

// CORS
app.use('*', cors());

// Serve static frontend files in production
<<<<<<< HEAD
const frontendDist = process.env.FRONTEND_DIST || '../frontend-dist';
=======
const frontendDist = process.env.FRONTEND_DIST || '../frontend/dist';
>>>>>>> b3b2b8ce71669aa78e478944f8439346c72c5bd9
const frontendDistPath = resolve(frontendDist);

if (existsSync(frontendDistPath)) {
  app.use('*', serveStatic({
    root: frontendDistPath,
    rewriteRequestPath: (path) => {
      if (path === '/') return '/index.html';
      return path;
    },
  }));
  console.log(`Serving frontend from ${frontendDistPath}`);
}

// API Routes
app.route('/api/sources', rss);
app.route('/api/resources', resource);
app.route('/api/settings', settings);

// Health check
app.get('/api/health', (c) => c.json({ status: 'ok' }));

// Serve index.html for non-API routes (SPA fallback)
app.notFound((c) => {
  const indexPath = join(frontendDistPath, 'index.html');
  if (existsSync(indexPath)) {
    return c.html(readFileSync(indexPath, 'utf-8'));
  }
  return c.json({ error: 'Not found' }, 404);
});

// Initialize cron job
function initCron() {
  // Get global fetch interval from settings
  const row = db.prepare("SELECT value FROM settings WHERE key = 'global_fetch_interval'").get() as { value: string } | undefined;
  const intervalMinutes = row ? parseInt(row.value, 10) : 30;
<<<<<<< HEAD

  // Schedule fetch every N minutes
  const cronExpression = `*/${intervalMinutes} * * * *`;
=======
  const validInterval = isNaN(intervalMinutes) ? 30 : intervalMinutes;

  // Schedule fetch every N minutes
  const cronExpression = `*/${validInterval} * * * *`;
>>>>>>> b3b2b8ce71669aa78e478944f8439346c72c5bd9

  cron.schedule(cronExpression, async () => {
    console.log(`[Cron] Starting scheduled fetch at ${new Date().toISOString()}`);

    // Check if auto-fetch is enabled
    const autoFetchRow = db.prepare("SELECT value FROM settings WHERE key = 'auto_fetch_enabled'").get() as { value: string } | undefined;
    const autoFetchEnabled = autoFetchRow ? autoFetchRow.value === 'true' : true;

    if (autoFetchEnabled) {
      await fetchAllSources();
      console.log(`[Cron] Fetch completed at ${new Date().toISOString()}`);
    } else {
      console.log(`[Cron] Auto-fetch is disabled, skipping`);
    }
  });

<<<<<<< HEAD
  console.log(`[Cron] Scheduled fetch every ${intervalMinutes} minutes`);
=======
  console.log(`[Cron] Scheduled fetch every ${validInterval} minutes`);
>>>>>>> b3b2b8ce71669aa78e478944f8439346c72c5bd9
}

// Start server
const port = parseInt(process.env.PORT || '3000', 10);

console.log(`Starting PT RSS Monitor Backend on port ${port}`);
initCron();

serve({
  fetch: app.fetch,
  port,
});

console.log(`Server running on http://localhost:${port}`);
