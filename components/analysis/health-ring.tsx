'use client';

import React from 'react';

interface HealthRingProps {
    score: number;
    size?: number;
    strokeWidth?: number;
    className?: string;
}

export function HealthRing({
    score,
    size = 120,
    strokeWidth = 10,
    className = ""
}: HealthRingProps) {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (score / 100) * circumference;

    const getColor = (s: number) => {
        if (s >= 80) return "text-green-500";
        if (s >= 60) return "text-blue-500";
        if (s >= 40) return "text-yellow-500";
        return "text-red-500";
    };

    const getGrade = (s: number) => {
        if (s >= 90) return "A+";
        if (s >= 80) return "A";
        if (s >= 70) return "B";
        if (s >= 60) return "C";
        if (s >= 50) return "D";
        return "F";
    };

    return (
        <div className={`relative flex items-center justify-center ${className}`}>
            <svg
                width={size}
                height={size}
                className="transform -rotate-90"
            >
                {/* Background Ring */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke="currentColor"
                    strokeWidth={strokeWidth}
                    fill="transparent"
                    className="text-muted/20"
                />
                {/* Progress Ring */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke="currentColor"
                    strokeWidth={strokeWidth}
                    fill="transparent"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    className={`${getColor(score)} transition-all duration-1000 ease-out`}
                />
            </svg>
            <div className="absolute flex flex-col items-center justify-center">
                <span className={`text-3xl font-bold ${getColor(score)}`}>
                    {getGrade(score)}
                </span>
                <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                    Score: {score}
                </span>
            </div>
        </div>
    );
}
