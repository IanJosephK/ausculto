import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: false,
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:5174', channel: 'msedge', viewport: { width: 1440, height: 1000 } },
  webServer: [{
    command: 'npm run dev -- --host 127.0.0.1 --port 5174',
    url: 'http://127.0.0.1:5174',
    reuseExistingServer: false,
    env: { VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '' },
  }, {
    command: 'npm run preview -- --host 127.0.0.1 --port 5175',
    url: 'http://127.0.0.1:5175',
    reuseExistingServer: false,
  }],
});
