import type { Metadata } from 'next';
import Script from 'next/script';

export const metadata: Metadata = {
    title: 'Login - HealthSync',
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
    return (
        <>
            {children}
            <Script
                src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"
                strategy="lazyOnload"
            />
        </>
    );
}
