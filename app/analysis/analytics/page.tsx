'use client';

import { useEffect } from 'react';
import { useAnalysisStore } from '@/components/context/analysisContext';
import { AnalyticsView } from '@/components/analytics/analyticsView';

export default function AnalyticsPage() {
  const { setActiveTab } = useAnalysisStore();

  useEffect(() => {
    setActiveTab('analytics');
  }, [setActiveTab]);

  return <AnalyticsView />;
}
