'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { version } from '../../../../package.json';
import { reverseGeocodeLocation } from '../../_lib/location';
import { useCookieConsent } from '../../_lib/useCookieConsent';

const WEATHER_CODE_TO_ICON: Record<number, string> = {
  0: 'fa-sun',
  1: 'fa-sun-cloud',
  2: 'fa-cloud-sun',
  3: 'fa-cloud',
  45: 'fa-smog',
  48: 'fa-smog',
  51: 'fa-cloud-drizzle',
  53: 'fa-cloud-drizzle',
  55: 'fa-cloud-drizzle',
  56: 'fa-cloud-rain',
  57: 'fa-cloud-rain',
  61: 'fa-cloud-rain',
  63: 'fa-cloud-rain',
  65: 'fa-cloud-rain',
  66: 'fa-cloud-rain',
  67: 'fa-cloud-rain',
  71: 'fa-snowflake',
  73: 'fa-snowflake',
  75: 'fa-snowflake',
  77: 'fa-snowflake',
  80: 'fa-cloud-rain',
  81: 'fa-cloud-rain',
  82: 'fa-cloud-rain',
  85: 'fa-snowflake',
  86: 'fa-snowflake',
  95: 'fa-bolt',
  96: 'fa-bolt',
  99: 'fa-bolt',
};

interface WeatherData {
  current_weather: {
    temperature: number;
    windspeed: number;
    winddirection: number;
    weathercode: number;
    time: string;
  };
}

const WEATHER_STORAGE_KEYS = {
    enabled: 'healthsync_weather_enabled',
    latitude: 'healthsync_weather_lat',
    longitude: 'healthsync_weather_lon',
    locationName: 'healthsync_weather_name',
} as const;

const LEGACY_WEATHER_KEYS: Record<string, string> = {
    enabled: 'weather_widget_enabled',
    latitude: 'weather_latitude',
    longitude: 'weather_longitude',
    locationName: 'weather_location_name',
};

function getStoredValue(key: string, fallback = ''): string {
    const value = localStorage.getItem(key);
    if (value !== null) return value;
    const legacyKey = LEGACY_WEATHER_KEYS[key];
    if (legacyKey) {
        const legacy = localStorage.getItem(legacyKey);
        if (legacy !== null) {
            localStorage.setItem(key, legacy);
            localStorage.removeItem(legacyKey);
            return legacy;
        }
    }
    return fallback;
}

function setStoredValue(key: string, value: string): void {
    localStorage.setItem(key, value);
}

