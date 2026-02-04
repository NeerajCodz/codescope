'use client';

import { Suspense } from 'react';
import { Hero } from '@/components/landing/hero';
import { Features } from '@/components/landing/features';
import { Header } from '@/components/landing/header';
import { FAQ } from '@/components/landing/faq';
import { Footer } from '@/components/landing/footer';
import { AmbientBackground } from '@/components/landing/ambient-background';
import { Workflow } from '@/components/landing/workflow';

function HeroWrapper() {
  return (
    <Suspense fallback={<div className="min-h-[60vh]" />}>
      <Hero />
    </Suspense>
  );
}

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#2563eb] via-[#020617] to-black relative">
      <AmbientBackground />
      <Header />
      <HeroWrapper />
      <div className="container mx-auto px-4 pb-20">
        <Features />
      </div>
      <Workflow />
      <FAQ />
      <Footer />
    </main>
  );
}

