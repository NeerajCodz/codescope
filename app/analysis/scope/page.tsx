'use client';

import { Sidebar } from '@/components/analysis/sidebar';
import { Canvas } from '@/components/analysis/canvas';
import { useAnalysisStore } from '@/components/context/analysisContext';
import { useEffect } from 'react';

export default function ScopePage() {
  const { setActiveTab } = useAnalysisStore();

  useEffect(() => {
    setActiveTab('scope');
  }, [setActiveTab]);

  return (
    <div className="flex flex-1 overflow-hidden h-full">
      <Sidebar />
      <Canvas />
    </div>
  );
}
