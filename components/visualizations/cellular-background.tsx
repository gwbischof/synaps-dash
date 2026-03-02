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
  basePoints: CellPoint[];
  opacity: number;
  hue: number;
  saturation: number;
}

interface Beam {
  x: number;
  angle: number;
  width: number;
  opacity: number;
  hue: number;
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
  const starsRef = useRef<{ x: number; y: number; size: number; twinkleOffset: number }[]>([]);
  const timeRef = useRef(0);

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

      // Generate stars
      starsRef.current = [];
      const starCount = Math.floor((w * h) / 8000);
      for (let i = 0; i < starCount; i++) {
        starsRef.current.push({
          x: Math.random() * w,
          y: Math.random() * h,
          size: Math.random() * 1.5 + 0.5,
          twinkleOffset: Math.random() * Math.PI * 2,
        });
      }

      // Generate cells - cosmic nebula clouds
      cellsRef.current = [];
      const cellCount = Math.floor((w * h) / 45000);

      for (let i = 0; i < cellCount; i++) {
        const baseRadius = 40 + Math.random() * 70;
        const irregularity = 0.4 + Math.random() * 0.3;
        const basePoints = generateBlobPoints(baseRadius, irregularity);

        // Cosmic color palette: nebula purples, teals, blues, magentas
        const cosmicColors = [
          { hue: 270, saturation: 60 },  // Deep purple
          { hue: 280, saturation: 55 },  // Violet
          { hue: 250, saturation: 50 },  // Blue-purple
          { hue: 320, saturation: 45 },  // Magenta
          { hue: 175, saturation: 55 },  // Teal
          { hue: 200, saturation: 50 },  // Cyan-blue
          { hue: 220, saturation: 55 },  // Deep blue
          { hue: 340, saturation: 40 },  // Pink
        ];
        const color = cosmicColors[Math.floor(Math.random() * cosmicColors.length)];

        // Slow drift
        const speed = 0.12 + Math.random() * 0.2;
        const angle = Math.random() * Math.PI * 2;

        cellsRef.current.push({
          x: Math.random() * w,
          y: Math.random() * h,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          basePoints,
          opacity: 0.15 + Math.random() * 0.18,
          hue: color.hue,
          saturation: color.saturation,
        });
      }

      // Generate cosmic light beams
      beamsRef.current = [];
      const beamCount = 2 + Math.floor(Math.random() * 2);

