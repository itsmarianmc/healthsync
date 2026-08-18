import type { MetadataRoute } from 'next';

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://healthsync.itsmarian.dev';

export default function sitemap(): MetadataRoute.Sitemap {
    const now = new Date();
    const routes: { path: string; priority: number; changeFrequency: 'weekly' | 'monthly' | 'yearly' }[] = [
        { path: '', priority: 1, changeFrequency: 'weekly' },
        { path: '/dash', priority: 0.8, changeFrequency: 'weekly' },
        { path: '/food', priority: 0.8, changeFrequency: 'weekly' },
        { path: '/drinks', priority: 0.8, changeFrequency: 'weekly' },
        { path: '/support', priority: 0.5, changeFrequency: 'monthly' },
        { path: '/legal/privacy', priority: 0.3, changeFrequency: 'yearly' },
        { path: '/legal/cookies', priority: 0.3, changeFrequency: 'yearly' },
        { path: '/legal/terms', priority: 0.3, changeFrequency: 'yearly' },
        { path: '/legal/ai-guidelines', priority: 0.3, changeFrequency: 'yearly' },
    ];

    return routes.map(({ path, priority, changeFrequency }) => ({
        url: `${baseUrl}${path}`,
        lastModified: now,
        changeFrequency,
        priority,
    }));
}