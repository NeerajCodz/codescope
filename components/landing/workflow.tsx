'use client';

import { ArrowRight, Github, Lock, Network, ShieldCheck, Zap, Globe } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

const steps = [
    {
        icon: Github,
        title: 'Connect Repository',
        description: 'Paste any public GitHub URL directly. For private repositories, securely provide a personal access token.',
        badge: 'Zero Setup',
        color: 'bg-blue-500/10 text-blue-500',
        detailIcon: Globe
    },
    {
        icon: ShieldCheck,
        title: 'Secure Local Analysis',
        description: 'We fetch and parse your code entirely within your browser using WebAssembly. Your code never leaves your device.',
        badge: 'Privacy First',
        color: 'bg-green-500/10 text-green-500',
        detailIcon: Lock
    },
    {
        icon: Network,
        title: 'Interactive Visualization',
        description: 'Instantly generate deep dependency graphs, identify architecture patterns, and catch circular dependencies.',
        badge: 'Real-time Insights',
        color: 'bg-purple-500/10 text-purple-500',
        detailIcon: Zap
    },
];

export function Workflow() {
    return (
        <section className="py-24 relative">
            <div className="container mx-auto px-4">
                <div className="text-center mb-20 space-y-4">
                    <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
                        How It Works
                    </h2>
                    <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
                        Go from raw code to architectural insights in three secure steps.
                    </p>
                </div>

                <div className="relative grid md:grid-cols-3 gap-12 max-w-6xl mx-auto">
                    {/* Connecting Line (Desktop) */}
                    <div className="hidden md:block absolute top-16 left-[16%] right-[16%] h-0.5 bg-gradient-to-r from-blue-500/30 via-green-500/30 to-purple-500/30 -z-10" />

                    {steps.map((step, index) => (
                        <div key={index} className="relative flex flex-col items-center text-center group">
                            {/* Icon Circle */}
                            <div className={`relative w-32 h-32 rounded-3xl ${step.color} flex items-center justify-center mb-8 transition-all duration-500 group-hover:scale-105 group-hover:shadow-2xl group-hover:shadow-primary/20 border border-white/5 backdrop-blur-sm`}>
                                <step.icon className="w-12 h-12" />

                                {/* Floating Detail Icon */}
                                <div className="absolute -top-3 -right-3 w-10 h-10 rounded-full bg-background border border-border flex items-center justify-center shadow-lg transform group-hover:rotate-12 transition-transform duration-300">
                                    <step.detailIcon className="w-5 h-5 text-muted-foreground" />
                                </div>
                            </div>

                            {/* Arrow for mobile (between steps) */}
                            {index < steps.length - 1 && (
                                <div className="md:hidden absolute -bottom-8 left-1/2 -translate-x-1/2 text-muted-foreground/30 z-0">
                                    <ArrowRight className="w-8 h-8 rotate-90" />
                                </div>
                            )}

                            {/* Content */}
                            <div className="space-y-3 relative z-10 bg-background/40 backdrop-blur-sm p-4 rounded-xl border border-transparent hover:border-white/5 transition-colors">
                                <Badge variant="secondary" className="mb-2 bg-secondary/50">
                                    {step.badge}
                                </Badge>
                                <h3 className="text-xl font-bold">{step.title}</h3>
                                <p className="text-muted-foreground leading-relaxed max-w-xs mx-auto">
                                    {step.description}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
