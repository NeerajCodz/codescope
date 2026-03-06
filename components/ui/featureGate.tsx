'use client';

import React from 'react';
import { useAnalysisStore } from '@/components/context/analysisContext';
import { Button } from '@/components/ui/button';
import { Server, Lock } from 'lucide-react';
import { AppMode } from '@/types';

interface FeatureGateProps {
  /** Mode required to access this feature */
  requires: AppMode;
  /** Feature name for the message */
  feature: string;
  /** Optional description of why this requires the mode */
  reason?: string;
  children: React.ReactNode;
}

/**
 * Wraps content that is only available in a specific mode.
 * Shows a friendly message + switch button when in the wrong mode.
 */
export function FeatureGate({ requires, feature, reason, children }: FeatureGateProps) {
  const { mode, setMode } = useAnalysisStore();

  if (mode === requires) {
    return <>{children}</>;
  }

  const isNeedAdvanced = requires === 'advanced';

  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center space-y-4 max-w-sm p-6">
          <div className="w-14 h-14 rounded-2xl bg-linear-to-br from-slate-800 to-slate-900 border border-slate-700 flex items-center justify-center mx-auto">
          {isNeedAdvanced ? (
            <Server className="w-7 h-7 text-blue-400" />
          ) : (
            <Lock className="w-7 h-7 text-emerald-400" />
          )}
        </div>

        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-foreground">
            {feature} requires {requires} mode
          </h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {reason || (isNeedAdvanced
              ? 'This feature uses server-side processing (tarball download, PostgreSQL) which is not available in simple client-side mode.'
              : 'This feature is designed for the client-side simple mode.')}
          </p>
        </div>

        <Button
          size="sm"
          className={
            isNeedAdvanced
              ? 'gap-2 bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white border-0'
              : 'gap-2 bg-linear-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white border-0'
          }
          onClick={() => setMode(requires)}
        >
          {isNeedAdvanced ? (
            <Server className="w-3.5 h-3.5" />
          ) : (
            <Lock className="w-3.5 h-3.5" />
          )}
          Switch to {requires} mode
        </Button>

        <p className="text-[10px] text-muted-foreground/50">
          You can switch back anytime from the navigation bar.
        </p>
      </div>
    </div>
  );
}
