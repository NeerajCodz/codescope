'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { GripVertical } from 'lucide-react';

interface ResizeHandleProps {
    direction: 'horizontal' | 'vertical';
    onResizeStart: (e: React.MouseEvent | React.TouchEvent) => void;
    className?: string;
}

export function ResizeHandle({
    direction,
    onResizeStart,
    className
}: ResizeHandleProps) {
    const isHorizontal = direction === 'horizontal';

    return (
        <div
            className={cn(
                "relative group flex items-center justify-center transition-all z-50",
                isHorizontal
                    ? "w-1.5 cursor-col-resize hover:bg-primary/40"
                    : "h-1.5 cursor-row-resize hover:bg-primary/40",
                className
            )}
            onMouseDown={onResizeStart}
            onTouchStart={onResizeStart}
        >
            <div className={cn(
                "absolute flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all bg-primary text-primary-foreground rounded-full shadow-lg scale-75 group-hover:scale-100",
                isHorizontal ? "w-4 h-10 -left-1.5" : "w-10 h-4 -top-1.5"
            )}>
                <GripVertical className={cn("w-3 h-3", !isHorizontal && "rotate-90")} />
            </div>

            <div className={cn(
                "bg-border transition-colors group-hover:bg-primary/60",
                isHorizontal ? "w-[1px] h-full" : "h-[1px] w-full"
            )} />
        </div>
    );
}
