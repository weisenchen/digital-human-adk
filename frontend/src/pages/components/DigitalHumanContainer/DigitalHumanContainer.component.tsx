"use client";

import { useEffect, useRef, useContext, useCallback, useState } from 'react';
import VoiceAssistantContext from '../../context/VoiceAssistantContext';

// ── Avatar config per character name ─────────────────────────
interface AvatarConfig {
  hairColor: string;
  skinTone: [string, string];  // gradient [light, dark]
  eyeColor: string;
  outfitColor: string;
  hairStyle: 'long' | 'short' | 'bob' | 'ponytail' | 'curly' | 'spiky' | 'wavy' | 'bald';
  accessory?: 'glasses' | 'bow' | 'none';
}

const NAME_AVATARS: Record<string, AvatarConfig> = {
  // English female
  'Olivia':     { hairColor: '#8B5A2B', skinTone: ['#FFE4D6','#FDDBC8'], eyeColor: '#5B7D5B', outfitColor: '#7B9CB5', hairStyle: 'long', accessory: 'bow' },
  'Emma':       { hairColor: '#D4A574', skinTone: ['#FFF0E8','#FDE8D8'], eyeColor: '#6B8E9B', outfitColor: '#C48B9F', hairStyle: 'bob', accessory: 'none' },
  'Charlotte':  { hairColor: '#1A1A2E', skinTone: ['#F5E0D0','#E8D0C0'], eyeColor: '#4A7B9B', outfitColor: '#8B6B9B', hairStyle: 'ponytail', accessory: 'none' },
  'Amelia':     { hairColor: '#B8860B', skinTone: ['#FFE8D8','#FDDCC8'], eyeColor: '#7B9B4A', outfitColor: '#D4A060', hairStyle: 'curly', accessory: 'none' },
  'Sophia':     { hairColor: '#4A0E1B', skinTone: ['#FDE8DC','#F5D8CC'], eyeColor: '#5B4A7B', outfitColor: '#9B6B7B', hairStyle: 'long', accessory: 'bow' },
  'Ava':        { hairColor: '#C0753A', skinTone: ['#FFECD8','#FDE0C8'], eyeColor: '#4A8B6B', outfitColor: '#6B9B7B', hairStyle: 'bob', accessory: 'none' },
  // English male
  'James':      { hairColor: '#3A2518', skinTone: ['#F0D8C8','#E0C8B8'], eyeColor: '#4A6B8B', outfitColor: '#4A6B7B', hairStyle: 'short', accessory: 'none' },
  'Liam':       { hairColor: '#C8A060', skinTone: ['#F5E0D0','#E8D0C0'], eyeColor: '#5B8B4A', outfitColor: '#6B7B4A', hairStyle: 'spiky', accessory: 'none' },
  'Noah':       { hairColor: '#8B6B3A', skinTone: ['#F0DCC8','#E0CCB8'], eyeColor: '#6B7B9B', outfitColor: '#7B6B5B', hairStyle: 'wavy', accessory: 'none' },
  'Oliver':     { hairColor: '#D4904A', skinTone: ['#F8E4D0','#E8D0BC'], eyeColor: '#4A7B6B', outfitColor: '#5B8B7B', hairStyle: 'curly', accessory: 'none' },
  'Elijah':     { hairColor: '#2C1810', skinTone: ['#E8D0C0','#D8C0B0'], eyeColor: '#8B6B4A', outfitColor: '#8B4A3A', hairStyle: 'short', accessory: 'none' },
  'Mateo':      { hairColor: '#1A0E08', skinTone: ['#E8CCB0','#D8BCA0'], eyeColor: '#6B4A3A', outfitColor: '#8B6B4A', hairStyle: 'spiky', accessory: 'none' },
  // Chinese female
  '小薇':       { hairColor: '#2A1A0E', skinTone: ['#FFE8DC','#FDDCC8'], eyeColor: '#4A6B5B', outfitColor: '#C0606B', hairStyle: 'long', accessory: 'bow' },
  '小美':       { hairColor: '#5A3A2B', skinTone: ['#FFF0E0','#FDE4D0'], eyeColor: '#7B5B4A', outfitColor: '#D4907B', hairStyle: 'ponytail', accessory: 'none' },
  '小雨':       { hairColor: '#4A5B6B', skinTone: ['#F5E4D8','#E8D8CC'], eyeColor: '#5B8B9B', outfitColor: '#5B8B9B', hairStyle: 'bob', accessory: 'none' },
  '小琳':       { hairColor: '#8B6B4A', skinTone: ['#FFE8D4','#FDDCC4'], eyeColor: '#6B8B5B', outfitColor: '#7B9B7B', hairStyle: 'curly', accessory: 'none' },
  '小娜':       { hairColor: '#3A0A1A', skinTone: ['#FDE4DC','#F5D8CC'], eyeColor: '#6B4A6B', outfitColor: '#9B6B8B', hairStyle: 'long', accessory: 'bow' },
  // Chinese male
  '小明':       { hairColor: '#2C1810', skinTone: ['#F0DCC8','#E0CCB8'], eyeColor: '#4A5B4A', outfitColor: '#5A7A8A', hairStyle: 'short', accessory: 'none' },
  '小刚':       { hairColor: '#1A0E08', skinTone: ['#E8D0BC','#D8C0AC'], eyeColor: '#4A4A3A', outfitColor: '#4A6B5B', hairStyle: 'spiky', accessory: 'none' },
  '志强':       { hairColor: '#3A2A1A', skinTone: ['#F0DCC8','#E0CCB8'], eyeColor: '#5B5B4A', outfitColor: '#6B5B4A', hairStyle: 'short', accessory: 'glasses' },
  '云浩':       { hairColor: '#6B5B4A', skinTone: ['#F5E0D0','#E8D0C0'], eyeColor: '#4A6B8B', outfitColor: '#5B7B8B', hairStyle: 'wavy', accessory: 'none' },
  '伟杰':       { hairColor: '#3A2518', skinTone: ['#F0DCC8','#E0CCB8'], eyeColor: '#5B6B3A', outfitColor: '#6B7B4A', hairStyle: 'short', accessory: 'none' },
};

