'use client';

import { useState, useEffect, useCallback } from 'react';

const COOKIE_SETTINGS_KEY = 'cookieSettings';
const BANNER_ACCEPTED_KEY = 'bannerAccepted';

export interface CookieSettings {
    analytics: boolean;
    preferences: boolean;
    thirdparty: boolean;
    marketing: boolean;
}

let globalSettings: CookieSettings = {
    analytics: false,
    preferences: false,
    thirdparty: false,
    marketing: false,
};

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
                marketing: !!parsed.marketing,
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
    globalSettings = settings;
    notifyListeners(settings);
    window.dispatchEvent(new StorageEvent('storage', {
        key: COOKIE_SETTINGS_KEY,
        newValue: JSON.stringify(settings),
    }));
}

export function useCookieConsent() {
    const [settings, setSettings] = useState<CookieSettings>(() => {
        const loaded = loadSettingsFromStorage();
        if (loaded) {
            globalSettings = loaded;
            return loaded;
        }
        return { analytics: false, preferences: false, thirdparty: false, marketing: false };
    });

    const updateSettings = useCallback((newSettings: CookieSettings) => {
        setSettings(newSettings);
        saveSettingsToStorage(newSettings);
    }, []);

    useEffect(() => {
        const handler = (event: StorageEvent) => {
            if (event.key === COOKIE_SETTINGS_KEY) {
                const loaded = loadSettingsFromStorage();
                if (loaded) {
                setSettings(loaded);
                globalSettings = loaded;
                }
            }
        };
        window.addEventListener('storage', handler);

        const customHandler = () => {
        const loaded = loadSettingsFromStorage();
        if (loaded) {
            setSettings(loaded);
            globalSettings = loaded;
        }
        };
        window.addEventListener('cookieSettingsChanged', customHandler);

        const listener = (s: CookieSettings) => {
            setSettings(s);
        };
        settingsChangeListeners.push(listener);

        return () => {
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
        canUseMarketing: settings.marketing,
        settings,
        updateSettings,
    };
}