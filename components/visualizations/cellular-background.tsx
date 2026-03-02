'use client';

import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

interface Cell {
  x: number;
  y: number;
  baseRadius: number;
  points: { angle: number; radiusMod: number }[];
  opacity: number;
  hue: number;
}

interface Beam {
  x: number;
  angle: number;
  width: number;
  opacity: number;
}

export function CellularBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    const render = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = window.innerWidth;
      const h = window.innerHeight;

      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.scale(dpr, dpr);

      // Generate cells
      const cells: Cell[] = [];
      const cellCount = Math.floor((w * h) / 25000);

      for (let i = 0; i < cellCount; i++) {
        const numPoints = 5 + Math.floor(Math.random() * 4);
        const points: { angle: number; radiusMod: number }[] = [];

        for (let j = 0; j < numPoints; j++) {
          const baseAngle = (j / numPoints) * Math.PI * 2;
          const angleOffset = (Math.random() - 0.5) * 0.5;
          const radiusMod = 0.4 + Math.random() * 0.9;
          points.push({ angle: baseAngle + angleOffset, radiusMod });
        }

        points.sort((a, b) => a.angle - b.angle);

        cells.push({
          x: Math.random() * w,
          y: Math.random() * h,
          baseRadius: 60 + Math.random() * 120,
          points,
          opacity: 0.12 + Math.random() * 0.15,
          hue: Math.random() > 0.5 ? 30 : 355,
        });
      }

      // Generate beams - fixed positions
      const beams: Beam[] = [];
      const beamCount = 4 + Math.floor(Math.random() * 3);

      for (let i = 0; i < beamCount; i++) {
        beams.push({
          x: (w / (beamCount + 1)) * (i + 1) + (Math.random() - 0.5) * 200,
          angle: -25 + Math.random() * 15,
          width: 100 + Math.random() * 200,
          opacity: 0.08 + Math.random() * 0.08,
        });
      }

      const drawCell = (cell: Cell) => {
        ctx.beginPath();

        const firstPoint = cell.points[0];
        const firstRadius = cell.baseRadius * firstPoint.radiusMod;
        ctx.moveTo(
          cell.x + Math.cos(firstPoint.angle) * firstRadius,
          cell.y + Math.sin(firstPoint.angle) * firstRadius
        );

        for (let i = 0; i < cell.points.length; i++) {
          const current = cell.points[i];
          const next = cell.points[(i + 1) % cell.points.length];

          const currentRadius = cell.baseRadius * current.radiusMod;
          const nextRadius = cell.baseRadius * next.radiusMod;

          const cpAngle = (current.angle + next.angle) / 2;
          const cpRadius = ((currentRadius + nextRadius) / 2) * 1.15;

          const nextX = cell.x + Math.cos(next.angle) * nextRadius;
          const nextY = cell.y + Math.sin(next.angle) * nextRadius;
          const cpX = cell.x + Math.cos(cpAngle) * cpRadius;
          const cpY = cell.y + Math.sin(cpAngle) * cpRadius;

          ctx.quadraticCurveTo(cpX, cpY, nextX, nextY);
        }

        ctx.closePath();
      };

      // Deep warm background with subtle gradient
      const bgGradient = ctx.createRadialGradient(w * 0.5, h * 0.5, 0, w * 0.5, h * 0.5, Math.max(w, h) * 0.8);
      bgGradient.addColorStop(0, '#100e0c');
      bgGradient.addColorStop(0.5, '#0c0a09');
      bgGradient.addColorStop(1, '#080706');
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, 0, w, h);

      // Draw light beams (behind cells) - STATIC
      beams.forEach(beam => {
        ctx.save();
        ctx.translate(beam.x, 0);
        ctx.rotate((beam.angle * Math.PI) / 180);

        const gradient = ctx.createLinearGradient(-beam.width, 0, beam.width, 0);
        gradient.addColorStop(0, 'transparent');
        gradient.addColorStop(0.15, `rgba(233, 168, 74, ${beam.opacity * 0.4})`);
        gradient.addColorStop(0.35, `rgba(255, 220, 180, ${beam.opacity * 1.0})`);
        gradient.addColorStop(0.5, `rgba(255, 250, 240, ${beam.opacity * 1.2})`);
        gradient.addColorStop(0.65, `rgba(255, 200, 170, ${beam.opacity * 0.9})`);
        gradient.addColorStop(0.85, `rgba(212, 115, 122, ${beam.opacity * 0.4})`);
        gradient.addColorStop(1, 'transparent');

        ctx.fillStyle = gradient;
        ctx.fillRect(-beam.width, -h * 0.5, beam.width * 2, h * 2);
        ctx.restore();
      });

      // Draw cells
      cells.forEach((cell, i) => {
        // Outer glow
        drawCell(cell);
        const outerGlow = ctx.createRadialGradient(
          cell.x, cell.y, 0,
          cell.x, cell.y, cell.baseRadius * 1.6
        );
        outerGlow.addColorStop(0, `hsla(${cell.hue}, 80%, 65%, ${cell.opacity * 0.5})`);
        outerGlow.addColorStop(0.4, `hsla(${cell.hue}, 70%, 55%, ${cell.opacity * 0.25})`);
        outerGlow.addColorStop(1, 'transparent');
        ctx.fillStyle = outerGlow;
        ctx.fill();

        // Main cell fill
        drawCell(cell);
        const gradient = ctx.createRadialGradient(
          cell.x - cell.baseRadius * 0.3, cell.y - cell.baseRadius * 0.3, 0,
          cell.x, cell.y, cell.baseRadius
        );
        gradient.addColorStop(0, `hsla(${cell.hue}, 75%, 70%, ${cell.opacity * 1.5})`);
        gradient.addColorStop(0.3, `hsla(${cell.hue}, 65%, 60%, ${cell.opacity * 1.0})`);
        gradient.addColorStop(0.6, `hsla(${cell.hue + 15}, 55%, 50%, ${cell.opacity * 0.6})`);
        gradient.addColorStop(1, 'transparent');
        ctx.fillStyle = gradient;
        ctx.fill();

        // Cell membrane
        drawCell(cell);
        ctx.strokeStyle = `hsla(${cell.hue}, 50%, 85%, ${cell.opacity * 0.8})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Inner structure hint
        if (cell.baseRadius > 50) {
          const innerCell = { ...cell, baseRadius: cell.baseRadius * 0.5 };
          drawCell(innerCell);
          ctx.strokeStyle = `hsla(${cell.hue}, 40%, 75%, ${cell.opacity * 0.4})`;
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        // Draw connections
        for (let j = i + 1; j < cells.length; j++) {
          const other = cells[j];
          const dist = Math.hypot(cell.x - other.x, cell.y - other.y);
          const maxDist = cell.baseRadius + other.baseRadius + 150;

          if (dist < maxDist && dist > 0) {
            const strength = Math.pow(1 - dist / maxDist, 2) * 0.25;
            const midX = (cell.x + other.x) / 2;
            const midY = (cell.y + other.y) / 2;

            ctx.beginPath();
            ctx.moveTo(cell.x, cell.y);
            const offset = Math.sin(i + j) * 20;
            ctx.quadraticCurveTo(midX + offset, midY - offset, other.x, other.y);

            const connGradient = ctx.createLinearGradient(cell.x, cell.y, other.x, other.y);
            connGradient.addColorStop(0, `hsla(${cell.hue}, 60%, 65%, ${strength})`);
            connGradient.addColorStop(0.5, `hsla(35, 70%, 70%, ${strength * 1.3})`);
            connGradient.addColorStop(1, `hsla(${other.hue}, 60%, 65%, ${strength})`);

            ctx.strokeStyle = connGradient;
            ctx.lineWidth = 2;
            ctx.stroke();
          }
        }
      });

      // Subtle vignette
      const vignette = ctx.createRadialGradient(
        w * 0.5, h * 0.5, h * 0.4,
        w * 0.5, h * 0.5, Math.max(w, h) * 0.9
      );
      vignette.addColorStop(0, 'transparent');
      vignette.addColorStop(0.7, 'transparent');
      vignette.addColorStop(1, 'rgba(8, 7, 6, 0.35)');
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, w, h);

      // Subtle grain
      ctx.fillStyle = 'rgba(255, 250, 245, 0.008)';
      for (let i = 0; i < 50; i++) {
        ctx.fillRect(
          Math.random() * w,
          Math.random() * h,
          Math.random() * 2,
          Math.random() * 2
        );
      }
    };

    // Render once
    render();

    // Re-render on resize
    const handleResize = () => render();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return (
    <motion.canvas
      ref={canvasRef}
      className="fixed inset-0"
      style={{ zIndex: 0, pointerEvents: 'none' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1.5, ease: 'easeOut' }}
    />
  );
}