// Fallback config for unknown names — generated from name hash for unique colors
function getAvatarConfig(name: string, gender: string): AvatarConfig {
  const lower = name.toLowerCase().trim();
  if (NAME_AVATARS[lower] || NAME_AVATARS[name]) {
    return NAME_AVATARS[name] || NAME_AVATARS[lower];
  }
  // Deterministic hash-based fallback
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash) + name.charCodeAt(i);
    hash |= 0;
  }
  const hue = Math.abs(hash % 360);
  const hairLight = `hsl(${hue}, 40%, ${25 + Math.abs(hash % 20)}%)`;
  const eyeHue = (hue + 120) % 360;
  const skinLight = gender === 'male'
    ? [`hsl(30, 40%, ${80 + Math.abs(hash % 8)}%)`, `hsl(30, 35%, ${75 + Math.abs(hash % 8)}%)`]
    : [`hsl(20, 50%, ${88 + Math.abs(hash % 8)}%)`, `hsl(20, 45%, ${82 + Math.abs(hash % 8)}%)`];
  const outfitHue = (hue + 240) % 360;
  const styles: AvatarConfig['hairStyle'][] = ['long', 'short', 'bob', 'curly', 'wavy'];
  return {
    hairColor: hairLight,
    skinTone: skinLight as [string, string],
    eyeColor: `hsl(${eyeHue}, 50%, 40%)`,
    outfitColor: `hsl(${outfitHue}, 50%, 55%)`,
    hairStyle: styles[Math.abs(hash) % styles.length],
    accessory: 'none' as const,
  };
}

