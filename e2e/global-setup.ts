import { request } from '@playwright/test';

const ROUTES = ['/dash', '/food', '/drinks', '/login', '/onboarding'];

export default async function globalSetup() {
    const base = process.env.BASE_URL ?? 'http://localhost:3000';
    const ctx = await request.newContext();
    try {
        for (const path of ROUTES) {
            await ctx.get(`${base}${path}`, { timeout: 120_000 });
        }
    } finally {
        await ctx.dispose();
    }
}
