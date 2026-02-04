'use client';

import { Suspense } from 'react';
import { Hero } from '@/components/landing/hero';
import { Features } from '@/components/landing/features';

function HeroWrapper() {
  return (
    <Suspense fallback={<div className="min-h-[60vh]" />}>
      <Hero />
    </Suspense>
  );
}

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="container mx-auto px-4 py-8">
        <HeroWrapper />
        <Features />
      </div>
    </main>
  );
}

