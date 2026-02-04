'use client';

import { Network, Shield, Zap, Eye, GitBranch, Sparkles, Target, Code2 } from 'lucide-react';

const features = [
    {
        icon: Network,
        title: 'Dependency Visualization',
        description: '7 different visualization modes including force graphs, treemaps, and matrices',
        color: 'text-blue-400',
    },
    {
        icon: Target,
        title: 'Blast Radius Analysis',
        description: 'See the impact of changing any file with transitive dependency tracking',
        color: 'text-purple-400',
    },
    {
        icon: Shield,
        title: 'Security Scanning',
        description: 'Detect hardcoded secrets, SQL injection risks, and XSS vulnerabilities',
        color: 'text-red-400',
    },
    {
        icon: Eye,
        title: 'Dead Code Detection',
        description: 'Find unused functions and reduce bundle size automatically',
        color: 'text-green-400',
    },
    {
        icon: GitBranch,
        title: 'Circular Dependencies',
        description: 'Identify and break circular imports that cause tight coupling',
        color: 'text-cyan-400',
    },
    {
        icon: Sparkles,
        title: 'Design Patterns',
        description: 'Auto-detect Singleton, Factory, Observer patterns and anti-patterns',
        color: 'text-yellow-400',
    },
    {
        icon: Zap,
        title: 'Complexity Analysis',
        description: 'Cyclomatic complexity for every file and function',
        color: 'text-orange-400',
    },
    {
        icon: Code2,
        title: 'Multi-Language Support',
        description: 'JS, TS, Python, Go, Java, Rust, and 20+ more languages',
        color: 'text-pink-400',
    },
];

export function Features() {
    return (
        <div className="py-20">
            <div className="text-center mb-16">
                <h2 className="text-4xl font-bold mb-4">Powerful Features</h2>
                <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                    Everything you need to understand and improve your codebase architecture
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {features.map((feature, index) => (
                    <div
                        key={index}
                        className="group p-6 rounded-xl bg-card border border-border hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:shadow-primary/10 hover:-translate-y-1"
                    >
                        <div className={`w-12 h-12 rounded-lg bg-muted/50 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                            <feature.icon className={`w-6 h-6 ${feature.color}`} />
                        </div>
                        <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            {feature.description}
                        </p>
                    </div>
                ))}
            </div>
        </div>
    );
}