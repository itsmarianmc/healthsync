export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_ID || 'G-EHN4P1ET7W';

declare global {
    interface Window {
        gtag: (...args: unknown[]) => void;
    }
}
