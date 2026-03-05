'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Upload, FileJson, Loader2, ArrowRight } from 'lucide-react';

interface CodespaceImportProps {
  onImport: (file: File) => void;
  loading?: boolean;
  error?: string | null;
}

export function CodespaceImport({ onImport, loading, error }: CodespaceImportProps) {
  const [localFile, setLocalFile] = useState<File | null>(null);

  const handlePick = (file?: File) => {
    if (!file) return;
    setLocalFile(file);
  };

  const handleSubmit = () => {
    if (localFile) onImport(localFile);
  };

  return (
    <div className="space-y-4">
      {/* Info banner */}
      <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-3 space-y-1">
        <div className="flex items-center gap-2">
          <FileJson className="w-3.5 h-3.5 text-purple-400" />
          <span className="text-xs font-semibold text-purple-300">Import Analysis</span>
          <Badge variant="outline" className="text-[9px] h-4 border-purple-500/30 text-purple-400">
            JSON
          </Badge>
        </div>
        <p className="text-[10px] text-purple-300/70 leading-relaxed">
          Load a previously exported CodeScope analysis JSON file.
          Instantly restores the full analysis without re-fetching from GitHub.
        </p>
      </div>

      {/* File picker */}
      <div className="space-y-3">
        <input
          id="codespace-import-file"
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => handlePick(e.target.files?.[0])}
        />

        <button
          type="button"
          onClick={() => document.getElementById('codespace-import-file')?.click()}
          className="w-full h-24 rounded-lg border-2 border-dashed border-border/60 hover:border-purple-500/40 bg-background/30 hover:bg-purple-500/5 transition-all flex flex-col items-center justify-center gap-2 cursor-pointer group"
        >
          <Upload className="w-5 h-5 text-muted-foreground group-hover:text-purple-400 transition-colors" />
          <span className="text-xs text-muted-foreground group-hover:text-purple-300 transition-colors">
            {localFile ? localFile.name : 'Click to select JSON file'}
          </span>
          {localFile && (
            <span className="text-[10px] text-muted-foreground/50">
              {(localFile.size / 1024).toFixed(1)} KB
            </span>
          )}
        </button>

        {error && (
          <p className="text-xs text-destructive bg-destructive/10 rounded p-2">{error}</p>
        )}
      </div>

      {/* Submit */}
      <Button
        type="button"
        onClick={handleSubmit}
        disabled={!localFile || loading}
        className="w-full h-10 text-sm gap-2 bg-linear-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 text-white border-0"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Importing...
          </>
        ) : (
          <>
            Import Analysis
            <ArrowRight className="w-4 h-4" />
          </>
        )}
      </Button>
    </div>
  );
}
