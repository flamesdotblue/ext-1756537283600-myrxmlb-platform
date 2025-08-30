import React from 'react';
import HeroCover from './components/HeroCover';
import GameCanvas from './components/GameCanvas';
import HUD from './components/HUD';
import ControlsHelp from './components/ControlsHelp';

export default function App() {
  const [gameState, setGameState] = React.useState({
    score: 0,
    coins: 0,
    time: 400,
    lives: 3,
    status: 'ready', // ready | playing | won | lost
  });

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <HeroCover />

      <main className="container mx-auto px-4 pb-24">
        <section className="mt-10 grid lg:grid-cols-[1fr_320px] gap-6">
          <div className="bg-slate-800/60 rounded-xl border border-slate-700/60 shadow-xl overflow-hidden">
            <div className="border-b border-slate-700/60 p-4 bg-slate-800/60">
              <HUD gameState={gameState} />
            </div>
            <div className="p-0">
              <GameCanvas onGameUpdate={setGameState} />
            </div>
          </div>
          <div className="space-y-6">
            <div className="bg-slate-800/60 rounded-xl border border-slate-700/60 p-5">
              <h2 className="text-xl font-semibold mb-2">How to Play</h2>
              <ControlsHelp />
            </div>
            <div className="bg-slate-800/60 rounded-xl border border-slate-700/60 p-5">
              <h3 className="text-lg font-semibold mb-2">About</h3>
              <p className="text-slate-300 text-sm leading-relaxed">
                Enjoy a lovingly crafted, original retro platformer tribute. All art is procedural pixel-style and level design is original, evoking nostalgic vibes without reusing any proprietary assets or layouts.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
