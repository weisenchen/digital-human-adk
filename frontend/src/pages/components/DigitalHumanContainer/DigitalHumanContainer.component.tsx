"use client";

import { useEffect, useRef, useContext, useCallback, useState } from 'react';
import VoiceAssistantContext from '../../context/VoiceAssistantContext';

const DigitalHumanContainer = () => {
  const {
    mouthOpen,
    characterName = 'Xiao Wei',
    selectedGender = 'female',
  } = useContext(VoiceAssistantContext);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animRef = useRef<number>(0);
  const blinkRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const customImgRef = useRef<HTMLImageElement | null>(null);
  const [customAvatar, setCustomAvatar] = useState<string | null>(null);

  // Load custom avatar image when URL changes
  useEffect(() => {
    if (customAvatar) {
      const img = new Image();
      img.onload = () => { customImgRef.current = img; };
      img.src = customAvatar;
    } else {
      customImgRef.current = null;
    }
  }, [customAvatar]);

  // ── Female face ──
  const drawFemale = useCallback((ctx: CanvasRenderingContext2D, s: number, cx: number, cy: number, mouthVal: number) => {
    // Skin
    const skinGrad = ctx.createLinearGradient(cx, cy - 120 * s, cx, cy + 60 * s);
    skinGrad.addColorStop(0, '#FFE4D6');
    skinGrad.addColorStop(1, '#FDDBC8');
    ctx.fillStyle = skinGrad;

    // Head (rounder)
    ctx.beginPath();
    ctx.ellipse(cx, cy - 20 * s, 70 * s, 85 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // Hair — simple overlapping shapes (NO donut paths!)
    ctx.fillStyle = '#4A3728';
    // Top hair cap — solid ellipse covering the crown
    ctx.beginPath();
    ctx.ellipse(cx, cy - 55 * s, 68 * s, 50 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // Long side hair — left (narrow flowing strand)
    ctx.beginPath();
    ctx.ellipse(cx - 62 * s, cy - 10 * s, 14 * s, 60 * s, -0.2, 0, Math.PI * 2);
    ctx.fill();

    // Long side hair — right
    ctx.beginPath();
    ctx.ellipse(cx + 62 * s, cy - 10 * s, 14 * s, 60 * s, 0.2, 0, Math.PI * 2);
    ctx.fill();

    // Side hair lower extensions
    ctx.beginPath();
    ctx.ellipse(cx - 58 * s, cy + 35 * s, 10 * s, 28 * s, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + 58 * s, cy + 35 * s, 10 * s, 28 * s, 0.3, 0, Math.PI * 2);
    ctx.fill();

    // Fringe / bangs
    ctx.beginPath();
    ctx.ellipse(cx, cy - 75 * s, 55 * s, 22 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // Eyes — large, round
    const eyeY = cy - 15 * s;
    const blink = blinkRef.current > 0 ? Math.min(1, blinkRef.current / 0.08) : 0;
    const eo = 1 - blink;
    for (const side of [-1, 1]) {
      const ex = cx + side * 24 * s;
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.ellipse(ex, eyeY, 14 * s, 16 * s * eo, 0, 0, Math.PI * 2);
      ctx.fill();
      if (eo > 0.3) {
        const lx = Math.sin(Date.now() / 4000) * 2 * s;
        const ly = Math.sin(Date.now() / 5000) * 1.5 * s;
        ctx.fillStyle = '#5B7D5B';
        ctx.beginPath();
        ctx.ellipse(ex + lx, eyeY + ly, 8 * s, 9 * s * eo, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#1a1a2e';
        ctx.beginPath();
        ctx.ellipse(ex + lx, eyeY + ly + 2 * s, 4 * s, 5 * s * eo, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.ellipse(ex + lx + 3 * s, eyeY + ly - 4 * s, 2 * s, 3 * s * eo, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Blush
    const ba = 0.15 + Math.sin(Date.now() / 3000) * 0.05;
    ctx.fillStyle = `rgba(255, 150, 150, ${ba})`;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(cx + side * 30 * s, cy + 10 * s, 15 * s, 8 * s, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Eyebrows — arched
    ctx.strokeStyle = '#4A3728';
    ctx.lineWidth = 2.5 * s;
    for (const side of [-1, 1]) {
      const bx = cx + side * 22 * s;
      const by = eyeY - 25 * s;
      ctx.beginPath();
      ctx.moveTo(bx - 10 * s, by);
      ctx.quadraticCurveTo(bx, by - 5 * s, bx + 10 * s, by);
      ctx.stroke();
    }

    // Nose
    ctx.fillStyle = '#F5CBB8';
    ctx.beginPath();
    ctx.ellipse(cx + 1 * s, cy + 8 * s, 2.5 * s, 3 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // Mouth
    const mh = 2 + mouthVal * 10;
    const my = cy + 28 * s;
    ctx.strokeStyle = '#D4796E';
    ctx.lineWidth = 2 * s;
    ctx.beginPath();
    ctx.moveTo(cx - 12 * s, my);
    ctx.quadraticCurveTo(cx, my + mh * s, cx + 12 * s, my);
    ctx.stroke();
    if (mouthVal > 0.15) {
      ctx.fillStyle = '#8B3A3A';
      ctx.beginPath();
      ctx.ellipse(cx, my + 2 * s, 10 * s, Math.min(mh * 0.7, 6) * s, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Smile dimples
    if (mouthVal < 0.1) {
      ctx.fillStyle = 'rgba(255, 180, 180, 0.3)';
      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.ellipse(cx + side * 18 * s, my + 4 * s, 4 * s, 2 * s, 0.3 * side, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Neck
    ctx.fillStyle = '#FDDBC8';
    ctx.fillRect(cx - 10 * s, cy + 60 * s, 20 * s, 25 * s);

    // Collar
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

  // ── Male face ──
  const drawMale = useCallback((ctx: CanvasRenderingContext2D, s: number, cx: number, cy: number, mouthVal: number) => {
    // Skin (slightly warmer/tanner)
    const skinGrad = ctx.createLinearGradient(cx, cy - 120 * s, cx, cy + 60 * s);
    skinGrad.addColorStop(0, '#F5DCC8');
    skinGrad.addColorStop(1, '#E8CCB0');
    ctx.fillStyle = skinGrad;

    // Head — squarer jaw
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx - 65 * s, cy - 65 * s);
    ctx.quadraticCurveTo(cx - 72 * s, cy - 20 * s, cx - 55 * s, cy + 45 * s);
    ctx.quadraticCurveTo(cx - 30 * s, cy + 75 * s, cx, cy + 80 * s);
    ctx.quadraticCurveTo(cx + 30 * s, cy + 75 * s, cx + 55 * s, cy + 45 * s);
    ctx.quadraticCurveTo(cx + 72 * s, cy - 20 * s, cx + 65 * s, cy - 65 * s);
    ctx.quadraticCurveTo(cx, cy - 88 * s, cx - 65 * s, cy - 65 * s);
    ctx.fill();

    // Hair — short style, simple overlapping shapes
    ctx.fillStyle = '#2C1810';
    // Top hair cap — solid ellipse covering the crown
    ctx.beginPath();
    ctx.ellipse(cx, cy - 50 * s, 68 * s, 48 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // Sideburns — thin strips at sides
    ctx.beginPath();
    ctx.ellipse(cx - 66 * s, cy - 30 * s, 14 * s, 42 * s, -0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + 66 * s, cy - 30 * s, 14 * s, 42 * s, 0.1, 0, Math.PI * 2);
    ctx.fill();

    // Forehead fringe — short bangs
    ctx.beginPath();
    ctx.ellipse(cx, cy - 75 * s, 50 * s, 18 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // Eyes — smaller, narrower
    const eyeY = cy - 12 * s;
    const blink = blinkRef.current > 0 ? Math.min(1, blinkRef.current / 0.08) : 0;
    const eo = 1 - blink;
    for (const side of [-1, 1]) {
      const ex = cx + side * 26 * s;
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.ellipse(ex, eyeY, 11 * s, 11 * s * eo, 0, 0, Math.PI * 2);
      ctx.fill();
      if (eo > 0.3) {
        const lx = Math.sin(Date.now() / 4000) * 1.5 * s;
        const ly = Math.sin(Date.now() / 5000) * 1 * s;
        ctx.fillStyle = '#4A674A';
        ctx.beginPath();
        ctx.ellipse(ex + lx, eyeY + ly, 6 * s, 7 * s * eo, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#111122';
        ctx.beginPath();
        ctx.ellipse(ex + lx, eyeY + ly + 1 * s, 3 * s, 4 * s * eo, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.ellipse(ex + lx + 2 * s, eyeY + ly - 3 * s, 1.5 * s, 2 * s * eo, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Eyebrows — thicker, straighter
    ctx.strokeStyle = '#2C1810';
    ctx.lineWidth = 3 * s;
    for (const side of [-1, 1]) {
      const bx = cx + side * 24 * s;
      const by = eyeY - 22 * s;
      ctx.beginPath();
      ctx.moveTo(bx - 9 * s, by);
      ctx.lineTo(bx + 9 * s, by);
      ctx.stroke();
    }

    // Nose — slightly more prominent
    ctx.fillStyle = '#E0C0A0';
    ctx.beginPath();
    ctx.ellipse(cx + 1 * s, cy + 10 * s, 3 * s, 4 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // Mouth — less curved
    const mh = 1.5 + mouthVal * 8;
    const my = cy + 30 * s;
    ctx.strokeStyle = '#A06050';
    ctx.lineWidth = 2 * s;
    ctx.beginPath();
    ctx.moveTo(cx - 14 * s, my);
    ctx.quadraticCurveTo(cx, my + mh * s, cx + 14 * s, my);
    ctx.stroke();
    if (mouthVal > 0.2) {
      ctx.fillStyle = '#6B3030';
      ctx.beginPath();
      ctx.ellipse(cx, my + 2 * s, 9 * s, Math.min(mh * 0.6, 5) * s, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // No blush for male, but subtle jaw shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.03)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 75 * s, 55 * s, 8 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // Neck (slightly thicker)
    ctx.fillStyle = '#E8CCB0';
    ctx.fillRect(cx - 12 * s, cy + 65 * s, 24 * s, 25 * s);

    // Collar — shirt
    ctx.fillStyle = '#5A7A8A';
    ctx.beginPath();
    ctx.moveTo(cx - 95 * s, cy + 100 * s);
    ctx.quadraticCurveTo(cx - 65 * s, cy + 70 * s, cx - 25 * s, cy + 80 * s);
    ctx.lineTo(cx + 25 * s, cy + 80 * s);
    ctx.quadraticCurveTo(cx + 65 * s, cy + 70 * s, cx + 95 * s, cy + 100 * s);
    ctx.lineTo(cx + 95 * s, cy + 120 * s);
    ctx.lineTo(cx - 95 * s, cy + 120 * s);
    ctx.closePath();
    ctx.fill();
  }, []);

  // ── Main draw function ──
  const drawFace = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number, mouthVal: number) => {
    const s = Math.min(w, h) / 400;
    const cx = w / 2;
    const cy = h / 2 + 30 * s;

    ctx.clearRect(0, 0, w, h);

    if (selectedGender === 'male') {
      drawMale(ctx, s, cx, cy, mouthVal);
    } else {
      drawFemale(ctx, s, cx, cy, mouthVal);
    }
  }, [selectedGender, drawMale, drawFemale]);

  // ── Animation loop ──
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

      // Blink
      if (time - lastBlink > 3000 + Math.random() * 2000) {
        blinkRef.current = 0.08;
        lastBlink = time;
      }
      if (blinkRef.current > 0) {
        blinkRef.current -= 0.016;
      }

      lastMouth += (mouthOpen - lastMouth) * 0.3;

      if (customAvatar && customImgRef.current) {
        // Draw custom uploaded image
        const img = customImgRef.current;
        const scale = Math.max(w / img.width, h / img.height);
        const iw = img.width * scale;
        const ih = img.height * scale;
        const ix = (w - iw) / 2;
        const iy = (h - ih) / 2;
        ctx.drawImage(img, ix, iy, iw, ih);
      } else {
        drawFace(ctx, w, h, lastMouth);
      }
      animRef.current = requestAnimationFrame(animate);
    };

    animRef.current = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animRef.current);
      ro.disconnect();
    };
  }, [drawFace, mouthOpen, customAvatar]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setCustomAvatar(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const clearCustomAvatar = () => {
    setCustomAvatar(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div
      ref={containerRef}
      className="flex flex-col items-center justify-center bg-gradient-to-b from-[#F8F0E6] to-[#F0E8DC] rounded-[var(--shape-md)] shadow-elevation-1 border border-[var(--md-outline)] p-3 sm:p-4 overflow-hidden relative"
      style={{ height: '100%', maxHeight: '65vh', minHeight: 0 }}
    >
      <div className="flex items-center gap-2 mb-1 sm:mb-2 text-label-sm sm:text-body-md text-[var(--md-on-surface-variant)] shrink-0">
        <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-[var(--shape-full)] bg-[#48BB78] animate-pulse" />
        {characterName || 'Character'} is here
        {customAvatar && (
          <button
            onClick={clearCustomAvatar}
            className="ml-1 text-label-xs text-[var(--md-primary)] hover:underline cursor-pointer"
            title="Reset to default avatar"
          >
            (reset)
          </button>
        )}
      </div>
      <canvas ref={canvasRef} className="w-full flex-1" style={{ maxHeight: 'calc(65vh - 40px)' }} />

      {/* Upload button */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileUpload}
        className="hidden"
      />
      <button
        onClick={() => fileInputRef.current?.click()}
        className="absolute bottom-2 right-2 state-layer p-1.5 rounded-[var(--shape-full)] text-[var(--md-on-surface-variant)] hover:bg-[var(--md-surface-variant)]/70 transition-colors opacity-50 hover:opacity-100 text-lg leading-none"
        title="Upload custom avatar"
      >
        📷
      </button>

      {/* Gender indicator */}
      <div className="absolute top-2 right-2 text-[10px] text-[var(--md-on-surface-variant)]/30 select-none">
        {selectedGender === 'male' ? '♂' : '♀'}
      </div>
    </div>
  );
};

export default DigitalHumanContainer;
