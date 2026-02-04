'use client';

import { useEffect, useState } from 'react';
import { Loader2, CheckCircle2, Circle } from 'lucide-react';
import theme from '@/utils/themes';

interface LoadingStep {
    id: string;
    label: string;
    status: 'pending' | 'active' | 'complete' | 'error';
    progress?: number;
}

interface AnalysisLoadingProps {
    currentStep?: string;
    progress?: number;
    fileName?: string;
}

const initialSteps: LoadingStep[] = [
    { id: 'init', label: 'Initializing analysis', status: 'pending' },
    { id: 'rateLimit', label: 'Checking API rate limits', status: 'pending' },
    { id: 'scanning', label: 'Scanning repository structure', status: 'pending' },
    { id: 'fetching', label: 'Fetching file contents', status: 'pending' },
    { id: 'parsing', label: 'Parsing source code', status: 'pending' },
    { id: 'analyzing', label: 'Analyzing dependencies', status: 'pending' },
    { id: 'functions', label: 'Extracting function calls', status: 'pending' },
    { id: 'complexity', label: 'Calculating complexity', status: 'pending' },
    { id: 'security', label: 'Checking security issues', status: 'pending' },
    { id: 'patterns', label: 'Detecting design patterns', status: 'pending' },
    { id: 'building', label: 'Building dependency graph', status: 'pending' },
    { id: 'brushing', label: 'Brushing up final details', status: 'pending' },
    { id: 'complete', label: 'Analysis complete', status: 'pending' },
];

export function AnalysisLoading({ currentStep, progress = 0, fileName }: AnalysisLoadingProps) {
    const [steps, setSteps] = useState<LoadingStep[]>(initialSteps);
    const [currentFileIndex, setCurrentFileIndex] = useState(0);
    const [totalFiles, setTotalFiles] = useState(0);

    useEffect(() => {
        if (currentStep) {
            setSteps(prev => {
                const newSteps = [...prev];
                const currentIndex = newSteps.findIndex(s => s.id === currentStep);
                
                newSteps.forEach((step, idx) => {
                    if (idx < currentIndex) {
                        step.status = 'complete';
                    } else if (idx === currentIndex) {
                        step.status = 'active';
                        step.progress = progress;
                    } else {
                        step.status = 'pending';
                    }
                });
                
                return newSteps;
            });
        }
    }, [currentStep, progress]);

    const overallProgress = steps.filter(s => s.status === 'complete').length / steps.length * 100;

    return (
        <div className="min-h-screen flex items-center justify-center p-4" style={{ background: theme.colors.background.darker }}>
            <div className="w-full max-w-2xl space-y-6">
                {/* Header */}
                <div className="text-center space-y-2">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4" 
                         style={{ 
                             background: theme.colors.visualization.background.folder,
                             border: `2px solid ${theme.colors.border.accent}`
                         }}>
                        <Loader2 className="w-8 h-8 animate-spin" style={{ color: theme.colors.primary.cyan['500'] }} />
                    </div>
                    <h2 className="text-2xl font-bold" style={{ color: theme.colors.text.primary }}>
                        Analyzing Repository
                    </h2>
                    <p className="text-sm" style={{ color: theme.colors.text.secondary }}>
                        This may take a few moments depending on repository size
                    </p>
                </div>

                {/* Overall Progress Bar */}
                <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                        <span style={{ color: theme.colors.text.secondary }}>Overall Progress</span>
                        <span style={{ color: theme.colors.text.accent }}>{Math.round(overallProgress)}%</span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: theme.colors.background.card }}>
                        <div 
                            className="h-full transition-all duration-500 ease-out"
                            style={{ 
                                width: `${overallProgress}%`,
                                background: `linear-gradient(to right, ${theme.colors.primary.cyan['500']}, ${theme.colors.primary.blue['500']})`
                            }}
                        />
                    </div>
                </div>

                {/* Current File */}
                {fileName && (
                    <div className="p-4 rounded-lg" style={{ 
                        background: theme.colors.background.card,
                        borderLeft: `3px solid ${theme.colors.primary.cyan['500']}`
                    }}>
                        <div className="flex items-center gap-2">
                            <Circle className="w-2 h-2 animate-pulse" style={{ fill: theme.colors.primary.cyan['500'], color: theme.colors.primary.cyan['500'] }} />
                            <span className="text-sm" style={{ color: theme.colors.text.secondary }}>
                                Analyzing: <span style={{ color: theme.colors.text.primary }}>{fileName}</span>
                            </span>
                        </div>
                    </div>
                )}

                {/* Steps List */}
                <div className="space-y-2 p-6 rounded-lg" style={{ background: theme.colors.background.card }}>
                    {steps.map((step, idx) => (
                        <div key={step.id} className="flex items-center gap-3 py-2">
                            {/* Status Icon */}
                            <div className="flex-shrink-0">
                                {step.status === 'complete' ? (
                                    <CheckCircle2 className="w-5 h-5" style={{ color: theme.colors.status.success }} />
                                ) : step.status === 'active' ? (
                                    <Loader2 className="w-5 h-5 animate-spin" style={{ color: theme.colors.primary.cyan['500'] }} />
                                ) : (
                                    <Circle className="w-5 h-5" style={{ color: theme.colors.text.muted }} />
                                )}
                            </div>

                            {/* Label */}
                            <div className="flex-1">
                                <p className={`text-sm ${step.status === 'active' ? 'font-medium' : ''}`}
                                   style={{ 
                                       color: step.status === 'complete' 
                                           ? theme.colors.text.secondary
                                           : step.status === 'active'
                                               ? theme.colors.text.accent
                                               : theme.colors.text.muted
                                   }}>
                                    {step.label}
                                </p>

                                {/* Step Progress Bar */}
                                {step.status === 'active' && step.progress !== undefined && (
                                    <div className="mt-1 h-1 rounded-full overflow-hidden" style={{ background: theme.colors.background.dark }}>
                                        <div 
                                            className="h-full transition-all duration-300"
                                            style={{ 
                                                width: `${step.progress}%`,
                                                background: theme.colors.primary.cyan['500']
                                            }}
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Step Number */}
                            <span className="text-xs" style={{ color: theme.colors.text.muted }}>
                                {idx + 1}/{steps.length}
                            </span>
                        </div>
                    ))}
                </div>

                {/* Tips */}
                <div className="text-center text-xs" style={{ color: theme.colors.text.muted }}>
                    <p>💡 Tip: Larger repositories may take longer to analyze</p>
                    <p className="mt-1">Using a GitHub token increases rate limits from 60 to 5000 req/hour</p>
                </div>
            </div>
        </div>
    );
}
