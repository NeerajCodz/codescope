'use client';

import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
    ChevronLeft,
    Download,
    Settings,
    Share2,
    GitPullRequest,
    Github,
    Shield,
    Info,
    Layout
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAnalysisStore } from '@/components/context/analysis-context';
import { Badge } from '@/components/ui/badge';
import { ExportModal } from '@/components/modals/export-modal';
import { PRModal } from '@/components/modals/pr-modal';
import { PrivacyModal } from '@/components/modals/privacy-modal';

export function Header() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const repo = searchParams.get('repo') || '';
    const { data, loading } = useAnalysisStore();

    const [showExport, setShowExport] = useState(false);
    const [showPR, setShowPR] = useState(false);
    const [showPrivacy, setShowPrivacy] = useState(false);

    const handleBack = () => {
        router.push('/');
    };

    return (
        <header className="h-14 border-b border-border bg-card/80 backdrop-blur-md flex items-center px-4 justify-between shrink-0 sticky top-0 z-50">
            <div className="flex items-center gap-4">
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleBack}
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                >
                    <ChevronLeft className="w-4 h-4" />
                </Button>

                <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-lg shadow-blue-500/20">
                        CM
                    </div>
                    <div className="flex flex-col">
                        <h1 className="text-sm font-semibold flex items-center gap-2 text-slate-200">
                            {repo.split("/").pop() || "Repository Analysis"}
                            {data && (
                                <Badge variant="secondary" className="text-[10px] h-4 px-1.5 font-normal bg-blue-500/10 text-blue-400 border-blue-500/20">
                                    {data.stats.files} files
                                </Badge>
                            )}
                        </h1>
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1 opacity-70">
                            <Github className="w-3 h-3" />
                            {repo}
                        </span>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs gap-2 bg-blue-500/5 border-blue-500/20 hover:bg-blue-500/10 text-blue-400"
                    disabled={loading || !data}
                    onClick={() => setShowPR(true)}
                >
                    <GitPullRequest className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">PR Impact</span>
                </Button>

                <div className="h-4 w-px bg-border mx-1" />

                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" title="Export Analysis" onClick={() => setShowExport(true)}>
                    <Download className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" title="Share">
                    <Share2 className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" title="Privacy Settings" onClick={() => setShowPrivacy(true)}>
                    <Shield className="w-4 h-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" title="Settings">
                    <Settings className="w-4 h-4" />
                </Button>
            </div>

            <ExportModal open={showExport} onOpenChange={setShowExport} />
            <PRModal open={showPR} onOpenChange={setShowPR} />
            <PrivacyModal open={showPrivacy} onOpenChange={setShowPrivacy} />
        </header>
    );
}
