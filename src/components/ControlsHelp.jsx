import React from 'react';
import { Gamepad2, Keyboard, MousePointerClick } from 'lucide-react';

export default function ControlsHelp() {
  return (
    <div className="text-slate-300 text-sm space-y-3">
      <div className="flex items-start gap-3">
        <Keyboard className="w-5 h-5 text-slate-200 mt-0.5" />
        <p>
          Move with Arrow Keys or WASD. Hold longer for faster running. Press Space or W to jump. Hold for a higher jump.
        </p>
      </div>
      <div className="flex items-start gap-3">
        <Gamepad2 className="w-5 h-5 text-slate-200 mt-0.5" />
        <p>
          Stomp enemies by landing on them from above. Bonk boxes from below to pop coins. Reach the pennant to win.
        </p>
      </div>
      <div className="flex items-start gap-3">
        <MousePointerClick className="w-5 h-5 text-slate-200 mt-0.5" />
        <p>
          On touch devices, use the on-screen controls shown beneath the game.
        </p>
      </div>
    </div>
  );
}
