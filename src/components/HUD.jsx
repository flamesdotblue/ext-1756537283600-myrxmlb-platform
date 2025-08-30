import React from 'react';

export default function HUD({ gameState }) {
  const { score = 0, coins = 0, time = 0, lives = 3, status = 'ready' } = gameState || {};
  return (
    <div className="flex items-center justify-between font-mono text-sm">
      <div className="flex items-center gap-6">
        <div>
          <div className="text-slate-300">SCORE</div>
          <div className="text-amber-300 text-xl tabular-nums">{score.toString().padStart(6, '0')}</div>
        </div>
        <div>
          <div className="text-slate-300">COINS</div>
          <div className="text-amber-300 text-xl tabular-nums">{coins.toString().padStart(2, '0')}</div>
        </div>
      </div>
      <div className="text-center">
        <div className="text-slate-300">TIME</div>
        <div className={`text-xl tabular-nums ${time <= 50 ? 'text-red-400' : 'text-emerald-300'}`}>{Math.max(0, Math.floor(time)).toString().padStart(3, '0')}</div>
      </div>
      <div className="text-right">
        <div className="text-slate-300">LIVES</div>
        <div className="text-cyan-300 text-xl tabular-nums">{lives}</div>
      </div>
      <div className="hidden md:block text-right">
        <div className="text-slate-300">STATUS</div>
        <div className="text-violet-300 text-xl uppercase">{status}</div>
      </div>
    </div>
  );
}
