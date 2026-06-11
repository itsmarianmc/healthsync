import type { Metadata, Viewport } from 'next';
import { DM_Sans } from 'next/font/google';
import Script from 'next/script';
import './styles.css';
import { AuthProvider } from './_context/AuthContext';
import { AppShellProvider } from './_context/AppShellContext';
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
      </head>
      <body suppressHydrationWarning>
        <AuthProvider>
          <AppShellProvider>
            <AppShell>
              {children}
            </AppShell>
          </AppShellProvider>
        </AuthProvider>
        <Tooltip />
        <Script 
          src="https://unpkg.com/@zxing/browser@latest" 
          strategy="afterInteractive" 
        />
      </body>
    </html>
  );
}
