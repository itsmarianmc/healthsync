import { resolve } from 'node:path';
import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
    testDir: '.', testMatch: 'update-manager.production.ts', workers: 1, timeout: 60_000,
    use: { ...devices['Desktop Edge'], channel: 'msedge', baseURL: 'http://127.0.0.1:3210', launchOptions: { executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe' } },
    webServer: { cwd: resolve(__dirname, '..'), command: 'node scripts/update-test-server.mjs', url: 'http://127.0.0.1:3210/dash', timeout: 90_000, reuseExistingServer: false },
});
