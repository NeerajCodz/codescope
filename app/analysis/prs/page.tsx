'use client';

import { useEffect } from 'react';
import { useAnalysisStore } from '@/components/context/analysisContext';
import { PRsView } from '@/components/prs/prsView';

export default function PRsPage() {
  const { setActiveTab } = useAnalysisStore();

  useEffect(() => {
    setActiveTab('prs');
  }, [setActiveTab]);

  return <PRsView />;
}
