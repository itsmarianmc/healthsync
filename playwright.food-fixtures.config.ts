import { defineConfig } from '@playwright/test';
import config from './playwright.config';

// Same components in the existing isolated app fixture; no Next server or real cloud.
process.env.HEALTHSYNC_FOOD_FIXTURE = '1';
export default defineConfig({
    ...config,
    globalSetup: undefined,
    webServer: undefined,
    testMatch: ['saved-foods.spec.ts', 'ai-workspaces.spec.ts'],
});
