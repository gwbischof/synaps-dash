'use client';

import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

interface Cell {
  x: number;
  y: number;
  baseRadius: number;
  points: { angle: number; radiusMod: number }[];
  opacity: number;
  phase: number;
  speed: number;
}

interface Beam {
  x: number;
  angle: number;
  width: number;
  opacity: number;
  speed: number;
}

export function CellularBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cellsRef = useRef<Cell[]>([]);
  const beamsRef = useRef<Beam[]>([]);
  const frameRef = useRef<number>(0);
  const timeRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    let animationId: number;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.scale(dpr, dpr);
      initializeCells();
      initializeBeams();
    };

    const initializeCells = () => {
      cellsRef.current = [];
      const w = window.innerWidth;
      const h = window.innerHeight;
      const cellCount = Math.floor((w * h) / 50000); // Sparse distribution

      for (let i = 0; i < cellCount; i++) {
        // Create irregular polygon points
        const numPoints = 5 + Math.floor(Math.random() * 4);
        const points: { angle: number; radiusMod: number }[] = [];

        for (let j = 0; j < numPoints; j++) {
          const baseAngle = (j / numPoints) * Math.PI * 2;
          // Add irregularity to angle and radius
          const angleOffset = (Math.random() - 0.5) * 0.4;
          const radiusMod = 0.5 + Math.random() * 0.8;
          points.push({
            angle: baseAngle + angleOffset,
            radiusMod
          });
        }

        // Sort by angle to ensure proper polygon
        points.sort((a, b) => a.angle - b.angle);

        cellsRef.current.push({
          x: Math.random() * w,
          y: Math.random() * h,
          baseRadius: 40 + Math.random() * 80,
          points,
          opacity: 0.02 + Math.random() * 0.03,
          phase: Math.random() * Math.PI * 2,
          speed: 0.2 + Math.random() * 0.3
        });
      }
    };

    const initializeBeams = () => {
      beamsRef.current = [];
      const beamCount = 2 + Math.floor(Math.random() * 2);

      for (let i = 0; i < beamCount; i++) {
        beamsRef.current.push({
          x: Math.random() * window.innerWidth,
          angle: -20 + Math.random() * 10, // Slight angle variation
          width: 60 + Math.random() * 100,
          opacity: 0.015 + Math.random() * 0.015,
          speed: 0.15 + Math.random() * 0.2
        });
      }
    };

    const drawCell = (cell: Cell, breathe: number) => {
      ctx.beginPath();

      const firstPoint = cell.points[0];
      const firstRadius = cell.baseRadius * firstPoint.radiusMod * breathe;
      ctx.moveTo(
        cell.x + Math.cos(firstPoint.angle) * firstRadius,
        cell.y + Math.sin(firstPoint.angle) * firstRadius
      );

      // Draw smooth curves through points
      for (let i = 0; i < cell.points.length; i++) {
        const current = cell.points[i];
        const next = cell.points[(i + 1) % cell.points.length];

        const currentRadius = cell.baseRadius * current.radiusMod * breathe;
        const nextRadius = cell.baseRadius * next.radiusMod * breathe;

        const cpAngle = (current.angle + next.angle) / 2;
        const cpRadius = ((currentRadius + nextRadius) / 2) * 1.1;

        const nextX = cell.x + Math.cos(next.angle) * nextRadius;
        const nextY = cell.y + Math.sin(next.angle) * nextRadius;
        const cpX = cell.x + Math.cos(cpAngle) * cpRadius;
        const cpY = cell.y + Math.sin(cpAngle) * cpRadius;

        ctx.quadraticCurveTo(cpX, cpY, nextX, nextY);
      }

      ctx.closePath();
    };

    const render = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      timeRef.current += 0.006;

      // Deep warm background
      ctx.fillStyle = '#0a0908';
      ctx.fillRect(0, 0, w, h);

      // Draw light beams first (behind cells)
      beamsRef.current.forEach(beam => {
        beam.x += beam.speed;
        if (beam.x > w + beam.width * 2) {
          beam.x = -beam.width * 2;
        }

        ctx.save();
        ctx.translate(beam.x, 0);
        ctx.rotate((beam.angle * Math.PI) / 180);

        const gradient = ctx.createLinearGradient(-beam.width, 0, beam.width, 0);
        gradient.addColorStop(0, 'transparent');
        gradient.addColorStop(0.3, `rgba(233, 168, 74, ${beam.opacity * 0.5})`);
        gradient.addColorStop(0.5, `rgba(245, 243, 240, ${beam.opacity})`);
        gradient.addColorStop(0.7, `rgba(212, 115, 122, ${beam.opacity * 0.3})`);
        gradient.addColorStop(1, 'transparent');

        ctx.fillStyle = gradient;
        ctx.fillRect(-beam.width, -h * 0.5, beam.width * 2, h * 2);
        ctx.restore();
      });

      // Draw cells
      cellsRef.current.forEach((cell, i) => {
        const breathe = 1 + Math.sin(timeRef.current * cell.speed + cell.phase) * 0.06;
        const currentOpacity = cell.opacity * (0.7 + Math.sin(timeRef.current * 0.5 + cell.phase) * 0.3);

        // Cell fill with gradient
        drawCell(cell, breathe);

        const gradient = ctx.createRadialGradient(
          cell.x, cell.y, 0,
          cell.x, cell.y, cell.baseRadius * breathe
        );
        gradient.addColorStop(0, `rgba(212, 115, 122, ${currentOpacity * 1.5})`);
        gradient.addColorStop(0.4, `rgba(233, 168, 74, ${currentOpacity * 0.8})`);
        gradient.addColorStop(1, 'transparent');

        ctx.fillStyle = gradient;
        ctx.fill();

        // Subtle membrane stroke
        drawCell(cell, breathe * 0.92);
        ctx.strokeStyle = `rgba(245, 243, 240, ${currentOpacity * 0.6})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();

        // Draw connections to nearby cells
        for (let j = i + 1; j < cellsRef.current.length; j++) {
          const other = cellsRef.current[j];
          const dist = Math.hypot(cell.x - other.x, cell.y - other.y);
          const maxDist = cell.baseRadius + other.baseRadius + 100;

          if (dist < maxDist && dist > 0) {
            const strength = Math.pow(1 - dist / maxDist, 2) * 0.04;
            ctx.beginPath();
            ctx.moveTo(cell.x, cell.y);
            ctx.lineTo(other.x, other.y);
            ctx.strokeStyle = `rgba(212, 115, 122, ${strength})`;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      });

      // Subtle warm vignette
      const vignette = ctx.createRadialGradient(
        w * 0.5, h * 0.5, h * 0.2,
        w * 0.5, h * 0.5, Math.max(w, h) * 0.8
      );
      vignette.addColorStop(0, 'transparent');
      vignette.addColorStop(0.5, 'transparent');
      vignette.addColorStop(1, 'rgba(10, 9, 8, 0.5)');
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, w, h);

      animationId = requestAnimationFrame(render);
    };

    resize();
    window.addEventListener('resize', resize);
    render();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <motion.canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 2, ease: 'easeOut' }}
    />
  );
}
