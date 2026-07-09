import type { Metadata, Viewport } from 'next';
import { DM_Sans } from 'next/font/google';
import Script from 'next/script';
import './styles.css';
import './cookiebanner.css'
import { AuthProvider } from './_context/AuthContext';
import { AppShellProvider } from './_context/AppShellContext';
import CookieBanner from '@/app/_components/shared/CookieBanner'
import AppShell from './_components/AppShell';
import Tooltip from './_components/onboarding/Tooltip';

const dmSans = DM_Sans({
    subsets: ['latin'],
    weight: ['300', '400', '500', '600'],
    style: ['normal', 'italic'],
    display: 'swap',
});

export const metadata: Metadata = {
    title: 'HealthSync - Calorie, Drink & Workout Tracker',
    description: 'Track your daily calories, protein, carbs and fat with HealthSync. Log food by name, barcode or AI photo detection. Sync your data across devices - free and easy.',
    manifest: '/manifest.json',
    applicationName: 'HealthSync',
    appleWebApp: { title: 'HealthSync', capable: true, statusBarStyle: 'black-translucent' },
    keywords: ['calorie tracker', 'food log', 'nutrition tracker', 'barcode scanner', 'AI food detection'],
    openGraph: {
        type: 'website',
        title: 'HealthSync - Calorie, Drink & Workout Tracker',
        description: 'Track your daily calories, protein, carbs and fat. Log food by name, barcode or AI photo. Sync across devices.',
        url: 'https://projects.itsmarian.dev/healthsync/',
    },
};

export const viewport: Viewport = {
    themeColor: '#0F0F10',
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
    return (
        <html lang="en">
            <head>
                <link rel="stylesheet" href="https://static.itsmarian.dev/fonts/font-awesome-v7.2.0/css/all.min.css" />
                <link rel="stylesheet" href="https://static.itsmarian.dev/global/variables.css" />
                <link rel="stylesheet" href="https://static.itsmarian.dev/global/colors.css" />
                <meta name="mobile-web-app-capable" content="yes" />
                <link rel="icon" href="/favicon.ico" sizes="any" />
                <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
                <Script
                    src="https://www.googletagmanager.com/gtag/js?id=G-EHN4P1ET7W"
                    strategy="lazyOnload"
                />
                <Script id="google-analytics" strategy="lazyOnload">
                    {`
                        window.dataLayer = window.dataLayer || [];
                        function gtag(){dataLayer.push(arguments);}
                        gtag('js', new Date());
                        gtag('consent', 'default', {
                            'ad_storage': 'denied',
                            'ad_user_data': 'denied',
                            'ad_personalization': 'denied',
                            'analytics_storage': 'denied',
                            'functionality_storage': 'denied',
                            'personalization_storage': 'denied',
                            'security_storage': 'granted'
                        });
                    `}
                </Script>
            </head>
            <body suppressHydrationWarning>
                <Script
                    id="splash-screen-init"
                    strategy="beforeInteractive"
                    dangerouslySetInnerHTML={{
                        __html: `(() => {
                            try {
                                var KEY = 'calsync_splash_enabled';
                                var ID = '__hs_splash';
                                var DURATION = 1400;
                                var FADE = 320;
                                var hideTimer = null;
                                var ensured = false;

                                function isEnabled() { try { return localStorage.getItem(KEY) === 'true'; } catch (e) { return false; } }

                                function ensureStyles() {
                                if (document.getElementById('__hs_splash_style')) return;
                                var s = document.createElement('style');
                                s.id = '__hs_splash_style';
                                s.textContent = '#' + ID + '{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:#0F0F10;z-index:99999;opacity:1;transition:opacity ' + FADE + 'ms ease-out;pointer-events:auto;}'
                                    + '#' + ID + '.h{opacity:0;pointer-events:none;}'
                                    + '#' + ID + ' img{width:128px;height:128px;border-radius:24px;animation:__hsP 1.5s ease-in-out infinite alternate;}'
                                    + '@keyframes __hsP{from{transform:scale(1);opacity:1}to{transform:scale(1.08);opacity:.85}}';
                                (document.head || document.documentElement).appendChild(s);
                                }

                                function getOrCreate() {
                                var el = document.getElementById(ID);
                                if (el) return el;
                                ensureStyles();
                                el = document.createElement('div');
                                el.id = ID;
                                el.setAttribute('aria-hidden', 'true');
                                var img = document.createElement('img');
                                img.src = '/favicon.png';
                                img.alt = '';
                                el.appendChild(img);
                                var parent = document.body || document.documentElement;
                                parent.appendChild(el);
                                return el;
                                }

                                function show(autoHide) {
                                if (!isEnabled()) return;
                                var el = getOrCreate();
                                el.classList.remove('h');
                                if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
                                if (autoHide) hideTimer = setTimeout(hide, DURATION);
                                }

                                function hide() {
                                var el = document.getElementById(ID);
                                if (!el) return;
                                el.classList.add('h');
                                setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, FADE + 20);
                                }

                                function ensureInitial() {
                                if (ensured) return;
                                ensured = true;
                                if (!isEnabled()) return;
                                if (document.body) show(true);
                                else document.addEventListener('DOMContentLoaded', function () { show(true); }, { once: true });
                                }

                                ensureInitial();

                                document.addEventListener('visibilitychange', function () {
                                if (document.visibilityState === 'hidden') {
                                    show(false);
                                } else {
                                    show(true);
                                }
                                });

                                window.addEventListener('pagehide', function () { show(false); });
                            } catch (e) {}
                        })();`,
                    }}
                />
                <AuthProvider>
                    <AppShellProvider>
                        <AppShell>
                            {children}
                        </AppShell>
                    </AppShellProvider>
                </AuthProvider>
                <Tooltip />
                <CookieBanner />
                <Script 
                    src="https://unpkg.com/@zxing/browser@latest" 
                    strategy="afterInteractive" 
                />
            </body>
        </html>
    );
}
