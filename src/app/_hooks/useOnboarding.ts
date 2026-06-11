'use client';

import { useState, useEffect } from 'react';

const STORAGE_KEY = 'calsync_onboarding_done';

export function useOnboarding() {
  const [shouldShow, setShouldShow] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const isDone = localStorage.getItem(STORAGE_KEY) === '1';
    if (!isDone) setShouldShow(true);
    setDone(isDone);
  }, []);

  const finishOnboarding = () => {
    localStorage.setItem(STORAGE_KEY, '1');
    setShouldShow(false);
    setDone(true);
  };

  const startOnboarding = () => setShouldShow(true);

  return { shouldShow, done, finishOnboarding, startOnboarding };
}
