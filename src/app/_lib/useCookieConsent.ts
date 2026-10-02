'use client';

import { useState, useEffect, useCallback } from 'react';

const COOKIE_SETTINGS_KEY = 'cookieSettings';
const BANNER_ACCEPTED_KEY = 'bannerAccepted';

export interface CookieSettings {
    analytics: boolean;
    preferences: boolean;
    thirdparty: boolean;
}

const settingsChangeListeners: Array<(settings: CookieSettings) => void> = [];

function notifyListeners(settings: CookieSettings) {
    for (const listener of settingsChangeListeners) {
        listener(settings);
    }
}

function loadSettingsFromStorage(): CookieSettings | null {
    if (typeof localStorage === 'undefined') return null;
    try {
        const raw = localStorage.getItem(COOKIE_SETTINGS_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (typeof parsed === 'object' && parsed !== null) {
            return {
                analytics: !!parsed.analytics,
                preferences: !!parsed.preferences,
                thirdparty: !!parsed.thirdparty,
            };
        }
        return null;
    } catch {
        return null;
    }
}

function saveSettingsToStorage(settings: CookieSettings) {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(COOKIE_SETTINGS_KEY, JSON.stringify(settings));
    localStorage.setItem(BANNER_ACCEPTED_KEY, 'true');
    notifyListeners(settings);
    window.dispatchEvent(new StorageEvent('storage', {
        key: COOKIE_SETTINGS_KEY,
        newValue: JSON.stringify(settings),
    }));
}

export function useCookieConsent() {
    // Server and first client render must match. Restore browser consent after mount.
    const [settings, setSettings] = useState<CookieSettings>({
        analytics: false, preferences: false, thirdparty: false,
    });

    const updateSettings = useCallback((newSettings: CookieSettings) => {
        setSettings(newSettings);
        saveSettingsToStorage(newSettings);
    }, []);

    useEffect(() => {
        const initial = loadSettingsFromStorage();
        let initialTimer: ReturnType<typeof setTimeout> | undefined;
        if (initial) {
            initialTimer = setTimeout(() => setSettings(initial), 0);
        }
        const handler = (event: StorageEvent) => {
            if (event.key === COOKIE_SETTINGS_KEY) {
                const loaded = loadSettingsFromStorage();
                if (loaded) {
                setSettings(loaded);
                }
            }
        };
        window.addEventListener('storage', handler);

        const customHandler = () => {
        const loaded = loadSettingsFromStorage();
        if (loaded) {
            setSettings(loaded);
        }
        };
        window.addEventListener('cookieSettingsChanged', customHandler);

        const listener = (s: CookieSettings) => {
            setSettings(s);
        };
        settingsChangeListeners.push(listener);

        return () => {
            if (initialTimer) clearTimeout(initialTimer);
            window.removeEventListener('storage', handler);
            window.removeEventListener('cookieSettingsChanged', customHandler);
            const idx = settingsChangeListeners.indexOf(listener);
            if (idx >= 0) settingsChangeListeners.splice(idx, 1);
        };
    }, []);

    return {
        canUseAnalytics: settings.analytics,
        canUsePreferences: settings.preferences,
        canUseThirdParty: settings.thirdparty,
        settings,
        updateSettings,
    };
}
