'use client';

import { useEffect, useRef, useState } from 'react';
import {
    ZoomIn,
    ZoomOut,
    Maximize,
    RefreshCw,
    Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAnalysisStore } from '@/components/context/analysis-context';
import { ForceGraph } from './visualizations/force-graph';
import { ClusterGraph } from './visualizations/cluster-graph';
import { Treemap } from './visualizations/treemap';
import { Matrix } from './visualizations/matrix';
import { Dendrogram } from './visualizations/dendrogram';
import { Sankey } from './visualizations/sankey';
import { Bundle } from './visualizations/bundle';
import { Arc } from './visualizations/arc';

export function Canvas() {
    const { viewMode, data, loading, error } = useAnalysisStore();
    const [refreshKey, setRefreshKey] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);

    const dispatchControl = (action: 'zoom-in' | 'zoom-out' | 'reset') => {
        window.dispatchEvent(new CustomEvent('viz-control', { detail: { action } }));
    };

    const handleRefresh = () => {
        setRefreshKey((k) => k + 1);
        dispatchControl('reset');
    };

    const handleFullscreen = async () => {
        if (!document.fullscreenElement) {
            await document.documentElement.requestFullscreen();
        } else {
            await document.exitFullscreen();
        }
    };

    useEffect(() => {
        const onChange = () => {
            setIsFullscreen(Boolean(document.fullscreenElement));
        };
        document.addEventListener('fullscreenchange', onChange);
        return () => document.removeEventListener('fullscreenchange', onChange);
    }, []);

    const renderVisualization = () => {
        if (!data) return null;
        switch (viewMode) {
            case 'treemap': return <Treemap key={`treemap-${refreshKey}`} />;
            case 'matrix': return <Matrix key={`matrix-${refreshKey}`} />;
            case 'dendrogram': return <Dendrogram key={`dendrogram-${refreshKey}`} />;
            case 'sankey': return <Sankey key={`sankey-${refreshKey}`} />;
            case 'bundle': return <Bundle key={`bundle-${refreshKey}`} />;
            case 'arc': return <Arc key={`arc-${refreshKey}`} />;
            case 'cluster': return <ClusterGraph key={`cluster-${refreshKey}`} />;
            default: return <ForceGraph key={`force-${refreshKey}`} />;
        }
    };

    return (
        <div ref={containerRef} className="flex-1 relative bg-background overflow-hidden flex flex-col">
            {/* Toolbar */}
            <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
                <div className="flex items-center gap-1 bg-card/80 backdrop-blur-sm border border-border p-1 rounded-lg shadow-sm">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => dispatchControl('zoom-in')}>
                        <ZoomIn className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => dispatchControl('zoom-out')}>
                        <ZoomOut className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleRefresh}>
                        <RefreshCw className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleFullscreen}>
                        <Maximize className={isFullscreen ? 'w-4 h-4 text-cyan-400' : 'w-4 h-4'} />
                    </Button>
                </div>
            </div>

            {/* Main Visualization Area */}
            <div className="flex-1 flex items-center justify-center">
                {loading ? (
                    <div className="flex flex-col items-center gap-4 animate-pulse">
                        <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                        <div className="text-sm text-muted-foreground">Analyzing architecture...</div>
                    </div>
                ) : error ? (
                    <div className="text-center space-y-4 max-w-md mx-auto p-6 bg-destructive/10 rounded-xl border border-destructive/20 text-destructive">
                        <div className="text-lg font-semibold flex items-center justify-center gap-2">
                            <Info className="w-5 h-5" />
                            Analysis Failed
                        </div>
                        <p className="text-sm opacity-90">{error}</p>
                        <Button
                            variant="default"
                            size="sm"
                            onClick={() => window.location.reload()}
                            className="bg-destructive hover:bg-destructive/90 text-white"
                        >
                            Try Again
                        </Button>
                    </div>
                ) : !data ? (
                    <div className="text-center space-y-4">
                        <div className="w-24 h-24 bg-muted/20 rounded-full mx-auto flex items-center justify-center">
                            <Info className="w-10 h-10 text-muted-foreground/50" />
                        </div>
                        <div className="text-muted-foreground max-w-sm mx-auto p-4">
                            Enter a repository URL to visualize its architecture.
                            <br />
                            <span className="text-xs opacity-70">
                                Try https://github.com/facebook/react
                            </span>
                        </div>
                    </div>
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                        {renderVisualization()}
                    </div>
                )}
            </div>

            {/* Legend / Info */}
            <div className="absolute bottom-4 left-4 z-10">
                <div className="bg-card/80 backdrop-blur-sm border border-border p-3 rounded-lg shadow-sm text-xs">
                    <div className="font-semibold mb-2 text-muted-foreground uppercase tracking-wider text-[10px]">
                        Layers
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-blue-500" />
                            <span className="text-muted-foreground">UI / Components</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-purple-500" />
                            <span className="text-muted-foreground">Services</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-green-500" />
                            <span className="text-muted-foreground">Utils</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-orange-500" />
                            <span className="text-muted-foreground">Data</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
