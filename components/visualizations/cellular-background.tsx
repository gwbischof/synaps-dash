'use client';

import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

interface CellPoint {
  x: number;
  y: number;
}

interface Cell {
  x: number;
  y: number;
  vx: number;
  vy: number;
  basePoints: CellPoint[]; // Points relative to center
  opacity: number;
  hue: number;
}

interface Beam {
  x: number;
  angle: number;
  width: number;
  opacity: number;
}

// Generate irregular blob points relative to center (0,0)
function generateBlobPoints(baseRadius: number, irregularity: number): CellPoint[] {
  const points: CellPoint[] = [];
  const numPoints = 12;

  for (let i = 0; i < numPoints; i++) {
    const angle = (i / numPoints) * Math.PI * 2;
    const radiusVariation = 1 + (Math.random() - 0.5) * irregularity;
    const radius = baseRadius * radiusVariation;

    points.push({
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
    });
  }

  return points;
}

// Get world-space points
function getWorldPoints(cell: Cell): CellPoint[] {
  return cell.basePoints.map(p => ({
    x: cell.x + p.x,
    y: cell.y + p.y,
  }));
}

// Calculate bounding box of points
function getBounds(points: CellPoint[]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }

  return { minX, minY, maxX, maxY };
}

export function CellularBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cellsRef = useRef<Cell[]>([]);
  const beamsRef = useRef<Beam[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    let animationId: number;
    let w = window.innerWidth;
    let h = window.innerHeight;

    const init = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;

      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Generate cells
      cellsRef.current = [];
      const cellCount = Math.floor((w * h) / 40000);

      for (let i = 0; i < cellCount; i++) {
        const baseRadius = 35 + Math.random() * 60;
        const irregularity = 0.4 + Math.random() * 0.3;
        const basePoints = generateBlobPoints(baseRadius, irregularity);

        // Warm color palette
        const warmHues = [
          20 + Math.random() * 15,
          35 + Math.random() * 15,
          5 + Math.random() * 15,
          350 + Math.random() * 15,
          15 + Math.random() * 10,
        ];
        const hue = warmHues[Math.floor(Math.random() * warmHues.length)];

        // Random velocity - slow drift
        const speed = 0.15 + Math.random() * 0.25;
        const angle = Math.random() * Math.PI * 2;

        cellsRef.current.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          basePoints,
          opacity: 0.18 + Math.random() * 0.2,
          hue,
        });
      }

      // Generate beams
      beamsRef.current = [];
      const beamCount = 3 + Math.floor(Math.random() * 2);

      for (let i = 0; i < beamCount; i++) {
        beamsRef.current.push({
          x: (w / (beamCount + 1)) * (i + 1) + (Math.random() - 0.5) * 200,
          angle: -20 + Math.random() * 10,
          width: 150 + Math.random() * 250,
          opacity: 0.05 + Math.random() * 0.05,
        });
      }
    };

    const drawBlobShape = (points: CellPoint[]) => {
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);

      for (let i = 0; i < points.length; i++) {
        const p0 = points[i];
        const p1 = points[(i + 1) % points.length];
        const p2 = points[(i + 2) % points.length];

        const nextCpX = (p1.x + p2.x) / 2;
        const nextCpY = (p1.y + p2.y) / 2;

        ctx.quadraticCurveTo(p1.x, p1.y, nextCpX, nextCpY);
      }

      ctx.closePath();
    };

    const render = () => {
      // Update cell positions
      cellsRef.current.forEach(cell => {
        cell.x += cell.vx;
        cell.y += cell.vy;

        // Wrap around edges
        if (cell.x < -100) cell.x = w + 100;
        if (cell.x > w + 100) cell.x = -100;
        if (cell.y < -100) cell.y = h + 100;
        if (cell.y > h + 100) cell.y = -100;
      });

      // Clear with background
      const bgGradient = ctx.createRadialGradient(w * 0.5, h * 0.5, 0, w * 0.5, h * 0.5, Math.max(w, h) * 0.8);
      bgGradient.addColorStop(0, '#0f0d0b');
      bgGradient.addColorStop(0.5, '#0a0908');
      bgGradient.addColorStop(1, '#070605');
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, 0, w, h);

      // Draw light beams
      beamsRef.current.forEach(beam => {
        ctx.save();
        ctx.translate(beam.x, 0);
        ctx.rotate((beam.angle * Math.PI) / 180);

        const gradient = ctx.createLinearGradient(-beam.width, 0, beam.width, 0);
        gradient.addColorStop(0, 'transparent');
        gradient.addColorStop(0.2, `rgba(255, 200, 120, ${beam.opacity * 0.3})`);
        gradient.addColorStop(0.4, `rgba(255, 240, 200, ${beam.opacity * 0.8})`);
        gradient.addColorStop(0.5, `rgba(255, 255, 245, ${beam.opacity})`);
        gradient.addColorStop(0.6, `rgba(255, 220, 180, ${beam.opacity * 0.7})`);
        gradient.addColorStop(0.8, `rgba(220, 140, 100, ${beam.opacity * 0.3})`);
        gradient.addColorStop(1, 'transparent');

        ctx.fillStyle = gradient;
        ctx.fillRect(-beam.width, -h * 0.5, beam.width * 2, h * 2);
        ctx.restore();
      });

      // Draw cells
      cellsRef.current.forEach((cell) => {
        const worldPoints = getWorldPoints(cell);
        const bounds = getBounds(worldPoints);
        const padding = 3;

        // Bounding box
        ctx.strokeStyle = `hsla(${cell.hue}, 30%, 50%, ${cell.opacity * 0.6})`;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(
          bounds.minX - padding,
          bounds.minY - padding,
          bounds.maxX - bounds.minX + padding * 2,
          bounds.maxY - bounds.minY + padding * 2
        );

        // Corner markers
        const cornerSize = 6;
        ctx.strokeStyle = `hsla(${cell.hue}, 40%, 60%, ${cell.opacity * 0.8})`;
        ctx.lineWidth = 2;

        // Top-left
        ctx.beginPath();
        ctx.moveTo(bounds.minX - padding, bounds.minY - padding + cornerSize);
        ctx.lineTo(bounds.minX - padding, bounds.minY - padding);
        ctx.lineTo(bounds.minX - padding + cornerSize, bounds.minY - padding);
        ctx.stroke();

        // Top-right
        ctx.beginPath();
        ctx.moveTo(bounds.maxX + padding - cornerSize, bounds.minY - padding);
        ctx.lineTo(bounds.maxX + padding, bounds.minY - padding);
        ctx.lineTo(bounds.maxX + padding, bounds.minY - padding + cornerSize);
        ctx.stroke();

        // Bottom-left
        ctx.beginPath();
        ctx.moveTo(bounds.minX - padding, bounds.maxY + padding - cornerSize);
        ctx.lineTo(bounds.minX - padding, bounds.maxY + padding);
        ctx.lineTo(bounds.minX - padding + cornerSize, bounds.maxY + padding);
        ctx.stroke();

        // Bottom-right
        ctx.beginPath();
        ctx.moveTo(bounds.maxX + padding - cornerSize, bounds.maxY + padding);
        ctx.lineTo(bounds.maxX + padding, bounds.maxY + padding);
        ctx.lineTo(bounds.maxX + padding, bounds.maxY + padding - cornerSize);
        ctx.stroke();

        // Outer glow
        drawBlobShape(worldPoints);
        const outerGlow = ctx.createRadialGradient(
          cell.x, cell.y, 20,
          cell.x, cell.y, 100
        );
        outerGlow.addColorStop(0, `hsla(${cell.hue}, 50%, 50%, ${cell.opacity * 0.15})`);
        outerGlow.addColorStop(1, 'transparent');
        ctx.fillStyle = outerGlow;
        ctx.fill();

        // Cell membrane
        drawBlobShape(worldPoints);
        ctx.strokeStyle = `hsla(${cell.hue}, 35%, 60%, ${cell.opacity * 0.9})`;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Cytoplasm fill
        drawBlobShape(worldPoints);
        const cytoGradient = ctx.createRadialGradient(
          cell.x - 10, cell.y - 10, 0,
          cell.x, cell.y, 80
        );
        cytoGradient.addColorStop(0, `hsla(${cell.hue}, 45%, 50%, ${cell.opacity * 0.4})`);
        cytoGradient.addColorStop(0.5, `hsla(${cell.hue}, 35%, 40%, ${cell.opacity * 0.25})`);
        cytoGradient.addColorStop(1, `hsla(${cell.hue + 10}, 30%, 30%, ${cell.opacity * 0.1})`);
        ctx.fillStyle = cytoGradient;
        ctx.fill();
      });

      // Vignette
      const vignette = ctx.createRadialGradient(
        w * 0.5, h * 0.5, h * 0.3,
        w * 0.5, h * 0.5, Math.max(w, h) * 0.9
      );
      vignette.addColorStop(0, 'transparent');
      vignette.addColorStop(0.6, 'transparent');
      vignette.addColorStop(1, 'rgba(5, 4, 3, 0.4)');
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, w, h);

      animationId = requestAnimationFrame(render);
    };

    init();
    render();

    const handleResize = () => {
      init();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationId);
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
