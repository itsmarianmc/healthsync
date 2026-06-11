'use client';

import { Suspense, useEffect, useRef } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import CalSync from '@/app/_components/calsync/CalSync';
import { useAppShell } from '@/app/_context/AppShellContext';
import { visitedRoutes } from '@/app/_lib/visitedRoutes';

function FoodPageContent() {
  const { openSettings } = useAppShell();
  const searchParams = useSearchParams();
  const router = useRouter();
  const nfl = useRef(visitedRoutes.has('food'));

  const openModal = searchParams.get('openModal') === 'true';
  const mode = searchParams.get('mode') as 'describe' | 'import' | 'capture' | null;
  const barcode = searchParams.get('barcode');

  useEffect(() => {
    visitedRoutes.add('food');
  }, []);

  // Clean URL params after consuming them so modal doesn't re-trigger on next visit
  useEffect(() => {
    if (openModal) {
      router.replace('/food', { scroll: false });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <CalSync
      nfl={nfl.current}
      onOpenSettings={openSettings}
      openModal={openModal}
      openWithAi={mode}
      openWithBarcodeValue={barcode}
    />
  );
}

export default function FoodPage() {
  return (
    <Suspense>
      <FoodPageContent />
    </Suspense>
  );
}
