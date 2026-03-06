'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function AnalysisRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const params = searchParams.toString();
    router.replace(`/analysis/scope${params ? `?${params}` : ''}`);
  }, [router, searchParams]);

  return null;
}

// Redirect /analysis → /analysis/scope preserving query params
export default function AnalysisPage() {
  return (
    <Suspense fallback={null}>
      <AnalysisRedirect />
    </Suspense>
  );
}
