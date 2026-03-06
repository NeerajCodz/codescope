'use client';

import { useEffect } from 'react';
import { useAnalysisStore } from '@/components/context/analysisContext';
import { MCPView } from '@/components/mcp/mcpView';

export default function MCPPage() {
  const { setActiveTab } = useAnalysisStore();

  useEffect(() => {
    setActiveTab('mcp');
  }, [setActiveTab]);

  return <MCPView />;
}
