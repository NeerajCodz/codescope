'use client';

import React from 'react';
import {
    FileCode,
    Link,
    Box,
    Zap,
    ShieldCheck,
    Layers
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface StatsGridProps {
    stats?: {
        files: number;
        codeFiles: number;
        functions: number;
        connections: number;
        dead: number;
        avgComplexity: number;
    } | null;
}

export function StatsGrid({ stats }: StatsGridProps) {
    if (!stats) return null;

    const items = [
        {
            label: "Total Files",
            value: stats.files,
            icon: FileCode,
            color: "text-blue-500"
        },
        {
            label: "Links",
            value: stats.connections,
            icon: Link,
            color: "text-purple-500"
        },
        {
            label: "Functions",
            value: stats.functions,
            icon: Box,
            color: "text-green-500"
        },
        {
            label: "Redundancy",
            value: `${stats.dead} fns`,
            icon: Zap,
            color: "text-orange-500"
        },
        {
            label: "Complexity",
            value: stats.avgComplexity,
            icon: ShieldCheck,
            color: "text-indigo-500"
        },
        {
            label: "Score",
            value: "84%",
            icon: Layers,
            color: "text-pink-500"
        }
    ];

    return (
        <div className="grid grid-cols-2 gap-3">
            {items.map((item, idx) => (
                <Card key={idx} className="bg-muted/30 border-border/50">
                    <CardContent className="p-3 flex items-center gap-3">
                        <div className={`p-1.5 rounded-lg bg-background border border-border/50 ${item.color}`}>
                            <item.icon className="w-4 h-4" />
                        </div>
                        <div>
                            <div className="text-lg font-bold leading-tight">{item.value}</div>
                            <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                                {item.label}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}
