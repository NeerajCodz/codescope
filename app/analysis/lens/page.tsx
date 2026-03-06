'use client';

import { useEffect } from 'react';
import { useAnalysisStore } from '@/components/context/analysisContext';
import { LensView } from '@/components/lens/lensView';

export default function LensPage() {
  const { setActiveTab } = useAnalysisStore();

  useEffect(() => {
    setActiveTab('lens');
  }, [setActiveTab]);

  return <LensView />;
}
