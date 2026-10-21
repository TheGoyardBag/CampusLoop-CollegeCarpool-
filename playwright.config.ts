import { defineConfig } from '@playwright/test';
export default defineConfig({ testDir: './tests/e2e', workers: 1, use: { baseURL: process.env.E2E_URL ?? 'http://localhost:3000', trace: 'retain-on-failure', viewport: { width: 1440, height: 1100 } }, reporter: [['list'], ['html', { open: 'never' }]] });
