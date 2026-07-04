"use client";

import { useEffect, useRef, useContext, useCallback } from 'react';
import VoiceAssistantContext from '../../context/VoiceAssistantContext';

const DigitalHumanContainer = () => {
  const {
    mouthOpen,
    characterName = 'Xiao Wei',
  } = useContext(VoiceAssistantContext);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animRef = useRef<number>(0);
  const blinkRef = useRef(0);

  const drawFace = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number, mouthVal: number) => {
    const s = Math.min(w, h) / 400; // scale factor
    const cx = w / 2;
    const cy = h / 2 + 30 * s;

    ctx.clearRect(0, 0, w, h);

    // ── Skin tone gradient ──
    const skinGrad = ctx.createLinearGradient(cx, cy - 120 * s, cx, cy + 60 * s);
    skinGrad.addColorStop(0, '#FFE4D6');
    skinGrad.addColorStop(1, '#FDDBC8');
    ctx.fillStyle = skinGrad;

    // ── Head (rounded) ──
    ctx.beginPath();
    ctx.ellipse(cx, cy - 20 * s, 70 * s, 85 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // ── Hair (side-swept bob) ──
    ctx.fillStyle = '#4A3728';
    // Left hair
    ctx.beginPath();
    ctx.ellipse(cx - 62 * s, cy - 30 * s, 25 * s, 70 * s, -0.3, 0, Math.PI * 2);
    ctx.fill();
    // Right hair  
    ctx.beginPath();
    ctx.ellipse(cx + 62 * s, cy - 30 * s, 25 * s, 70 * s, 0.3, 0, Math.PI * 2);
    ctx.fill();
    // Bangs
    ctx.beginPath();
    ctx.ellipse(cx, cy - 95 * s, 70 * s, 25 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // ── Eyes ──
    const eyeY = cy - 15 * s;
    const blinkState = blinkRef.current > 0 ? Math.min(1, blinkRef.current / 0.08) : 0;
    const eyeOpen = 1 - blinkState;

    for (const side of [-1, 1]) {
      const ex = cx + side * 24 * s;

      // Eye white
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.ellipse(ex, eyeY, 14 * s, 16 * s * eyeOpen, 0, 0, Math.PI * 2);
      ctx.fill();

      if (eyeOpen > 0.3) {
        // Iris (looking slightly towards user)
        const lookX = Math.sin(Date.now() / 4000) * 2 * s;
        const lookY = Math.sin(Date.now() / 5000) * 1.5 * s;
        const irisX = ex + lookX;
        const irisY = eyeY + lookY;

        ctx.fillStyle = '#5B7D5B';
        ctx.beginPath();
        ctx.ellipse(irisX, irisY, 8 * s, 9 * s * eyeOpen, 0, 0, Math.PI * 2);
        ctx.fill();

        // Pupil
        ctx.fillStyle = '#1a1a2e';
        ctx.beginPath();
        ctx.ellipse(irisX, irisY + 2 * s, 4 * s, 5 * s * eyeOpen, 0, 0, Math.PI * 2);
        ctx.fill();

        // Highlight
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.ellipse(irisX + 3 * s, irisY - 4 * s, 2 * s, 3 * s * eyeOpen, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // ── Blush ──
    const blushAlpha = 0.15 + Math.sin(Date.now() / 3000) * 0.05;
    ctx.fillStyle = `rgba(255, 150, 150, ${blushAlpha})`;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(cx + side * 30 * s, cy + 10 * s, 15 * s, 8 * s, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // ── Eyebrows ──
    ctx.strokeStyle = '#4A3728';
    ctx.lineWidth = 2.5 * s;
    for (const side of [-1, 1]) {
      const bx = cx + side * 22 * s;
      const by = eyeY - 25 * s;
      const tilt = Math.sin(Date.now() / 6000) * 0.1; // subtle eyebrow movement
      ctx.beginPath();
      ctx.moveTo(bx - 10 * s, by + tilt * s);
      ctx.quadraticCurveTo(bx, by - 5 * s + tilt * s, bx + 10 * s, by + tilt * s);
      ctx.stroke();
    }

    // ── Nose ──
    ctx.fillStyle = '#F5CBB8';
    ctx.beginPath();
    ctx.ellipse(cx + 1 * s, cy + 8 * s, 2.5 * s, 3 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // ── Mouth ──
    const mouthH = 2 + mouthVal * 10;
    const mouthY = cy + 28 * s;

    // Mouth line
    ctx.strokeStyle = '#D4796E';
    ctx.lineWidth = 2 * s;
    ctx.beginPath();
    ctx.moveTo(cx - 12 * s, mouthY);
    ctx.quadraticCurveTo(cx, mouthY + mouthH * s, cx + 12 * s, mouthY);
    ctx.stroke();

    // Inner mouth (when speaking)
    if (mouthVal > 0.15) {
      ctx.fillStyle = '#8B3A3A';
      ctx.beginPath();
      ctx.ellipse(cx, mouthY + 2 * s, 10 * s, Math.min(mouthH * 0.7, 6) * s, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // ── Smile dimples ──
    if (mouthVal < 0.1) {
      ctx.fillStyle = 'rgba(255, 180, 180, 0.3)';
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(cx + side * 18 * s, mouthY + 4 * s, 4 * s, 2 * s, 0.3 * side, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // ── Neck ──
    ctx.fillStyle = '#FDDBC8';
    ctx.fillRect(cx - 10 * s, cy + 60 * s, 20 * s, 25 * s);

    // ── Collar / shoulders ──
    ctx.fillStyle = '#7B9CB5';
    ctx.beginPath();
    ctx.moveTo(cx - 90 * s, cy + 100 * s);
    ctx.quadraticCurveTo(cx - 60 * s, cy + 70 * s, cx - 20 * s, cy + 80 * s);
    ctx.lineTo(cx + 20 * s, cy + 80 * s);
    ctx.quadraticCurveTo(cx + 60 * s, cy + 70 * s, cx + 90 * s, cy + 100 * s);
    ctx.lineTo(cx + 90 * s, cy + 120 * s);
    ctx.lineTo(cx - 90 * s, cy + 120 * s);
    ctx.closePath();
    ctx.fill();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d')!;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = rect.width + 'px';
      canvas.style.height = rect.height + 'px';
      ctx.scale(dpr, dpr);
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    let lastBlink = performance.now();
    let lastMouth = 0;

    const animate = (time: number) => {
      const rect = container!.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      ctx.setTransform(window.devicePixelRatio || 1, 0, 0, window.devicePixelRatio || 1, 0, 0);

      // Blink every 3-5 seconds
      if (time - lastBlink > 3000 + Math.random() * 2000) {
        blinkRef.current = 0.08; // blink duration in seconds
        lastBlink = time;
      }
      if (blinkRef.current > 0) {
        blinkRef.current -= 0.016; // ~60fps
      }

      // Smooth mouth value
      lastMouth += (mouthOpen - lastMouth) * 0.3;

      drawFace(ctx, w, h, lastMouth);
      animRef.current = requestAnimationFrame(animate);
    };

    animRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animRef.current);
      ro.disconnect();
    };
  }, [drawFace, mouthOpen]);

  return (
    <div
      ref={containerRef}
      className="flex flex-col items-center justify-center bg-gradient-to-b from-[#F8F0E6] to-[#F0E8DC] rounded-[var(--shape-md)] shadow-elevation-1 border border-[var(--md-outline)] p-3 sm:p-4 overflow-hidden"
      style={{ height: '100%', maxHeight: '65vh', minHeight: 0 }}
    >
      <div className="flex items-center gap-2 mb-1 sm:mb-2 text-label-sm sm:text-body-md text-[var(--md-on-surface-variant)] shrink-0">
        <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-[var(--shape-full)] bg-[#48BB78] animate-pulse" />
        {characterName || 'Character'} is here
      </div>
      <canvas ref={canvasRef} className="w-full flex-1" style={{ maxHeight: 'calc(65vh - 40px)' }} />
    </div>
  );
};

export default DigitalHumanContainer;
