import { memo, useEffect, useRef } from 'react';

/** Small glyphs for the grid, like a dot-matrix screen of tiny icons. */
const GLYPHS = ['•', '·', '×', '+', '◦', '♪', '✿', '☻', '◆', '▾', '⁘', '∗'];
const CELL = 11;
const FONT_PX = 8;
const ORANGE = '255, 106, 51';
const WHITE = '255, 255, 255';
/** Twinkle: a few cells change every tick. */
const TICK_MS = 140;
const CELLS_PER_TICK = 6;

type Cell = { glyph: string; alpha: number; orange: boolean };

/** Small seeded random generator, so a community always gets its pattern. */
const seeded = (seedText: string) => {
  let seed = 2166136261;
  for (const char of seedText) {
    seed = Math.imul(seed ^ (char.codePointAt(0) ?? 0), 16777619);
  }
  return () => {
    seed = Math.imul(seed ^ (seed >>> 15), 2246822507);
    seed = Math.imul(seed ^ (seed >>> 13), 3266489909);
    seed ^= seed >>> 16;
    return (seed >>> 0) / 4294967296;
  };
};

/**
 * Brightness for one cell: each column has a few bright vertical "streaks"
 * (like falling code) over a dim, sparse base, so the grid has the same
 * columnar texture as the reference.
 */
const makeGrid = (cols: number, rows: number, random: () => number) => {
  const grid: Cell[] = [];
  for (let c = 0; c < cols; c++) {
    const streakStart = Math.floor(random() * rows * 1.4) - rows * 0.2;
    const streakLength = rows * (0.25 + random() * 0.6);
    for (let r = 0; r < rows; r++) {
      grid.push(
        makeCell(r >= streakStart && r < streakStart + streakLength, random)
      );
    }
  }
  return grid;
};

const makeCell = (inStreak: boolean, random: () => number): Cell => {
  const empty = random() < (inStreak ? 0.08 : 0.35);
  const alpha = empty
    ? 0
    : inStreak
      ? 0.45 + random() * 0.55
      : 0.06 + random() * 0.18;
  return {
    glyph: GLYPHS[Math.floor(random() * GLYPHS.length)] ?? '•',
    alpha,
    orange: inStreak && random() < 0.07,
  };
};

/**
 * Banner stand-in for communities without one: a black field of tiny white
 * (and a few orange) glyphs in bright vertical streaks that gently twinkle.
 * Drawn on a canvas sized to the banner; static when the viewer prefers
 * reduced motion or the app is in the background.
 */
export const NoBannerPattern = memo(({ seed }: { seed: string }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;

    const random = seeded(seed);
    let cols = 0;
    let rows = 0;
    let grid: Cell[] = [];

    const drawCell = (index: number) => {
      const cell = grid[index];
      if (!cell) return;
      const x = Math.floor(index / rows) * CELL + CELL / 2;
      const y = (index % rows) * CELL + CELL / 2;
      context.clearRect(x - CELL / 2, y - CELL / 2, CELL, CELL);
      if (cell.alpha === 0) return;
      context.fillStyle = `rgba(${cell.orange ? ORANGE : WHITE}, ${cell.alpha})`;
      context.fillText(cell.glyph, x, y);
    };

    const layout = () => {
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;
      if (width === 0 || height === 0) return;
      const ratio = window.devicePixelRatio || 1;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      context.font = `700 ${FONT_PX}px system-ui, sans-serif`;
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      cols = Math.ceil(width / CELL);
      rows = Math.ceil(height / CELL);
      grid = makeGrid(cols, rows, random);
      context.clearRect(0, 0, width, height);
      for (let i = 0; i < grid.length; i++) drawCell(i);
    };

    layout();
    const observer = new ResizeObserver(layout);
    observer.observe(canvas);

    const reduceMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)'
    ).matches;
    const timer = reduceMotion
      ? undefined
      : window.setInterval(() => {
          if (document.hidden || grid.length === 0) return;
          for (let n = 0; n < CELLS_PER_TICK; n++) {
            const index = Math.floor(random() * grid.length);
            const inStreak = (grid[index]?.alpha ?? 0) > 0.3;
            grid[index] = makeCell(inStreak, random);
            drawCell(index);
          }
        }, TICK_MS);

    return () => {
      observer.disconnect();
      window.clearInterval(timer);
    };
  }, [seed]);

  return (
    <canvas ref={canvasRef} className="no-banner__canvas" aria-hidden="true" />
  );
});
NoBannerPattern.displayName = 'NoBannerPattern';
