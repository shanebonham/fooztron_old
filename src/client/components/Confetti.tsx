/** Lightweight 2D confetti renderer. */
import { useEffect, useRef } from 'react';

interface Bit {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  vr: number;
  w: number;
  h: number;
  color: string;
  life: number;
}

let fire: ((colors: string[]) => void) | null = null;
export const fireConfetti = (colors: string[]) => fire?.(colors);

export default function Confetti() {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = canvas.current!;
    const g = c.getContext('2d')!;
    let bits: Bit[] = [];
    let raf = 0;
    const resize = () => {
      c.width = innerWidth * devicePixelRatio;
      c.height = innerHeight * devicePixelRatio;
    };
    resize();
    addEventListener('resize', resize);
    const tick = () => {
      g.clearRect(0, 0, c.width, c.height);
      const s = devicePixelRatio;
      bits = bits.filter((b) => b.life > 0 && b.y < innerHeight + 40);
      for (const b of bits) {
        b.vy += 0.18;
        b.vx *= 0.99;
        b.x += b.vx;
        b.y += b.vy;
        b.r += b.vr;
        b.life -= 1;
        g.save();
        g.translate(b.x * s, b.y * s);
        g.rotate(b.r);
        g.scale(1, Math.cos(b.r * 1.7));
        g.fillStyle = b.color;
        g.fillRect((-b.w / 2) * s, (-b.h / 2) * s, b.w * s, b.h * s);
        g.restore();
      }
      raf = bits.length ? requestAnimationFrame(tick) : 0;
    };
    fire = (colors) => {
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      for (const side of [0, 1]) {
        for (let i = 0; i < 140; i++) {
          const dir = side ? -1 : 1;
          const a = 0.35 + Math.random() * 0.6; // radians above horizontal
          const sp = 9 + Math.random() * 12;
          bits.push({
            x: side ? innerWidth : 0,
            y: innerHeight * 0.75,
            vx: dir * Math.cos(a) * sp,
            vy: -Math.sin(a) * sp - 6,
            r: Math.random() * 6,
            vr: (Math.random() - 0.5) * 0.4,
            w: 6 + Math.random() * 6,
            h: 8 + Math.random() * 8,
            color: colors[i % colors.length],
            life: 220 + Math.random() * 80,
          });
        }
      }
      if (!raf) raf = requestAnimationFrame(tick);
    };
    return () => {
      fire = null;
      cancelAnimationFrame(raf);
      removeEventListener('resize', resize);
    };
  }, []);
  return <canvas ref={canvas} className="confetti" aria-hidden />;
}