export default function WeatherWidget() {
  const { canUsePreferences, canUseThirdParty } = useCookieConsent();
  const hasConsent = canUsePreferences && canUseThirdParty;

  const [enabled, setEnabled] = useState(false);
  const [weatherLat, setWeatherLat] = useState(0);
  const [weatherLon, setWeatherLon] = useState(0);
  const [weatherLocation, setWeatherLocation] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [initialized, setInitialized] = useState(false);

  const isInternalUpdate = useRef(false);
  const isFetchingWeather = useRef(false);

  useEffect(() => {
    const handleStorageChange = () => {
      if (isInternalUpdate.current) return;

      const newEnabled = getStoredValue(WEATHER_STORAGE_KEYS.enabled) === 'true';
      setEnabled(hasConsent && newEnabled);

      const newLat = parseFloat(getStoredValue(WEATHER_STORAGE_KEYS.latitude, '0'));
      if (newLat !== weatherLat) setWeatherLat(newLat);

      const newLon = parseFloat(getStoredValue(WEATHER_STORAGE_KEYS.longitude, '0'));
      if (newLon !== weatherLon) setWeatherLon(newLon);

      const newLoc = getStoredValue(WEATHER_STORAGE_KEYS.locationName);
      if (newLoc !== weatherLocation) setWeatherLocation(newLoc);

      setInitialized(false);
    };

    handleStorageChange();

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [hasConsent, weatherLat, weatherLon, weatherLocation]);

  useEffect(() => {
    if (!enabled || !hasConsent) {
      setLoading(false);
      setError(null);
      setWeatherData(null);
      setInitialized(false);
      return;
    }

    if (initialized) return;

    let cancelled = false;

    const loadLocation = async () => {
      try {
        setLoading(true);
        setError(null);

        const storedLat = parseFloat(getStoredValue(WEATHER_STORAGE_KEYS.latitude, '0'));
        const storedLon = parseFloat(getStoredValue(WEATHER_STORAGE_KEYS.longitude, '0'));
        const storedName = getStoredValue(WEATHER_STORAGE_KEYS.locationName);

        if (storedLat && storedLon && storedName) {
          if (!cancelled) {
            setWeatherLat(storedLat);
            setWeatherLon(storedLon);
            setWeatherLocation(storedName);
            setInitialized(true);
            setLoading(false);
          }
          return;
        }

        if (!navigator.geolocation) {
          throw new Error('Geolocation not supported');
        }

        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject);
        });

        const { latitude, longitude } = position.coords;
        const locationName = await reverseGeocodeLocation(latitude, longitude);

        if (cancelled) return;

        setWeatherLat(latitude);
        setWeatherLon(longitude);
        setWeatherLocation(locationName);

        isInternalUpdate.current = true;
        setStoredValue(WEATHER_STORAGE_KEYS.latitude, String(latitude));
        setStoredValue(WEATHER_STORAGE_KEYS.longitude, String(longitude));
        setStoredValue(WEATHER_STORAGE_KEYS.locationName, locationName);
        isInternalUpdate.current = false;

        setInitialized(true);
        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          setError('Failed to get location');
          setLoading(false);
        }
      }
    };

    loadLocation();

    return () => {
      cancelled = true;
    };
  }, [enabled, hasConsent, initialized]);

  useEffect(() => {
    if (!enabled || !hasConsent || !initialized || !weatherLocation) {
      return;
    }

    if (isFetchingWeather.current) return;

    let cancelled = false;

    const fetchWeather = async () => {
      isFetchingWeather.current = true;
      try {
        setLoading(true);
        setError(null);

        const params = new URLSearchParams({
          latitude: weatherLat.toString(),
          longitude: weatherLon.toString(),
          current_weather: 'true',
          timezone: 'auto',
        });

        const response = await fetch(
          `https://api.open-meteo.com/v1/forecast?${params.toString()}`
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch weather: ${response.status}`);
        }

        const data: WeatherData = await response.json();

        if (!cancelled) {
          setWeatherData(data);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Error fetching weather:', err);
          setError('Failed to load weather data');
          setWeatherData(null);
          setLoading(false);
        }
      } finally {
        isFetchingWeather.current = false;
      }
    };

    fetchWeather();

    return () => {
      cancelled = true;
    };
  }, [enabled, hasConsent, initialized, weatherLat, weatherLon, weatherLocation]);

  if (!hasConsent || !enabled) {
    return null;
  }

  if (loading) {
    return (
      <div className="dash-header">
        <div className="weather-widget">
          <div className="weather-widget-icon">
            <div className="skeleton-icon"></div>
          </div>
          <div className="weather-widget-info" style={{ gap: '5px' }}>
            <div className="skeleton-info">
              <div className="skeleton-line brand"></div>
            </div>
            <div className="weather-location">
              <div className="skeleton-line name"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="weather-widget error">
        <div className="weather-widget-icon">
          <i className="fa-solid fa-circle-exclamation" />
        </div>
        <div className="weather-widget-info">
          <div>{error}</div>
        </div>
      </div>
    );
  }

  if (!weatherData) {
    return null;
  }

  const { temperature, weathercode } = weatherData.current_weather;
  const iconClass = WEATHER_CODE_TO_ICON[weathercode] || 'fa-sun';

  return (
    <>
      <div className="dash-header">
        <div className="weather-widget">
          <div className="weather-widget-icon">
            <i className={`fa-solid ${iconClass}`} />
          </div>
          <div className="weather-widget-info">
            <div className="weather-temperature">{temperature}°C</div>
            <div className="weather-location">{weatherLocation}</div>
          </div>
        </div>
      </div>
    </>
  );
}