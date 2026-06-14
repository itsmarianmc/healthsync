import type { Metadata } from 'next';
import Script from 'next/script';
import '../cookiebanner.css'

export const metadata: Metadata = {
    title: 'Login - HealthSync',
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
    return (
        <>  
            <head>
                <link rel="stylesheet" href="https://static.itsmarian.dev/fonts/font-awesome-v7.2.0/css/all.min.css" />
                <link rel="stylesheet" href="https://static.itsmarian.dev/global/variables.css" />
                <link rel="stylesheet" href="https://static.itsmarian.dev/global/colors.css" />
                <meta name="mobile-web-app-capable" content="yes" />
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
                {children}
            </body>
        </>
    );
}