      for (let i = 0; i < beamCount; i++) {
        const beamHues = [175, 250, 280, 320]; // Teal, blue, purple, pink
        beamsRef.current.push({
          x: (w / (beamCount + 1)) * (i + 1) + (Math.random() - 0.5) * 300,
          angle: -15 + Math.random() * 10,
          width: 200 + Math.random() * 300,
          opacity: 0.04 + Math.random() * 0.04,
          hue: beamHues[Math.floor(Math.random() * beamHues.length)],
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
      timeRef.current += 0.016;

      // Update cell positions
      cellsRef.current.forEach(cell => {
        cell.x += cell.vx;
        cell.y += cell.vy;

        if (cell.x < -120) cell.x = w + 120;
        if (cell.x > w + 120) cell.x = -120;
        if (cell.y < -120) cell.y = h + 120;
        if (cell.y > h + 120) cell.y = -120;
      });

      // Deep space background gradient
      const bgGradient = ctx.createRadialGradient(w * 0.5, h * 0.5, 0, w * 0.5, h * 0.5, Math.max(w, h) * 0.9);
      bgGradient.addColorStop(0, '#0a0a12');
      bgGradient.addColorStop(0.3, '#080810');
      bgGradient.addColorStop(0.6, '#06060c');
      bgGradient.addColorStop(1, '#040408');
      ctx.fillStyle = bgGradient;
      ctx.fillRect(0, 0, w, h);

      // Draw distant stars
      starsRef.current.forEach(star => {
        const twinkle = Math.sin(timeRef.current * 2 + star.twinkleOffset) * 0.3 + 0.7;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(200, 210, 255, ${0.3 * twinkle})`;
        ctx.fill();
      });

      // Draw cosmic light beams
      beamsRef.current.forEach(beam => {
        ctx.save();
        ctx.translate(beam.x, 0);
        ctx.rotate((beam.angle * Math.PI) / 180);

        const gradient = ctx.createLinearGradient(-beam.width, 0, beam.width, 0);
        gradient.addColorStop(0, 'transparent');
        gradient.addColorStop(0.2, `hsla(${beam.hue}, 60%, 70%, ${beam.opacity * 0.3})`);
        gradient.addColorStop(0.4, `hsla(${beam.hue}, 50%, 80%, ${beam.opacity * 0.7})`);
        gradient.addColorStop(0.5, `hsla(${beam.hue}, 40%, 90%, ${beam.opacity})`);
        gradient.addColorStop(0.6, `hsla(${beam.hue + 20}, 50%, 75%, ${beam.opacity * 0.6})`);
        gradient.addColorStop(0.8, `hsla(${beam.hue + 40}, 45%, 65%, ${beam.opacity * 0.3})`);
        gradient.addColorStop(1, 'transparent');

        ctx.fillStyle = gradient;
        ctx.fillRect(-beam.width, -h * 0.5, beam.width * 2, h * 2);
        ctx.restore();
      });

      // Draw nebula cells
      cellsRef.current.forEach((cell) => {
        const worldPoints = getWorldPoints(cell);
        const bounds = getBounds(worldPoints);
        const padding = 3;

        // Detection bounding box
        ctx.strokeStyle = `hsla(${cell.hue}, ${cell.saturation}%, 60%, ${cell.opacity * 0.5})`;
        ctx.lineWidth = 1;
        ctx.strokeRect(
          bounds.minX - padding,
          bounds.minY - padding,
          bounds.maxX - bounds.minX + padding * 2,
          bounds.maxY - bounds.minY + padding * 2
        );

        // Corner markers
        const cornerSize = 6;
        ctx.strokeStyle = `hsla(${cell.hue}, ${cell.saturation + 10}%, 70%, ${cell.opacity * 0.7})`;
        ctx.lineWidth = 1.5;

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

        // Outer nebula glow
        drawBlobShape(worldPoints);
        const outerGlow = ctx.createRadialGradient(
          cell.x, cell.y, 10,
          cell.x, cell.y, 100
        );
        outerGlow.addColorStop(0, `hsla(${cell.hue}, ${cell.saturation}%, 50%, ${cell.opacity * 0.2})`);
        outerGlow.addColorStop(0.5, `hsla(${cell.hue + 20}, ${cell.saturation - 10}%, 40%, ${cell.opacity * 0.1})`);
        outerGlow.addColorStop(1, 'transparent');
        ctx.fillStyle = outerGlow;
        ctx.fill();

        // Nebula cloud membrane
        drawBlobShape(worldPoints);
        ctx.strokeStyle = `hsla(${cell.hue}, ${cell.saturation + 15}%, 65%, ${cell.opacity * 0.8})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Inner nebula fill
        drawBlobShape(worldPoints);
        const nebulaGradient = ctx.createRadialGradient(
          cell.x - 8, cell.y - 8, 0,
          cell.x, cell.y, 70
        );
        nebulaGradient.addColorStop(0, `hsla(${cell.hue}, ${cell.saturation + 10}%, 55%, ${cell.opacity * 0.5})`);
        nebulaGradient.addColorStop(0.4, `hsla(${cell.hue + 15}, ${cell.saturation}%, 45%, ${cell.opacity * 0.3})`);
        nebulaGradient.addColorStop(0.8, `hsla(${cell.hue + 30}, ${cell.saturation - 15}%, 35%, ${cell.opacity * 0.15})`);
        nebulaGradient.addColorStop(1, 'transparent');
        ctx.fillStyle = nebulaGradient;
        ctx.fill();
      });

      // Subtle vignette
      const vignette = ctx.createRadialGradient(
        w * 0.5, h * 0.5, h * 0.25,
        w * 0.5, h * 0.5, Math.max(w, h) * 0.85
      );
      vignette.addColorStop(0, 'transparent');
      vignette.addColorStop(0.5, 'transparent');
      vignette.addColorStop(1, 'rgba(4, 4, 8, 0.5)');
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