const DigitalHumanContainer = ({ compact = false }: { compact?: boolean }) => {
  const {
    mouthOpen,
    characterName = 'Xiao Wei',
    selectedGender = 'female',
  } = useContext(VoiceAssistantContext);

  const config = getAvatarConfig(characterName, selectedGender);

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
  const drawFemale = useCallback((ctx: CanvasRenderingContext2D, s: number, cx: number, cy: number, mouthVal: number, cfg: AvatarConfig) => {
    // Skin
    const skinGrad = ctx.createLinearGradient(cx, cy - 120 * s, cx, cy + 60 * s);
    skinGrad.addColorStop(0, cfg.skinTone[0]);
    skinGrad.addColorStop(1, cfg.skinTone[1]);
    ctx.fillStyle = skinGrad;

    // Head (rounder)
    ctx.beginPath();
    ctx.ellipse(cx, cy - 20 * s, 70 * s, 85 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // Hair — varies by hairStyle
    ctx.fillStyle = cfg.hairColor;

    if (cfg.hairStyle === 'bob') {
      // Short bob — round cap, no long sides
      ctx.beginPath();
      ctx.ellipse(cx, cy - 62 * s, 72 * s, 42 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx - 62 * s, cy - 30 * s, 15 * s, 40 * s, -0.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx + 62 * s, cy - 30 * s, 15 * s, 40 * s, 0.1, 0, Math.PI * 2);
      ctx.fill();
      // Fringe
      ctx.beginPath();
      ctx.ellipse(cx, cy - 62 * s, 50 * s, 20 * s, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (cfg.hairStyle === 'ponytail') {
      // Top cap
      ctx.beginPath();
      ctx.ellipse(cx, cy - 68 * s, 68 * s, 38 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      // Side hair
      ctx.beginPath();
      ctx.ellipse(cx - 62 * s, cy - 20 * s, 12 * s, 50 * s, -0.15, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx + 62 * s, cy - 20 * s, 12 * s, 50 * s, 0.15, 0, Math.PI * 2);
      ctx.fill();
      // Side extensions
      ctx.beginPath();
      ctx.ellipse(cx - 58 * s, cy + 25 * s, 8 * s, 30 * s, -0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx + 58 * s, cy + 25 * s, 8 * s, 30 * s, 0.2, 0, Math.PI * 2);
      ctx.fill();
      // Ponytail bun
      ctx.beginPath();
      ctx.ellipse(cx, cy - 90 * s, 16 * s, 14 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      // Fringe
      ctx.beginPath();
      ctx.ellipse(cx, cy - 65 * s, 50 * s, 18 * s, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (cfg.hairStyle === 'curly') {
      // Curly — bumpy top, voluminous
      ctx.beginPath();
      ctx.ellipse(cx, cy - 70 * s, 72 * s, 45 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      // Side curls
      for (const side of [-1, 1]) {
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.ellipse(cx + side * (58 + i * 5) * s, cy - (40 - i * 15) * s, 10 * s, 12 * s, 0, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      // Fringe curls
      ctx.beginPath();
      ctx.ellipse(cx, cy - 66 * s, 52 * s, 22 * s, 0, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Default long hair
      ctx.beginPath();
      ctx.ellipse(cx, cy - 68 * s, 68 * s, 38 * s, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx - 62 * s, cy - 20 * s, 12 * s, 50 * s, -0.15, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx + 62 * s, cy - 20 * s, 12 * s, 50 * s, 0.15, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx - 58 * s, cy + 25 * s, 8 * s, 30 * s, -0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx + 58 * s, cy + 25 * s, 8 * s, 30 * s, 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(cx, cy - 65 * s, 50 * s, 18 * s, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Eyes — large, round, configurable color
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
        ctx.fillStyle = cfg.eyeColor;
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
    ctx.strokeStyle = cfg.hairColor;
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
    ctx.fillStyle = cfg.skinTone[1];
    ctx.fillRect(cx - 10 * s, cy + 60 * s, 20 * s, 25 * s);

    // Collar
    ctx.fillStyle = cfg.outfitColor;
    ctx.beginPath();
    ctx.moveTo(cx - 90 * s, cy + 100 * s);
    ctx.quadraticCurveTo(cx - 60 * s, cy + 70 * s, cx - 20 * s, cy + 80 * s);
    ctx.lineTo(cx + 20 * s, cy + 80 * s);
    ctx.quadraticCurveTo(cx + 60 * s, cy + 70 * s, cx + 90 * s, cy + 100 * s);
    ctx.lineTo(cx + 90 * s, cy + 120 * s);
    ctx.lineTo(cx - 90 * s, cy + 120 * s);
    ctx.closePath();
    ctx.fill();

    // Accessories
    if (cfg.accessory === 'bow') {
      // Bow on the right side of hair
      ctx.fillStyle = cfg.outfitColor;
      const bx = cx + 55 * s;
      const by = cy - 65 * s;
      // Left loop
      ctx.beginPath();
      ctx.ellipse(bx - 8 * s, by, 8 * s, 5 * s, -0.3, 0, Math.PI * 2);
      ctx.fill();
      // Right loop
      ctx.beginPath();
      ctx.ellipse(bx + 8 * s, by, 8 * s, 5 * s, 0.3, 0, Math.PI * 2);
      ctx.fill();
      // Center knot
      ctx.fillStyle = cfg.hairColor;
      ctx.beginPath();
      ctx.ellipse(bx, by, 3 * s, 4 * s, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (cfg.accessory === 'glasses') {
      // Glasses
      ctx.strokeStyle = '#8B7355';
      ctx.lineWidth = 2 * s;
      const eyeY = cy - 15 * s;
      for (const side of [-1, 1]) {
        const gx = cx + side * 24 * s;
        ctx.beginPath();
        ctx.ellipse(gx, eyeY, 16 * s, 18 * s, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      // Bridge
      ctx.beginPath();
      ctx.moveTo(cx - 8 * s, eyeY);
      ctx.lineTo(cx + 8 * s, eyeY);
      ctx.stroke();
      // Temple arms
      ctx.beginPath();
      ctx.moveTo(cx - 40 * s, eyeY - 2 * s);
      ctx.lineTo(cx - 52 * s, eyeY - 8 * s);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx + 40 * s, eyeY - 2 * s);
      ctx.lineTo(cx + 52 * s, eyeY - 8 * s);
      ctx.stroke();
    }
  }, []);

  // ── Male face ──
  const drawMale = useCallback((ctx: CanvasRenderingContext2D, s: number, cx: number, cy: number, mouthVal: number, cfg: AvatarConfig) => {
    // Skin (slightly warmer/tanner)
    const skinGrad = ctx.createLinearGradient(cx, cy - 120 * s, cx, cy + 60 * s);
    skinGrad.addColorStop(0, cfg.skinTone[0]);
    skinGrad.addColorStop(1, cfg.skinTone[1]);
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

    // Hair — short style, configurable
    ctx.fillStyle = cfg.hairColor;
    // Top hair cap
    ctx.beginPath();
    ctx.ellipse(cx, cy - 66 * s, 68 * s, 36 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    if (cfg.hairStyle === 'spiky') {
      // Spiky spikes on top
      for (let i = 0; i < 7; i++) {
        const angle = -Math.PI * 0.5 + (i - 3) * 0.15;
        const sx = cx + Math.cos(angle) * 50 * s;
        const sy = cy - 60 * s + Math.sin(angle) * 10 * s;
        ctx.beginPath();
        ctx.moveTo(sx - 6 * s, sy);
        ctx.lineTo(sx + (i - 3) * 3 * s, sy - 28 * s - i * 2 * s);
        ctx.lineTo(sx + 6 * s, sy);
        ctx.fill();
      }
    } else if (cfg.hairStyle === 'wavy') {
      // Wavy texture lines
      ctx.strokeStyle = cfg.hairColor;
      ctx.lineWidth = 1.5 * s;
      for (let i = 0; i < 5; i++) {
        const wx = cx + (i - 2) * 12 * s;
        const wy = cy - 80 * s;
        ctx.beginPath();
        ctx.moveTo(wx, wy);
        ctx.quadraticCurveTo(wx + 6 * s, wy + 10 * s, wx, wy + 20 * s);
        ctx.quadraticCurveTo(wx - 6 * s, wy + 30 * s, wx, wy + 40 * s);
        ctx.stroke();
      }
    } else if (cfg.hairStyle === 'curly') {
      // Curly texture - small overlapping circles
      for (let i = 0; i < 6; i++) {
        const cx2 = cx + (i - 2.5) * 16 * s;
        const cy2 = cy - 76 * s + (i % 3) * 10 * s;
        ctx.beginPath();
        ctx.ellipse(cx2, cy2, 12 * s, 8 * s, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Sideburns — narrow, sits along head contour
    ctx.beginPath();
    ctx.ellipse(cx - 66 * s, cy - 38 * s, 10 * s, 30 * s, -0.05, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + 66 * s, cy - 38 * s, 10 * s, 30 * s, 0.05, 0, Math.PI * 2);
    ctx.fill();

    // Forehead fringe — short, sits at hairline
    ctx.beginPath();
    ctx.ellipse(cx, cy - 64 * s, 46 * s, 16 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    // Eyes — smaller, narrower, configurable color
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
        ctx.fillStyle = cfg.eyeColor;
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
    ctx.strokeStyle = cfg.hairColor;
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
    ctx.fillStyle = cfg.skinTone[1];
    ctx.fillRect(cx - 12 * s, cy + 65 * s, 24 * s, 25 * s);

    // Collar — shirt
    ctx.fillStyle = cfg.outfitColor;
    ctx.beginPath();
    ctx.moveTo(cx - 95 * s, cy + 100 * s);
    ctx.quadraticCurveTo(cx - 65 * s, cy + 70 * s, cx - 25 * s, cy + 80 * s);
    ctx.lineTo(cx + 25 * s, cy + 80 * s);
    ctx.quadraticCurveTo(cx + 65 * s, cy + 70 * s, cx + 95 * s, cy + 100 * s);
    ctx.lineTo(cx + 95 * s, cy + 120 * s);
    ctx.lineTo(cx - 95 * s, cy + 120 * s);
    ctx.closePath();
    ctx.fill();

    // Accessories
    if (cfg.accessory === 'glasses') {
      ctx.strokeStyle = '#8B7355';
      ctx.lineWidth = 2 * s;
      const eyeY = cy - 12 * s;
      for (const side of [-1, 1]) {
        const gx = cx + side * 26 * s;
        ctx.beginPath();
        ctx.ellipse(gx, eyeY, 14 * s, 14 * s, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.moveTo(cx - 12 * s, eyeY);
      ctx.lineTo(cx + 12 * s, eyeY);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx - 40 * s, eyeY - 2 * s);
      ctx.lineTo(cx - 52 * s, eyeY - 8 * s);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx + 40 * s, eyeY - 2 * s);
      ctx.lineTo(cx + 52 * s, eyeY - 8 * s);
      ctx.stroke();
    }
  }, []);

  // ── Main draw function ──
  const drawFace = useCallback((ctx: CanvasRenderingContext2D, w: number, h: number, mouthVal: number) => {
    const s = Math.min(w, h) / 400;
    const cx = w / 2;
    const cy = h / 2 + 30 * s;

    ctx.clearRect(0, 0, w, h);

    if (selectedGender === 'male') {
      drawMale(ctx, s, cx, cy, mouthVal, config);
    } else {
      drawFemale(ctx, s, cx, cy, mouthVal, config);
    }
  }, [selectedGender, drawMale, drawFemale, config]);

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
  }, [drawFace, mouthOpen, customAvatar, characterName]);

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
      className={`${compact ? 'w-full h-full' : 'flex flex-col items-center justify-center bg-gradient-to-b from-[#F8F0E6] to-[#F0E8DC] rounded-[var(--shape-md)] shadow-elevation-1 border border-[var(--md-outline)] p-3 sm:p-4 overflow-hidden relative'}`}
      style={{ height: compact ? '100%' : '100%', maxHeight: compact ? '100%' : '65vh', minHeight: 0 }}
    >
      {!compact && (
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
      )}
      <canvas ref={canvasRef} className={compact ? 'w-full h-full' : 'w-full flex-1'} style={{ maxHeight: compact ? '100%' : 'calc(65vh - 40px)' }} />

      {!compact && (
        <>
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
          <div className="absolute top-2 right-2 text-[10px] text-[var(--md-on-surface-variant)]/30 select-none">
            {selectedGender === 'male' ? '♂' : '♀'}
          </div>
        </>
      )}
    </div>
  );
};

export default DigitalHumanContainer;
