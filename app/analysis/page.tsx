'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Header } from '@/components/analysis/header';
import { Sidebar } from '@/components/analysis/sidebar';
import { Canvas } from '@/components/analysis/canvas';
import { RightPanel } from '@/components/analysis/right-panel';
import { AnalysisLoading } from '@/components/analysis/loading';
import { useAnalysisStore } from '@/components/context/analysis-context';
import { analyzeRepository } from '@/lib/analyzer';
import { RateLimitModal } from '@/components/modals/rate-limit-modal';
import { useToast } from '@/components/ui/use-toast';

export default function AnalysisPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { data, loading, setData, setLoading, setError } = useAnalysisStore();
    const [showRateLimit, setShowRateLimit] = useState(false);
    const [currentStep, setCurrentStep] = useState('init');
    const [progress, setProgress] = useState(0);
    const [currentFile, setCurrentFile] = useState('');
    const { toast } = useToast();

    const handleAnalysis = async (tokenOverride?: string) => {
        const importFlag = searchParams.get('import');
        if (importFlag) {
            const imported = sessionStorage.getItem('analysis_import');
            if (imported) {
                try {
                    const importedData = JSON.parse(imported);
                    setData(importedData);
                    setError(null);
                    setLoading(false);
                    toast({
                        title: 'Imported analysis',
                        description: 'Loaded from JSON file',
                    });
                    return;
                } catch (e) {
                    sessionStorage.removeItem('analysis_import');
                }
            }
        }

        const repo = searchParams.get('repo');
        const token = tokenOverride || searchParams.get('token');

        if (!repo) {
            router.push('/');
            return;
        }

        // Check cache first (session-based)
        const cacheKey = `analysis_${repo}_${token || 'public'}`;
        const cached = sessionStorage.getItem(cacheKey);
        
        if (cached) {
            try {
                const cachedData = JSON.parse(cached);
                setData(cachedData);
                toast({
                    title: "Loaded from cache",
                    description: "Using previously analyzed data",
                });
                return;
            } catch (e) {
                // Invalid cache, proceed with fresh analysis
                sessionStorage.removeItem(cacheKey);
            }
        }

        try {
            setLoading(true);
            setError(null);
            
            // Simulate detailed progress steps
            setCurrentStep('init');
            await new Promise(resolve => setTimeout(resolve, 300));
            
            setCurrentStep('rateLimit');
            setProgress(10);
            await new Promise(resolve => setTimeout(resolve, 300));
            
            setCurrentStep('scanning');
            setProgress(20);
            
            const data = await analyzeRepository(repo, token || undefined, (step, file) => {
                setCurrentStep(step);
                setCurrentFile(file || '');
                setProgress(prev => Math.min(prev + 5, 95));
            });
            
            setCurrentStep('complete');
            setProgress(100);
            setData(data);
            
            // Cache the analysis result
            try {
                sessionStorage.setItem(cacheKey, JSON.stringify(data));
            } catch (e) {
                // Cache storage failed (quota exceeded), continue anyway
                console.warn('Failed to cache analysis data:', e);
            }
        } catch (err: any) {
            const message = err.message || 'Failed to analyze repository';

            // Check for rate limit
            if (message.includes('Rate limited') || message.includes('403') || message.includes('429')) {
                setShowRateLimit(true);
                setError('Rate limit exceeded. Please provide a token.');
            } else {
                setError(message);
                toast({
                    variant: "destructive",
                    title: "Analysis Failed",
                    description: message,
                });
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        handleAnalysis();
    }, [searchParams]);

    const handleTokenSubmit = (token: string) => {
        handleAnalysis(token);
    };

    // Show loading screen while analyzing
    if (loading || !data) {
        return <AnalysisLoading currentStep={currentStep} progress={progress} fileName={currentFile} />;
    }

    return (
        <div className="flex flex-col h-screen bg-background">
            <Header />
            <div className="flex flex-1 overflow-hidden">
                <Sidebar />
                <Canvas />
                <RightPanel />
            </div>
            <RateLimitModal
                open={showRateLimit}
                onOpenChange={setShowRateLimit}
                onTokenSubmit={handleTokenSubmit}
            />
        </div>
    );
}
