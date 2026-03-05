'use client';

export function AmbientBackground() {
    return (
        <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
            {/* Top Left - Blueish */}
            <div className="absolute top-0 left-0 w-[500px] h-[500px] bg-blue-500/20 rounded-full blur-[100px] opacity-40 mix-blend-screen animate-pulse-glow" style={{ animationDuration: '4s' }} />

            {/* Top Right - Cyanish (near login) */}
            <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-cyan-500/20 rounded-full blur-[100px] opacity-40 mix-blend-screen animate-pulse-glow" style={{ animationDelay: '1s', animationDuration: '5s' }} />

            {/* Middle Left - Purple */}
            <div className="absolute top-[40%] -left-20 w-[600px] h-[600px] bg-purple-500/20 rounded-full blur-[120px] opacity-30 mix-blend-screen animate-pulse-glow" style={{ animationDelay: '2s', animationDuration: '7s' }} />

            {/* Middle Right - Indigo */}
            <div className="absolute top-[30%] -right-20 w-[500px] h-[500px] bg-indigo-500/20 rounded-full blur-[120px] opacity-30 mix-blend-screen animate-pulse-glow" style={{ animationDelay: '0.5s', animationDuration: '6s' }} />

            {/* Bottom - Greenish/Teal */}
            <div className="absolute bottom-0 left-1/3 w-[800px] h-[400px] bg-teal-500/10 rounded-full blur-[100px] opacity-40 mix-blend-screen animate-pulse-glow" style={{ animationDelay: '3s', animationDuration: '8s' }} />
        </div>
    );
}
