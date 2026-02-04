import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers/providers";

const jetbrainsMono = JetBrains_Mono({
    subsets: ["latin"],
    variable: '--font-mono',
});

export const metadata: Metadata = {
    title: "CodeScope — Modern Architecture Intelligence Platform",
    description: "Visualize any GitHub repository's architecture in seconds. See dependencies, blast radius, code ownership, security issues, and design patterns. No installation required.",
    keywords: "code visualization, architecture, github, dependency graph, blast radius, code analysis, open source",
    authors: [{ name: "CodeScope" }],
    openGraph: {
        title: "CodeScope — Visualize Your Codebase Architecture",
        description: "Turn any GitHub repo into an interactive architecture map in seconds. Zero setup, privacy-first, runs in your browser.",
        type: "website",
    },
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" className="dark">
            <body className={`${jetbrainsMono.variable} antialiased`}>
                <Providers>{children}</Providers>
            </body>
        </html>
    );
}
