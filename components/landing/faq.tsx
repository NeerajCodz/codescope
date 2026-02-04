'use client';

import { useState } from 'react';
import { ChevronDown, HelpCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FAQItem {
    question: string;
    answer: string;
}

const faqs: FAQItem[] = [
    {
        question: "How does CodeScope work?",
        answer: "CodeScope uses advanced static analysis techniques directly in your browser. We fetch your repository's code (public or private with a token), parse it to understand relationships between files, classes, and functions, and generate interactive visualizations. No code is ever sent to our servers."
    },
    {
        question: "Is my code safe?",
        answer: "Absolutely. CodeScope is designed with a privacy-first approach. All analysis happens locally on your device. We never store your code, tokens, or repository data on our servers. When you close the tab, all data is cleared."
    },
    {
        question: "Do I need a GitHub token?",
        answer: "For public repositories, you can often use CodeScope without a token, but you may hit GitHub's unauthenticated rate limits (60 requests/hour). Adding a personal access token increases this limit to 5,000 requests/hour and allows you to visualize your private repositories."
    },
    {
        question: "Can I visualize private repositories?",
        answer: "Yes! Simply provide a GitHub Personal Access Token with 'repo' scope when prompted. CodeScope will use this token to fetch your private repository's structure. The token is stored only in your browser's session storage and is never transmitted to us."
    },
    {
        question: "Is CodeScope free to use?",
        answer: "Yes, CodeScope is currently free to use for all developers. It's an open-source project aimed at helping developers understand complex codebases more effectively."
    }
];

export function FAQ() {
    const [openIndex, setOpenIndex] = useState<number | null>(null);

    return (
        <section className="py-24 relative overflow-hidden">
            {/* Background elements */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full max-w-7xl pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-[100px]" />
                <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-viz-purple/5 rounded-full blur-[100px]" />
            </div>

            <div className="container mx-auto px-4 relative z-10">
                <div className="text-center mb-16 space-y-4">
                    <div className="inline-flex items-center justify-center p-2 rounded-full bg-primary/10 mb-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <HelpCircle className="w-5 h-5 text-primary" />
                    </div>
                    <h2 className="text-3xl md:text-4xl font-bold tracking-tight bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
                        Frequently Asked Questions
                    </h2>
                    <p className="text-muted-foreground max-w-2xl mx-auto">
                        Everything you need to know about CodeScope's features, security, and usage.
                    </p>
                </div>

                <div className="max-w-3xl mx-auto space-y-4">
                    {faqs.map((faq, index) => (
                        <div
                            key={index}
                            className="bg-card/30 backdrop-blur-sm border border-border/50 rounded-lg overflow-hidden transition-all duration-200 hover:border-primary/20"
                        >
                            <button
                                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                                className="w-full px-6 py-4 flex items-center justify-between text-left transition-colors hover:bg-muted/30"
                            >
                                <span className="font-medium text-lg">{faq.question}</span>
                                <ChevronDown
                                    className={cn(
                                        "w-5 h-5 text-muted-foreground transition-transform duration-200",
                                        openIndex === index && "transform rotate-180 text-primary"
                                    )}
                                />
                            </button>
                            <div
                                className={cn(
                                    "px-6 text-muted-foreground overflow-hidden transition-all duration-300 ease-in-out",
                                    openIndex === index ? "max-h-48 pb-6 opacity-100" : "max-h-0 opacity-0"
                                )}
                            >
                                {faq.answer}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
