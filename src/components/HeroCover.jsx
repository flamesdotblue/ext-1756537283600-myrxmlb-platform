import React from 'react';
import Spline from '@splinetool/react-spline';

export default function HeroCover() {
  return (
    <section className="relative h-[60vh] min-h-[420px] w-full overflow-hidden">
      <div className="absolute inset-0">
        <Spline scene="https://prod.spline.design/Jd4wcqFfe70N-TXP/scene.splinecode" style={{ width: '100%', height: '100%' }} />
      </div>
      <div className="absolute inset-0 bg-gradient-to-b from-slate-900/10 via-slate-900/40 to-slate-900 pointer-events-none" />
      <div className="relative z-10 h-full flex items-center justify-center text-center px-6">
        <div>
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight drop-shadow-[0_2px_0_rgba(0,0,0,0.35)]">
            Pixel Platformer Tribute
          </h1>
          <p className="mt-4 text-slate-200 max-w-2xl mx-auto text-base md:text-lg">
            Run, jump, bonk blocks, collect coins, and stomp baddies in an original 8/16-bit inspired adventure.
          </p>
          <div className="mt-6 inline-flex items-center gap-3">
            <span className="px-4 py-2 rounded-lg bg-emerald-500 text-white font-semibold shadow-lg shadow-emerald-500/20">
              Arrow Keys / WASD to Move
            </span>
            <span className="px-4 py-2 rounded-lg bg-cyan-500 text-white font-semibold shadow-lg shadow-cyan-500/20">
              Space to Jump
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
