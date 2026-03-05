'use client';

import { useEffect } from 'react';
import { useAnalysisStore } from '@/components/context/analysisContext';
import { APIView } from '@/components/api/apiView';
import { FeatureGate } from '@/components/ui/featureGate';

export default function APIPage() {
  const { setActiveTab } = useAnalysisStore();

  useEffect(() => {
    setActiveTab('api');
  }, [setActiveTab]);

  return (
    <FeatureGate
      requires="advanced"
      feature="API Analysis"
      reason="API endpoint detection and REST/GraphQL analysis require server-side tarball extraction and deep parsing."
    >
      <APIView />
    </FeatureGate>
  );
}
