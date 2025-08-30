import React, { useEffect, useRef, useState } from 'react';

// Original retro platformer inspired by classics. No proprietary assets.

const WORLD = {
  tile: 16, // logical pixels per tile
  cols: 320, // width in tiles
  rows: 14,  // height in tiles
  gravity: 0.35,
  jumpVel: 7.5,
  maxDX: 3.8,
  accel: 0.3,
  friction: 0.82,
};

const SOLID_TILES = new Set([1, 2, 3, 4]);

// Simple PRNG for consistent decoration
function mulberry32(a) {
  return function () {
    var t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function useResizeObserver(ref, cb) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new ResizeObserver(cb);
    obs.observe(el);
    return () => obs.disconnect();
  }, [ref, cb]);
}

export default function GameCanvas({ onGameUpdate }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const [state, setState] = useState(() => ({
    score: 0,
    coins: 0,
    time: 400,
    lives: 3,
    status: 'ready',
  }));

  useEffect(() => {
    onGameUpdate?.(state);
  }, [state, onGameUpdate]);

  useEffect(() => {
    const handle = (e) => {
      if (e.key === 'Enter' && (state.status === 'ready' || state.status === 'won' || state.status === 'lost')) {
        startGame();
      }
    };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, [state.status]);

  useEffect(() => {
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useResizeObserver(wrapRef, () => fitCanvas());

  // Game objects
  const worldRef = useRef(null);
  const inputRef = useRef({ left: false, right: false, up: false });
  const animRef = useRef(0);
  const startedRef = useRef(false);

  function init() {
    setupWorld();
    fitCanvas();
    bindInput();
    drawFrame(0); // initial draw
  }

  function startGame() {
    if (!worldRef.current) setupWorld();
    startedRef.current = true;
    setState((s) => ({ ...s, status: 'playing', time: 400, score: 0, coins: 0 }));
    cancelAnimationFrame(animRef.current);
    let last = performance.now();
    const loop = (t) => {
      const dt = Math.min(1 / 30, (t - last) / 1000);
      last = t;
      update(dt);
      drawFrame(t);
      animRef.current = requestAnimationFrame(loop);
    };
    animRef.current = requestAnimationFrame(loop);
  }

  function setupWorld() {
    const rng = mulberry32(1337);
    const tile = WORLD.tile;

    const level = {
      w: WORLD.cols,
      h: WORLD.rows,
      startX: 3 * tile,
      startY: 10 * tile,
      goalX: 250 * tile,
      entities: [],
      coins: [],
      boxes: [],
      platforms: [],
      pipes: [],
      flags: [],
    };

    // Terrain: base ground (last two rows solid)
    // Decorative gentle hills and clouds are drawn procedurally.

    // Platforms and features (original design)
    // Early stepping stones
    for (let x = 22; x < 30; x++) level.platforms.push({ x, y: 9, w: 1, h: 1 });

    // First coin arc over a small gap
    for (let i = 0; i < 6; i++) level.coins.push({ x: 42 + i, y: 5 + Math.floor(Math.sin(i / 1.2) * 2 + 2) });
    // Gap area: handled implicitly by ground check

    // Question boxes cluster
    [60, 61, 62, 64].forEach((x) => level.boxes.push({ x, y: 7 }));
    level.coins.push({ x: 63, y: 6 });

    // Pipes area
    level.pipes.push({ x: 80, y: 8, h: 4 });
    level.pipes.push({ x: 92, y: 7, h: 5 });

    // Mid lift platforms
    for (let x = 110; x <= 120; x += 2) level.platforms.push({ x, y: 8, w: 1, h: 1 });

    // Tall stair climb
    for (let i = 0; i < 6; i++) {
      for (let x = 0; x <= i; x++) level.platforms.push({ x: 150 + x, y: 10 - i, w: 1, h: 1 });
    }

    // Down stair
    for (let i = 0; i < 5; i++) {
      for (let x = 0; x < 5 - i; x++) level.platforms.push({ x: 165 + x, y: 6 + i, w: 1, h: 1 });
    }

    // Enemy placements (shroomers)
    const enemies = [];
    [35, 66, 95, 118, 172, 188, 210].forEach((x) => {
      enemies.push({ type: 'shroom', x: x * tile, y: 10 * tile, dx: -0.6, dy: 0, alive: true });
    });

    // Flags: goal pennant
    level.flags.push({ x: Math.floor(level.goalX / tile), y: 3, h: 9 });

    // Player
    const player = {
      x: level.startX,
      y: level.startY,
      w: 12,
      h: 14,
      dx: 0,
      dy: 0,
      onGround: false,
      facing: 1,
      invuln: 0,
    };

    // Boxes with coins
    const boxState = new Map(); // key: x,y -> remaining coins (1)
    for (const b of level.boxes) boxState.set(`${b.x},${b.y}`, 1);

    const camera = { x: 0, y: 0 };

    worldRef.current = { tile, level, rng, player, enemies, boxState, camera };
  }

  function bindInput() {
    const i = inputRef.current;
    const down = (e) => {
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', ' ', 'a', 'd', 'w', 'A', 'D', 'W'].includes(e.key)) e.preventDefault();
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') i.left = true;
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') i.right = true;
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W' || e.key === ' ') i.up = true;
    };
    const up = (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') i.left = false;
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') i.right = false;
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W' || e.key === ' ') i.up = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
  }

  function fitCanvas() {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const logicalW = 384; // viewport width in logical pixels (24 tiles)
    const logicalH = WORLD.rows * WORLD.tile; // 224px

    canvas.width = logicalW;
    canvas.height = logicalH;

    // Scale to fit container width while keeping pixel crispness
    const rect = wrap.getBoundingClientRect();
    const scale = Math.floor(Math.max(1, Math.min(rect.width / logicalW, 4)));
    canvas.style.width = `${logicalW * scale}px`;
    canvas.style.height = `${logicalH * scale}px`;
  }

  function update(dt) {
    const W = worldRef.current;
    if (!W) return;

    setState((s) => ({ ...s, time: s.status === 'playing' ? s.time - dt * 60 : s.time }));
    if (state.status !== 'playing') return;

    const { player, level, enemies, boxState } = W;

    // Player input
    const i = inputRef.current;
    if (i.left) player.dx -= WORLD.accel;
    if (i.right) player.dx += WORLD.accel;
    if (Math.abs(player.dx) > WORLD.maxDX) player.dx = WORLD.maxDX * Math.sign(player.dx);

    // Jump
    if (i.up && player.onGround) {
      player.dy = -WORLD.jumpVel;
      player.onGround = false;
    }
    // variable jump height
    if (!i.up && player.dy < -2) player.dy = -2;

    // Physics
    player.dy += WORLD.gravity;
    player.dx *= WORLD.friction;

    moveAndCollide(player, dt);

    // Enemies
    for (const e of enemies) {
      if (!e.alive) continue;
      e.dy += WORLD.gravity;
      e.x += e.dx;
      // Tile collisions for enemies (simple)
      const feet = collideTile(e.x, e.y + e.h, e.w || 14, 1);
      if (feet.bottom) {
        e.dy = 0;
      } else {
        e.y += e.dy;
      }
      // Reverse on wall
      const leftHit = collideTile(e.x - 1, e.y, 1, e.h);
      const rightHit = collideTile(e.x + (e.w || 14) + 1, e.y, 1, e.h);
      if (leftHit.left || rightHit.right) e.dx *= -1;

      // Offscreen cleanup (past goal)
      if (e.x < W.camera.x - 64 || e.x > level.goalX + 512) e.alive = false;
    }

    // Player vs enemies
    for (const e of enemies) {
      if (!e.alive) continue;
      if (aabb(player, e)) {
        const stomping = player.dy > 0 && player.y + player.h - e.y < 8;
        if (stomping) {
          e.alive = false;
          player.dy = -6.5;
          setState((s) => ({ ...s, score: s.score + 100 }));
        } else if (player.invuln <= 0) {
          // Hurt
          player.invuln = 120; // frames
          setState((s) => ({ ...s, lives: Math.max(0, s.lives - 1) }));
          if (state.lives - 1 <= 0) lose();
        }
      }
    }

    if (player.invuln > 0) player.invuln -= 1;

    // Box bonk detection
    if (player.dy < 0) {
      const headTile = tileAtPx(player.x + player.w / 2, player.y - 2);
      if (headTile.id === 3) {
        // Bonk question box: dispense coin if available
        const key = `${headTile.tx},${headTile.ty}`;
        const remain = boxState.get(key) || 0;
        if (remain > 0) {
          boxState.set(key, remain - 1);
          setState((s) => ({ ...s, coins: s.coins + 1, score: s.score + 100 }));
        }
        player.dy = 2; // bounce down slightly
      }
    }

    // Coins pickup
    const toRemove = [];
    for (let idx = 0; idx < W.level.coins.length; idx++) {
      const c = W.level.coins[idx];
      const cx = c.x * W.tile + 4;
      const cy = c.y * W.tile + 4;
      if (rectOverlap(player.x, player.y, player.w, player.h, cx, cy, 8, 8)) {
        toRemove.push(idx);
        setState((s) => ({ ...s, coins: s.coins + 1, score: s.score + 50 }));
      }
    }
    for (let i = toRemove.length - 1; i >= 0; i--) W.level.coins.splice(toRemove[i], 1);

    // Goal reach
    const goal = W.level.flags[0];
    const gx = goal.x * W.tile;
    if (player.x + player.w > gx && player.y < (goal.y + goal.h) * W.tile) {
      win();
    }

    // Camera follow
    W.camera.x = Math.max(0, Math.min(player.x - 80, W.level.goalX - 320));
    W.camera.y = 0;
  }

  function moveAndCollide(obj, dt) {
    const W = worldRef.current;
    const { tile } = W;

    // Horizontal
    let nx = obj.x + obj.dx;
    if (obj.dx > 0) {
      if (isSolidAt(nx + obj.w, obj.y, obj.h)) {
        nx = Math.floor((nx + obj.w) / tile) * tile - obj.w - 0.01;
        obj.dx = 0;
      }
    } else if (obj.dx < 0) {
      if (isSolidAt(nx, obj.y, obj.h)) {
        nx = Math.floor(nx / tile + 0.0001) * tile + tile + 0.01;
        obj.dx = 0;
      }
    }

    // Vertical
    let ny = obj.y + obj.dy;
    obj.onGround = false;
    if (obj.dy > 0) {
      if (isSolidAtXRange(nx, ny + obj.h, obj.w)) {
        ny = Math.floor((ny + obj.h) / tile) * tile - obj.h - 0.01;
        obj.dy = 0;
        obj.onGround = true;
      }
    } else if (obj.dy < 0) {
      if (isSolidAtXRange(nx, ny, obj.w)) {
        ny = Math.floor(ny / tile + 0.0001) * tile + tile + 0.01;
        obj.dy = 0;
      }
    }

    obj.x = nx;
    obj.y = ny;
  }

  function collideTile(x, y, w, h) {
    return {
      left: isSolidAt(x, y, h),
      right: isSolidAt(x + w, y, h),
      bottom: isSolidAtXRange(x, y, w),
      top: isSolidAtXRange(x, y - h, w),
    };
  }

  function isSolidAt(px, py, h) {
    const W = worldRef.current;
    const tx = Math.floor(px / W.tile);
    const topTy = Math.floor(py / W.tile);
    const bottomTy = Math.floor((py + h - 1) / W.tile);
    for (let ty = topTy; ty <= bottomTy; ty++) {
      const tile = getTile(tx, ty);
      if (SOLID_TILES.has(tile)) return true;
    }
    return false;
  }

  function isSolidAtXRange(px, py, w) {
    const W = worldRef.current;
    const left = Math.floor(px / W.tile);
    const right = Math.floor((px + w - 1) / W.tile);
    const ty = Math.floor(py / W.tile);
    for (let tx = left; tx <= right; tx++) {
      const tile = getTile(tx, ty);
      if (SOLID_TILES.has(tile)) return true;
    }
    return false;
  }

  function tileAtPx(px, py) {
    const W = worldRef.current;
    const tx = Math.floor(px / W.tile);
    const ty = Math.floor(py / W.tile);
    return { tx, ty, id: getTile(tx, ty) };
  }

  function getTile(tx, ty) {
    const W = worldRef.current;
    if (!W) return 0;
    const { level } = W;
    if (tx < 0 || ty < 0 || tx >= level.w || ty >= level.h) return 0;

    // Ground: last two rows solid earth
    if (ty >= level.h - 2) return 1;

    // Pipes
    for (const p of level.pipes) {
      if (tx >= p.x && tx < p.x + 2 && ty >= p.y - p.h && ty < p.y) return 4;
    }

    // Platforms/Bricks
    for (const pl of level.platforms) {
      if (tx >= pl.x && tx < pl.x + pl.w && ty >= pl.y && ty < pl.y + pl.h) return 2;
    }

    // Boxes
    for (const b of level.boxes) {
      if (tx === b.x && ty === b.y) return 3;
    }

    // Flag pole (non-solid ID 5)
    for (const f of level.flags) {
      if (tx === f.x && ty >= f.y && ty < f.y + f.h) return 5;
    }

    return 0;
  }

  function aabb(a, b) {
    return (
      a.x < b.x + (b.w || 14) &&
      a.x + a.w > b.x &&
      a.y < b.y + (b.h || 14) &&
      a.h + a.y > b.y
    );
  }

  function rectOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  function win() {
    startedRef.current = false;
    cancelAnimationFrame(animRef.current);
    setState((s) => ({ ...s, status: 'won', score: s.score + Math.max(0, Math.floor(s.time)) * 10 }));
  }

  function lose() {
    startedRef.current = false;
    cancelAnimationFrame(animRef.current);
    setState((s) => ({ ...s, status: 'lost' }));
  }

  // RENDERING
  function drawFrame(t) {
    const W = worldRef.current;
    const canvas = canvasRef.current;
    if (!W || !canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    const { tile } = W;

    // Clear sky
    ctx.fillStyle = '#1d2a3a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Parallax: hills
    drawBackground(ctx, W);

    // Tiles in viewport
    const viewX = Math.floor(W.camera.x / tile);
    const viewW = Math.ceil(canvas.width / tile) + 2;

    for (let ty = 0; ty < W.level.h; ty++) {
      for (let tx = viewX; tx < viewX + viewW; tx++) {
        const id = getTile(tx, ty);
        const px = tx * tile - W.camera.x;
        const py = ty * tile - W.camera.y;
        if (id === 1) drawGround(ctx, px, py, tile);
        else if (id === 2) drawBrick(ctx, px, py, tile);
        else if (id === 3) drawQuestion(ctx, px, py, tile, W.boxState.get(`${tx},${ty}`) > 0);
        else if (id === 4) drawPipe(ctx, px, py, tile);
        else if (id === 5) drawFlagpole(ctx, px, py, tile);
      }
    }

    // Coins
    for (const c of W.level.coins) {
      const px = c.x * tile - W.camera.x + 4;
      const py = c.y * tile - W.camera.y + 4;
      drawCoin(ctx, px, py);
    }

    // Enemies
    for (const e of W.enemies) {
      if (!e.alive) continue;
      const px = Math.floor(e.x - W.camera.x);
      const py = Math.floor(e.y - W.camera.y);
      drawShroom(ctx, px, py, t);
    }

    // Player
    drawPlayer(ctx, Math.floor(W.player.x - W.camera.x), Math.floor(W.player.y - W.camera.y), W.player, t);

    // Foreground vignette
    const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
    g.addColorStop(0, 'rgba(0,0,0,0.0)');
    g.addColorStop(1, 'rgba(0,0,0,0.15)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Start/Win/Lose overlay text
    if (!startedRef.current) {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 16px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Press Enter to Start', canvas.width / 2, canvas.height / 2);
      if (state.status === 'won') ctx.fillText('You Win! Press Enter to Replay', canvas.width / 2, canvas.height / 2 + 24);
      if (state.status === 'lost') ctx.fillText('Game Over. Press Enter to Retry', canvas.width / 2, canvas.height / 2 + 24);
      ctx.restore();
    }
  }

  function drawBackground(ctx, W) {
    const { tile } = W;
    // Clouds
    for (let i = 0; i < 6; i++) {
      const cx = ((i * 180 - (W.camera.x * 0.6)) % (tile * 40)) + tile * 20;
      const cy = 30 + (i % 2) * 16;
      drawCloud(ctx, cx, cy);
    }
    // Hills
    for (let i = 0; i < 8; i++) {
      const hx = ((i * 220 - (W.camera.x * 0.3)) % (tile * 60)) + tile * 30;
      drawHill(ctx, hx, WORLD.rows * tile - 32);
    }
  }

  // Pixel art pieces
  function drawGround(ctx, x, y, s) {
    ctx.fillStyle = '#5f3b1b';
    ctx.fillRect(x, y, s, s);
    ctx.fillStyle = '#7b4b22';
    for (let i = 0; i < s; i += 4) {
      ctx.fillRect(x, y + i, s, 2);
    }
    ctx.fillStyle = '#3a2410';
    ctx.fillRect(x, y + s - 3, s, 3);
  }

  function drawBrick(ctx, x, y, s) {
    ctx.fillStyle = '#8b4b28';
    ctx.fillRect(x, y, s, s);
    ctx.fillStyle = '#a85a31';
    ctx.fillRect(x + 1, y + 1, s - 2, 6);
    ctx.fillStyle = '#6e3c20';
    ctx.fillRect(x + 1, y + 8, s - 2, 7);
    ctx.fillStyle = '#3a2410';
    ctx.fillRect(x, y + s - 2, s, 2);
    // Mortar lines
    ctx.fillStyle = '#3f2a18';
    ctx.fillRect(x, y + 7, s, 2);
    ctx.fillRect(x + 7, y + 1, 2, 14);
  }

  function drawQuestion(ctx, x, y, s, active) {
    ctx.fillStyle = active ? '#d99b2a' : '#8b4b28';
    ctx.fillRect(x, y, s, s);
    ctx.fillStyle = active ? '#fbbf45' : '#a85a31';
    ctx.fillRect(x + 1, y + 1, s - 2, s - 2);
    ctx.fillStyle = '#7a4a1b';
    ctx.fillRect(x + 1, y + s - 3, s - 2, 2);
    // question mark
    ctx.fillStyle = active ? '#4b300b' : '#6e3c20';
    const px = x + 5, py = y + 4;
    if (active) {
      ctx.fillRect(px, py, 6, 2);
      ctx.fillRect(px + 6, py + 2, 2, 2);
      ctx.fillRect(px + 4, py + 4, 2, 2);
      ctx.fillRect(px + 4, py + 6, 2, 2);
      ctx.fillRect(px + 4, py + 9, 2, 2);
    } else {
      // depleted block look
      ctx.fillRect(px - 2, py + 6, 10, 2);
    }
  }

  function drawPipe(ctx, x, y, s) {
    // Draw only top cap once per pair rows
    // Body
    ctx.fillStyle = '#2d7f42';
    ctx.fillRect(x, y, s * 2, s);
    ctx.fillRect(x, y + s, s * 2, s);
    ctx.fillStyle = '#3c9a54';
    ctx.fillRect(x + 2, y + 2, s * 2 - 4, s - 4);
    ctx.fillStyle = '#1e5a2e';
    ctx.fillRect(x, y + s - 2, s * 2, 2);
  }

  function drawFlagpole(ctx, x, y, s) {
    // pole
    ctx.fillStyle = '#d6d6d6';
    for (let i = 0; i < s; i += 2) ctx.fillRect(x + s - 2, y + i, 2, 2);
    // pennant
    ctx.fillStyle = '#ff3b3b';
    ctx.fillRect(x - 10, y + 2, 10, 6);
    ctx.fillStyle = '#b32020';
    ctx.fillRect(x - 4, y + 2, 4, 6);
  }

  function drawCoin(ctx, x, y) {
    ctx.fillStyle = '#cfa132';
    ctx.fillRect(x + 2, y, 4, 2);
    ctx.fillRect(x, y + 2, 8, 8);
    ctx.fillStyle = '#f3c552';
    ctx.fillRect(x + 1, y + 2, 6, 8);
    ctx.fillStyle = '#8a6a21';
    ctx.fillRect(x + 3, y + 3, 2, 6);
  }

  function drawCloud(ctx, x, y) {
    ctx.fillStyle = '#9dbfe1';
    ctx.fillRect(x, y + 4, 14, 6);
    ctx.fillRect(x + 6, y, 18, 10);
    ctx.fillRect(x + 18, y + 2, 12, 8);
    ctx.fillStyle = '#cfe5ff';
    ctx.fillRect(x + 2, y + 4, 10, 4);
    ctx.fillRect(x + 8, y + 2, 12, 6);
  }

  function drawHill(ctx, x, baseY) {
    ctx.fillStyle = '#2a6e3b';
    ctx.fillRect(x - 24, baseY - 8, 48, 8);
    ctx.fillRect(x - 16, baseY - 16, 32, 8);
    ctx.fillRect(x - 8, baseY - 24, 16, 8);
    ctx.fillStyle = '#3b8f52';
    ctx.fillRect(x - 24, baseY - 10, 48, 2);
  }

  function drawShroom(ctx, x, y, t) {
    // body
    ctx.fillStyle = '#7b3f00';
    ctx.fillRect(x + 2, y + 10, 10, 4);
    // cap
    ctx.fillStyle = '#de5a5a';
    ctx.fillRect(x, y + 4, 14, 6);
    ctx.fillRect(x + 2, y + 2, 10, 2);
    // eyes
    ctx.fillStyle = '#000';
    const blink = Math.floor(t / 400) % 60 === 0;
    ctx.fillRect(x + 4, y + (blink ? 12 : 11), 2, blink ? 1 : 3);
    ctx.fillRect(x + 8, y + (blink ? 12 : 11), 2, blink ? 1 : 3);
  }

  function drawPlayer(ctx, x, y, p, t) {
    // Invulnerability blink
    if (p.invuln > 0 && Math.floor(t / 50) % 2 === 0) return;
    // boots
    ctx.fillStyle = '#3a2b26';
    ctx.fillRect(x + 2, y + 12, 4, 2);
    ctx.fillRect(x + 6, y + 12, 4, 2);
    // overalls body
    ctx.fillStyle = '#2d5bde';
    ctx.fillRect(x + 2, y + 6, 8, 6);
    // shirt arms
    ctx.fillStyle = '#de2d2d';
    ctx.fillRect(x + 1, y + 6, 2, 4);
    ctx.fillRect(x + 9, y + 6, 2, 4);
    // head
    ctx.fillStyle = '#f1c27d';
    ctx.fillRect(x + 3, y + 2, 8, 4);
    // hat
    ctx.fillStyle = '#de2d2d';
    ctx.fillRect(x + 2, y + 0, 9, 2);
    // eyes
    ctx.fillStyle = '#000';
    const eyeX = p.dx >= 0 ? x + 8 : x + 4;
    ctx.fillRect(eyeX, y + 3, 1, 1);
  }

  // Touch controls
  useEffect(() => {
    const left = document.getElementById('btn-left');
    const right = document.getElementById('btn-right');
    const jump = document.getElementById('btn-jump');
    const i = inputRef.current;
    const set = (k, v) => () => (i[k] = v);
    const add = (el, k) => {
      if (!el) return;
      el.addEventListener('touchstart', set(k, true));
      el.addEventListener('touchend', set(k, false));
      el.addEventListener('touchcancel', set(k, false));
    };
    add(left, 'left');
    add(right, 'right');
    add(jump, 'up');
  }, []);

  return (
    <div className="w-full flex flex-col items-center" ref={wrapRef}>
      <div className="w-full flex justify-center p-3">
        <canvas
          ref={canvasRef}
          className="bg-slate-900 border border-slate-700 rounded-lg image-rendering-pixelated"
          style={{ imageRendering: 'pixelated' }}
        />
      </div>
      <div className="mt-2 grid grid-cols-3 gap-2 w-full max-w-md select-none md:hidden">
        <button id="btn-left" className="py-3 rounded-lg bg-slate-800 border border-slate-700 active:bg-slate-700">Left</button>
        <button id="btn-right" className="py-3 rounded-lg bg-slate-800 border border-slate-700 active:bg-slate-700">Right</button>
        <button id="btn-jump" className="py-3 rounded-lg bg-emerald-600 border border-emerald-500 text-white active:bg-emerald-500">Jump</button>
      </div>
    </div>
  );
}
