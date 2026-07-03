'use client';

import { useEffect, useState } from 'react';
import { version } from '../../../../package.json';
import { reverseGeocodeLocation } from '../../_lib/location';

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
  enabled: ['healthsync_weather_enabled', 'weather_widget_enabled'],
  latitude: ['healthsync_weather_lat', 'weather_latitude'],
  longitude: ['healthsync_weather_lon', 'weather_longitude'],
  locationName: ['healthsync_weather_name', 'weather_location_name'],
} as const;

function getStoredValue(keys: readonly string[], fallback = ''): string {
  for (const key of keys) {
    const value = localStorage.getItem(key);
    if (value !== null) {
      return value;
    }
  }
  return fallback;
}

function setStoredValue(keys: readonly string[], value: string): void {
  for (const key of keys) {
    localStorage.setItem(key, value);
  }
}

export default function WeatherWidget() {
  const [enabled, setEnabled] = useState(() => {
    if (typeof window === 'undefined') return false;
    return getStoredValue(WEATHER_STORAGE_KEYS.enabled) === 'true';
  });
  const [weatherLat, setWeatherLat] = useState(() => {
    if (typeof window === 'undefined') return 0;
    return parseFloat(getStoredValue(WEATHER_STORAGE_KEYS.latitude, '52.5200'));
  });
  const [weatherLon, setWeatherLon] = useState(() => {
    if (typeof window === 'undefined') return 0;
    return parseFloat(getStoredValue(WEATHER_STORAGE_KEYS.longitude, '13.4050'));
  });
  const [weatherLocation, setWeatherLocation] = useState(() => {
    if (typeof window === 'undefined') return '';
    return getStoredValue(WEATHER_STORAGE_KEYS.locationName);
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);

  useEffect(() => {
    const handleStorageChange = () => {
      setEnabled(getStoredValue(WEATHER_STORAGE_KEYS.enabled) === 'true');
      setWeatherLat(parseFloat(getStoredValue(WEATHER_STORAGE_KEYS.latitude, '52.5200')));
      setWeatherLon(parseFloat(getStoredValue(WEATHER_STORAGE_KEYS.longitude, '13.4050')));
      setWeatherLocation(getStoredValue(WEATHER_STORAGE_KEYS.locationName));
    };

    handleStorageChange();

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const getUserLocation = async () => {
    try {
      if (!navigator.geolocation) {
        throw new Error('Geolocation not supported');
      }

      const position = await new Promise<{ latitude: number; longitude: number }>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            resolve({
              latitude: pos.coords.latitude,
              longitude: pos.coords.longitude,
            });
          },
          (error) => {
            reject(error);
          }
        );
      });

      return position;
    } catch (error) {
      throw error;
    }
  };

  const handleUseLocation = async () => {
    try {
      const position = await getUserLocation();

      const locationName = await reverseGeocodeLocation(position.latitude, position.longitude);
      setWeatherLocation(locationName);
      setStoredValue(WEATHER_STORAGE_KEYS.locationName, locationName);
      setWeatherLat(position.latitude);
      setWeatherLon(position.longitude);
    } catch (err) {
      console.error('Error getting location:', err);
      setError('Failed to get your location');
    }
  };

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      setError(null);
      setWeatherData(null);
      return;
    }

    if (!weatherLocation) {
      getUserLocation()
        .then(async ({ latitude, longitude }) => {
          setWeatherLat(latitude);
          setWeatherLon(longitude);

          const locationName = await reverseGeocodeLocation(latitude, longitude);
          setWeatherLocation(locationName);
          setStoredValue(WEATHER_STORAGE_KEYS.locationName, locationName);
          setStoredValue(WEATHER_STORAGE_KEYS.latitude, latitude.toString());
          setStoredValue(WEATHER_STORAGE_KEYS.longitude, longitude.toString());
          console.info('Reverse geocoded user location', {
            latitude,
            longitude,
            locationName,
          });
        })
        .catch((err) => {
          console.warn('Unable to get user location:', err);
        });
    }

    const fetchWeather = async () => {
      try {
        setLoading(true);
        setError(null);

        const lat = weatherLat;
        const lon = weatherLon;

        const params = new URLSearchParams({
          latitude: lat.toString(),
          longitude: lon.toString(),
          current_weather: 'true',
          timezone: 'auto',
        });

        const response = await fetch(
          `https://api.itsmarian.dev/api/proxy?type=weather&path=/v1/forecast&${params.toString()}`,
          {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch weather: ${response.status}`);
        }

        const data: WeatherData = await response.json();
        setWeatherData(data);

        if (weatherLocation) {
          setWeatherLocation(weatherLocation);
        } else {
          setWeatherLocation(`${lat.toFixed(2)}, ${lon.toFixed(2)}`);
        }
      } catch (err) {
        console.error('Error fetching weather:', err);
        setError('Failed to load weather data');
        setWeatherData(null);
      } finally {
        setLoading(false);
      }
    };

    fetchWeather();
  }, [enabled, weatherLat, weatherLon, weatherLocation]);

  if (!enabled) {
    return null;
  }

  if (loading) {
    return (
      <div className="dash-header">
        <div className="weather-widget">
          <div className="weather-widget-icon">
            <div className="skeleton-icon"></div>
          </div>
          <div className="weather-widget-info" style={ { gap: '5px'}}>
            <div className="skeleton-info" >
              <div className="skeleton-line brand"></div>
            </div>
            <div className="weather-location">Loading...</div>
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