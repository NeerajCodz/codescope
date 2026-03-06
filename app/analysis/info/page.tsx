'use client';

import { useEffect } from 'react';
import { useAnalysisStore } from '@/components/context/analysisContext';
import { InfoView } from '@/components/info/infoView';

export default function InfoPage() {
  const { setActiveTab } = useAnalysisStore();

  useEffect(() => {
    setActiveTab('info');
  }, [setActiveTab]);

  return <InfoView />;
}
