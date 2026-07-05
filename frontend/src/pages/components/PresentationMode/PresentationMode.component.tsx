"use client";

import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  X, ChevronLeft, ChevronRight, Play, Square, FileText,
  ToggleLeft, ToggleRight, Sparkles, Loader2, Plus, Minus,
  Timer as TimerIcon, Hourglass, ChevronDown, ChevronUp,
  MessageSquareText,
} from 'lucide-react';
import { getAIAudioFromText, generateSlides, SlideData } from '@/services/adk-assistant.service';
import { getSharedAudioContext, resumeSharedAudioContext } from '@/lib/audio-context';

interface PresentationModeProps {
  /** Current voice character name (for display) */
  characterName: string;
  /** Active TTS voice ID */
  voiceId: string;
  /** Active language code */
  language: string;
  /** Close / exit callback */
  onClose: () => void;
  /** Optional pre-generated slides (skip input stage) */
  initialSlides?: SlideData[];
  /** Optional total presentation duration in minutes */
  initialMinutes?: number;
}

/**
 * Parse a script into SlideData[]. Supports:
 *   - `---` as slide separator
 *   - `\n\n\n` (3+ newlines) as slide separator
 *   - Within each slide, `===SPEECH===` separates display from speech
 *   - If no `===SPEECH===`, speech = display (manual entry)
 */
function parseSlides(script: string): SlideData[] {
  const raw = script.split(/\n---\n|\n{3,}/);
  return raw
    .map(s => s.trim())
    .filter(Boolean)
    .map(s => {
      if (s.includes('===SPEECH===')) {
        const [display, speech] = s.split('===SPEECH===', 2);
        return { display: display.trim(), speech: speech.trim() };
      }
      return { display: s, speech: s };
    });
}

/** Format seconds into MM:SS */
function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

const PresentationMode: React.FC<PresentationModeProps> = ({
  characterName,
  voiceId,
  language,
  onClose,
  initialSlides,
  initialMinutes,
}) => {
  // ── State ─────────────────────────────────────────
  const [stage, setStage] = useState<'input' | 'editor' | 'present'>(
    initialSlides && initialSlides.length > 0 ? 'editor' : 'input'
  );
  const [script, setScript] = useState('');
  const [slides, setSlides] = useState<SlideData[]>(initialSlides || []);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [totalMinutes, setTotalMinutes] = useState(initialMinutes || 10);
  const [isReading, setIsReading] = useState(false);
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [readingSlide, setReadingSlide] = useState<number | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [numSlides, setNumSlides] = useState(5);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [expandedSpeech, setExpandedSpeech] = useState<number | null>(null);

  // Timer state
  const [slideTimeRemaining, setSlideTimeRemaining] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  // Audio playback
  const audioContextRef = useRef<AudioContext | null>(null);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);

  // Timer refs
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const slideTimeRef = useRef(0);
  const remainingRef = useRef(0);

  // Track if component is mounted
  const mountedRef = useRef(true);
  useEffect(() => {
    // Hide body/html scrollbar so fixed overlay fills entire viewport
    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    const prevBodyBg = document.body.style.backgroundColor;
    const prevHtmlBg = document.documentElement.style.backgroundColor;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    document.body.style.backgroundColor = '#ffffff';
    document.documentElement.style.backgroundColor = '#ffffff';

    return () => {
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
      document.body.style.backgroundColor = prevBodyBg;
      document.documentElement.style.backgroundColor = prevHtmlBg;
      mountedRef.current = false;
      stopReading();
      stopTimer();
      if (audioContextRef.current) {
        try { audioContextRef.current.close(); } catch {}
        audioContextRef.current = null;
      }
      // Note: shared AudioContext from getSharedAudioContext() is NOT closed here
    };
  }, []);

  const stopTimer = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  }, []);

  const startTimer = useCallback((durationSeconds: number) => {
    stopTimer();
    slideTimeRef.current = durationSeconds;
    remainingRef.current = durationSeconds;
    setSlideTimeRemaining(durationSeconds);

    timerIntervalRef.current = setInterval(() => {
      remainingRef.current = Math.max(0, remainingRef.current - 1);
      setSlideTimeRemaining(remainingRef.current);

      if (remainingRef.current <= 0) {
        stopTimer();
        if (mountedRef.current) {
          setCurrentSlide((prev) => {
            if (prev < slides.length - 1) return prev + 1;
            return prev;
          });
        }
      }
    }, 1000);
  }, [stopTimer, slides.length]);

  // Re-start timer when currentSlide changes
  useEffect(() => {
    if (stage === 'present' && autoAdvance && slides.length > 0) {
      const perSlideSec = Math.floor((totalMinutes * 60) / slides.length);
      startTimer(perSlideSec);
    }
  }, [currentSlide, stage, autoAdvance, slides.length, totalMinutes, startTimer]);

  const stopReading = useCallback(() => {
    if (currentSourceRef.current) {
      try {
        (currentSourceRef.current as AudioBufferSourceNode).stop();
      } catch {}
      currentSourceRef.current = null;
    }
    setIsReading(false);
    setReadingSlide(null);
  }, []);

  const speakText = useCallback(async (text: string, slideIndex: number) => {
    if (!text.trim()) return;
    stopReading();

    // Auto-detect language: if text contains CJK characters, use zh
    const hasCJK = /[\u4e00-\u9fff\u3400-\u4dbf]/.test(text);
    const ttsLanguage = hasCJK ? 'zh' : language;

    // Ensure shared AudioContext is alive
    await resumeSharedAudioContext();

    setReadingSlide(slideIndex);
    setIsReading(true);

    try {
      const blob = await getAIAudioFromText(text, ttsLanguage, voiceId);
      if (!mountedRef.current) return;

      const ctx = getSharedAudioContext();
      const arrayBuffer = await blob.arrayBuffer();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      source.start(0);

      currentSourceRef.current = source;

      await new Promise<void>((resolve) => {
        source.onended = () => resolve();
      });

      if (mountedRef.current) {
        setIsReading(false);
        setReadingSlide(null);

        // Auto-advance to next slide after reading finishes
        if (autoAdvance && slideIndex < slides.length - 1) {
          setCurrentSlide(slideIndex + 1);
        }
      }
    } catch (err) {
      console.error('Presentation TTS error:', err);
      if (mountedRef.current) {
        setIsReading(false);
        setReadingSlide(null);
      }
    }
  }, [language, voiceId, stopReading, autoAdvance, slides.length]);

  const handleAIGenerate = async () => {
    if (!script.trim()) return;
    setIsGenerating(true);
    setGenerationError(null);
    try {
      const result = await generateSlides(script, language, numSlides);
      if (result.length > 0) {
        setSlides(result);
        setStage('editor');
      }
    } catch (err) {
      console.error('AI slide generation failed:', err);
      setGenerationError('Failed to generate slides. Make sure the backend is running.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleStart = () => {
    if (stage === 'input') {
      const parsed = parseSlides(script);
      if (parsed.length === 0) return;
      setSlides(parsed);
    }
    setCurrentSlide(0);
    setStage('present');
  };

  const goBackToInput = () => {
    setStage('input');
    setSlides([]);
  };

  const adjustNumSlides = (delta: number) => {
    setNumSlides(Math.max(2, Math.min(20, numSlides + delta)));
  };

  // Slide editor handlers
  const updateSlideDisplay = (idx: number, val: string) => {
    setSlides(prev => prev.map((s, i) => i === idx ? { ...s, display: val } : s));
  };
  const updateSlideSpeech = (idx: number, val: string) => {
    setSlides(prev => prev.map((s, i) => i === idx ? { ...s, speech: val } : s));
  };
  const addSlide = () => {
    setSlides(prev => [...prev, { display: '## New Slide\n\nContent here...', speech: 'Content for this slide.' }]);
  };
  const removeSlide = (idx: number) => {
    setSlides(prev => prev.filter((_, i) => i !== idx));
  };

  const goNext = useCallback(() => {
    if (currentSlide < slides.length - 1) {
      stopTimer();
      stopReading();
      setCurrentSlide(currentSlide + 1);
    }
  }, [currentSlide, slides.length, stopTimer, stopReading]);

  const goPrev = useCallback(() => {
    if (currentSlide > 0) {
      stopTimer();
      stopReading();
      setCurrentSlide(currentSlide - 1);
    }
  }, [currentSlide, stopTimer, stopReading]);

  const toggleReadCurrent = () => {
    if (isReading) {
      stopReading();
    } else {
      const slide = slides[currentSlide];
      if (slide) {
        speakText(slide.speech, currentSlide);
      }
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    if (stage !== 'present') return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') goNext();
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') goPrev();
      else if (e.key === ' ' && !isReading) {
        e.preventDefault();
        const slide = slides[currentSlide];
        if (slide) speakText(slide.speech, currentSlide);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [stage, goNext, goPrev, isReading, slides, currentSlide, speakText]);

  // ── Per-slide time ────────────────────────────
  const perSlideSeconds = slides.length > 0 && totalMinutes > 0
    ? Math.floor((totalMinutes * 60) / slides.length)
    : 0;

  // ── Render: Script Input ───────────────────────
  if (stage === 'input') {
    return (
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 50, overflow: "hidden", backgroundColor: "#ffffff" }} className="flex items-center justify-center">
        <div className="bg-white rounded-[var(--shape-lg)] shadow-elevation-5 w-full max-w-2xl max-h-[90vh] flex flex-col" style={{ maxHeight: "calc(100vh - 32px)" }}>
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--md-outline)]">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-[var(--md-primary)]" />
              <h2 className="text-title-md text-[var(--md-on-surface)]">Read Script</h2>
            </div>
            <button
              onClick={onClose}
              className="state-layer rounded-[var(--shape-full)] p-1.5 text-[var(--md-on-surface-variant)] hover:text-[var(--md-on-surface)]"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 p-6 overflow-y-auto">
            <p className="text-body-md text-[var(--md-on-surface-variant)] mb-4">
              Paste your script below, then click <strong>AI Generate</strong> to create structured slides with separate display content and speech narration.
            </p>
            <textarea
              value={script}
              onChange={(e) => setScript(e.target.value)}
              placeholder={`Welcome to My Presentation\n\nThis is my presentation about...\n\nWe'll cover three main topics:\n1. First topic\n2. Second topic\n3. Third topic\n\nLet me explain each in detail...`}
              className="w-full h-64 p-4 text-body-md text-[var(--md-on-surface)] bg-[var(--md-surface-variant)] border border-[var(--md-outline)] rounded-[var(--shape-md)] resize-y focus:outline-none focus:border-[var(--md-primary)] transition-colors font-mono leading-relaxed"
              spellCheck={false}
            />
            <div className="flex items-center justify-between mt-2">
              <span className="text-label-sm text-[var(--md-on-surface-variant)]">
                {script ? `${script.split(/\n{3,}/).length} paragraphs` : 'Paste your script to begin'}
              </span>
              <div className="flex items-center gap-2">
                {/* Slide count selector */}
                <div className="flex items-center gap-1 mr-1">
                  <button
                    onClick={() => adjustNumSlides(-1)}
                    disabled={isGenerating}
                    className="state-layer p-1 rounded-[var(--shape-sm)] text-[var(--md-on-surface-variant)] hover:bg-[var(--md-surface-variant)] disabled:opacity-30 transition-colors"
                    aria-label="Fewer slides"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-label-sm text-[var(--md-on-surface-variant)] min-w-[1.5rem] text-center">
                    {numSlides}
                  </span>
                  <button
                    onClick={() => adjustNumSlides(1)}
                    disabled={isGenerating}
                    className="state-layer p-1 rounded-[var(--shape-sm)] text-[var(--md-on-surface-variant)] hover:bg-[var(--md-surface-variant)] disabled:opacity-30 transition-colors"
                    aria-label="More slides"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
                {/* AI Generate button */}
                <button
                  onClick={handleAIGenerate}
                  disabled={isGenerating || !script.trim()}
                  className="state-layer flex items-center gap-1.5 text-label-md px-4 py-2 rounded-[var(--shape-full)] bg-gradient-to-r from-violet-500 to-indigo-500 text-white hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isGenerating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  {isGenerating ? 'Generating...' : 'AI Generate'}
                </button>
                <button
                  onClick={onClose}
                  className="text-label-md px-4 py-2 rounded-[var(--shape-full)] text-[var(--md-on-surface-variant)] hover:bg-[var(--md-surface-variant)] transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
            {/* Error message */}
            {generationError && (
              <div className="mt-2 text-label-sm text-[var(--md-error)] flex items-center gap-1.5">
                <X className="w-3.5 h-3.5" />
                {generationError}
              </div>
            )}

            {/* Timer settings */}
            <div className="mt-4 pt-4 border-t border-[var(--md-outline)]">
              <div className="flex items-center gap-3">
                <TimerIcon className="w-4 h-4 text-[var(--md-primary)]" />
                <span className="text-label-sm text-[var(--md-on-surface-variant)]">Total presentation time:</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setTotalMinutes(Math.max(1, totalMinutes - 1))}
                    className="state-layer p-1 rounded-[var(--shape-sm)] text-[var(--md-on-surface-variant)] hover:bg-[var(--md-surface-variant)] transition-colors"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={120}
                    value={totalMinutes}
                    onChange={(e) => setTotalMinutes(Math.max(1, Math.min(120, parseInt(e.target.value) || 1)))}
                    className="w-14 text-center text-label-md text-[var(--md-on-surface)] bg-[var(--md-surface-variant)] border border-[var(--md-outline)] rounded-[var(--shape-sm)] py-1 px-2 focus:outline-none focus:border-[var(--md-primary)] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <button
                    onClick={() => setTotalMinutes(Math.min(120, totalMinutes + 1))}
                    className="state-layer p-1 rounded-[var(--shape-sm)] text-[var(--md-on-surface-variant)] hover:bg-[var(--md-surface-variant)] transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-label-sm text-[var(--md-on-surface-variant)] ml-1">min</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Render: Slide Editor (after AI generation) ──
  if (stage === 'editor') {
    return (
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 50, overflow: "hidden", backgroundColor: "#ffffff" }} className="flex items-center justify-center">
        <div className="bg-white rounded-[var(--shape-lg)] shadow-elevation-5 w-full max-w-3xl max-h-[95vh] flex flex-col" style={{ maxHeight: "calc(100vh - 32px)" }}>
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--md-outline)]">
            <div className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-[var(--md-primary)]" />
              <h2 className="text-title-md text-[var(--md-on-surface)]">
                Slide Editor
                <span className="text-body-md text-[var(--md-on-surface-variant)] font-normal ml-2">
                  ({slides.length} slides)
                </span>
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={goBackToInput}
                className="text-label-md px-3 py-1.5 rounded-[var(--shape-full)] text-[var(--md-on-surface-variant)] hover:bg-[var(--md-surface-variant)] transition-colors"
              >
                Back
              </button>
              <button
                onClick={onClose}
                className="state-layer rounded-[var(--shape-full)] p-1.5 text-[var(--md-on-surface-variant)] hover:text-[var(--md-on-surface)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Slides */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {slides.map((slide, idx) => (
              <div
                key={idx}
                className="border border-[var(--md-outline)] rounded-[var(--shape-md)] overflow-hidden"
              >
                {/* Slide header */}
                <div className="flex items-center justify-between px-4 py-2 bg-[var(--md-surface-variant)]/50 border-b border-[var(--md-outline)]">
                  <span className="text-label-sm font-semibold text-[var(--md-primary)]">
                    Slide {idx + 1}
                  </span>
                  <button
                    onClick={() => removeSlide(idx)}
                    disabled={slides.length <= 1}
                    className="state-layer p-1 rounded-[var(--shape-sm)] text-[var(--md-error)] hover:bg-[var(--md-error-container)] disabled:opacity-30 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Display content */}
                <div className="px-4 py-3">
                  <label className="text-label-sm text-[var(--md-on-surface-variant)] mb-1 block">
                    Display content (shown on screen)
                  </label>
                  <textarea
                    value={slide.display}
                    onChange={(e) => updateSlideDisplay(idx, e.target.value)}
                    rows={4}
                    className="w-full p-3 text-body-sm text-[var(--md-on-surface)] bg-[var(--md-surface)] border border-[var(--md-outline)] rounded-[var(--shape-sm)] resize-y focus:outline-none focus:border-[var(--md-primary)] font-mono leading-relaxed"
                  />
                </div>

                {/* Speech script (collapsible) */}
                <div
                  className="border-t border-[var(--md-outline)] cursor-pointer"
                  onClick={() => setExpandedSpeech(expandedSpeech === idx ? null : idx)}
                >
                  <div className="flex items-center justify-between px-4 py-2 hover:bg-[var(--md-surface-variant)]/30">
                    <div className="flex items-center gap-2">
                      <MessageSquareText className="w-3.5 h-3.5 text-[var(--md-primary)]" />
                      <span className="text-label-sm text-[var(--md-on-surface-variant)]">
                        Speech narration
                      </span>
                      {slide.speech !== slide.display && (
                        <span className="text-label-xs text-[var(--md-primary)] bg-[var(--md-primary-container)] px-1.5 rounded-full">
                          Custom
                        </span>
                      )}
                    </div>
                    {expandedSpeech === idx ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                  {expandedSpeech === idx && (
                    <div className="px-4 py-3 border-t border-[var(--md-outline)]" onClick={(e) => e.stopPropagation()}>
                      <textarea
                        value={slide.speech}
                        onChange={(e) => updateSlideSpeech(idx, e.target.value)}
                        rows={4}
                        className="w-full p-3 text-body-sm text-[var(--md-on-surface)] bg-[var(--md-surface)] border border-[var(--md-outline)] rounded-[var(--shape-sm)] resize-y focus:outline-none focus:border-[var(--md-primary)] font-mono leading-relaxed"
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Add slide button */}
            <button
              onClick={addSlide}
              className="w-full py-2 border-2 border-dashed border-[var(--md-outline)] rounded-[var(--shape-md)] text-label-md text-[var(--md-on-surface-variant)] hover:bg-[var(--md-surface-variant)]/50 hover:border-[var(--md-primary)] transition-colors flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Add Slide
            </button>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-[var(--md-outline)] flex items-center justify-between">
            <span className="text-label-sm text-[var(--md-on-surface-variant)]">
              ~{formatTime(perSlideSeconds)} per slide
            </span>
            <button
              onClick={handleStart}
              disabled={slides.length === 0}
              className="text-label-md px-6 py-2 rounded-[var(--shape-full)] bg-[var(--md-primary)] text-white hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Start Presentation
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Render: Presentation ───────────────────────────
  const slide = slides[currentSlide] || { display: '', speech: '' };
  const total = slides.length;
  const pct = total > 1 ? ((currentSlide + 1) / total) * 100 : 100;

  // Timer visuals
  const timerPct = perSlideSeconds > 0
    ? Math.round((slideTimeRemaining / perSlideSeconds) * 100)
    : 0;
  const timerUrgent = slideTimeRemaining <= 30;

  // Convert markdown-like syntax to basic HTML for display
  const renderSlideContent = (text: string): string => {
    return text
      .split('\n')
      .map(line => {
        const trimmed = line.trim();
        if (trimmed.startsWith('### '))  return `<h3 class="text-headline-sm font-semibold mt-4 mb-2">${escapeHtml(trimmed.slice(4))}</h3>`;
        if (trimmed.startsWith('## '))   return `<h2 class="text-headline-md font-bold mt-6 mb-3">${escapeHtml(trimmed.slice(3))}</h2>`;
        if (trimmed.startsWith('# '))    return `<h1 class="text-headline-lg font-bold mt-8 mb-4">${escapeHtml(trimmed.slice(2))}</h1>`;
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          return `<li class="text-body-lg ml-4 list-disc mb-1">${escapeHtml(trimmed.slice(2))}</li>`;
        }
        if (trimmed.startsWith('> '))    return `<blockquote class="border-l-4 border-[var(--md-primary)] pl-4 italic text-body-lg text-[var(--md-on-surface-variant)] my-3">${escapeHtml(trimmed.slice(2))}</blockquote>`;
        if (trimmed === '') return '<br/>';
        return `<p class="text-body-lg mb-2">${escapeHtml(trimmed)}</p>`;
      })
      .join('\n');
  };

  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, zIndex: 50, overflow: "hidden", backgroundColor: "#ffffff" }} className="flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-[var(--md-outline)] bg-white">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="state-layer flex items-center gap-1.5 text-label-md text-[var(--md-on-surface-variant)] hover:text-[var(--md-on-surface)] px-3 py-1.5 rounded-[var(--shape-full)] hover:bg-[var(--md-surface-variant)] transition-colors"
          >
            <X className="w-4 h-4" />
            Exit
          </button>
          <span className="text-label-sm text-[var(--md-on-surface-variant)]/50 hidden sm:inline">
            {characterName}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setAutoAdvance(!autoAdvance);
              if (!autoAdvance) {
                const perSlideSec = Math.floor((totalMinutes * 60) / slides.length);
                startTimer(perSlideSec);
              } else {
                stopTimer();
              }
            }}
            className={`state-layer flex items-center gap-1 text-label-sm px-3 py-1.5 rounded-[var(--shape-full)] transition-colors ${
              autoAdvance ? 'text-[var(--md-primary)] bg-[var(--md-primary-container)]' : 'text-[var(--md-on-surface-variant)]'
            }`}
          >
            {autoAdvance ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
            {autoAdvance ? `Auto ${formatTime(slideTimeRemaining)}` : 'Auto'}
          </button>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        {/* Slide content */}
        <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-10 lg:p-16 overflow-y-auto">
          <div
            className="w-full max-w-3xl prose-headings:text-[var(--md-on-surface)] prose-p:text-[var(--md-on-surface)] prose-li:text-[var(--md-on-surface)]"
            dangerouslySetInnerHTML={{ __html: renderSlideContent(slide.display) }}
          />
          {/* Speech indicator: show that narrator is reading different text */}
          {slide.speech !== slide.display && isReading && readingSlide === currentSlide && (
            <div className="mt-4 flex items-center gap-1.5 text-label-sm text-[var(--md-primary)] bg-[var(--md-primary-container)] px-3 py-1 rounded-[var(--shape-full)]">
              <MessageSquareText className="w-3.5 h-3.5" />
              Narration differs from display
            </div>
          )}
        </div>

        {/* Controls sidebar */}
        <div className="lg:w-48 flex-shrink-0 border-t lg:border-t-0 lg:border-l border-[var(--md-outline)] bg-white p-4 flex lg:flex-col items-center lg:items-stretch gap-3">
          {/* Slide counter */}
          <div className="text-center">
            <div className="text-headline-md font-bold text-[var(--md-primary)]">
              {currentSlide + 1}
              <span className="text-title-md text-[var(--md-on-surface-variant)] font-normal"> / {total}</span>
            </div>
            <div className="w-full h-1 bg-[var(--md-outline)] rounded-full mt-1 overflow-hidden">
              <div className="h-full bg-[var(--md-primary)] rounded-full transition-all duration-[var(--motion-md)]" style={{ width: `${pct}%` }} />
            </div>
          </div>

          {/* Countdown timer */}
          {autoAdvance && (
            <div className="text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <Hourglass className={`w-3.5 h-3.5 ${timerUrgent ? 'text-[var(--md-error)]' : 'text-[var(--md-primary)]'}`} />
                <span className={`text-headline-md font-bold ${timerUrgent ? 'text-[var(--md-error)]' : 'text-[var(--md-on-surface)]'}`}>
                  {formatTime(slideTimeRemaining)}
                </span>
              </div>
              <div className="w-full h-1.5 bg-[var(--md-outline)] rounded-full mt-1 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ${
                    timerUrgent ? 'bg-[var(--md-error)]' : 'bg-[var(--md-primary)]'
                  }`}
                  style={{ width: `${timerPct}%` }}
                />
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex lg:flex-col items-center gap-2 flex-1 justify-center">
            <div className="flex items-center gap-2">
              <button
                onClick={goPrev}
                disabled={currentSlide === 0}
                className="state-layer p-2.5 rounded-[var(--shape-full)] text-[var(--md-on-surface-variant)] hover:bg-[var(--md-surface-variant)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                aria-label="Previous slide"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <button
                onClick={toggleReadCurrent}
                className={`state-layer p-3 rounded-[var(--shape-full)] transition-all ${
                  isReading
                    ? 'bg-[var(--md-error)] text-white shadow-elevation-2'
                    : 'bg-[var(--md-primary)] text-white shadow-elevation-1 hover:shadow-elevation-2'
                }`}
                aria-label={isReading ? 'Stop reading' : 'Read slide aloud'}
                title={isReading ? 'Stop' : 'Read aloud'}
              >
                {isReading ? <Square className="w-5 h-5" /> : <Play className="w-5 h-5" />}
              </button>

              <button
                onClick={goNext}
                disabled={currentSlide >= total - 1}
                className="state-layer p-2.5 rounded-[var(--shape-full)] text-[var(--md-on-surface-variant)] hover:bg-[var(--md-surface-variant)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                aria-label="Next slide"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            {/* Reading indicator */}
            {readingSlide === currentSlide && (
              <div className="flex items-center gap-1.5 mt-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--md-error)] animate-pulse" />
                <span className="text-label-sm text-[var(--md-on-surface-variant)]">Speaking</span>
              </div>
            )}
          </div>

          {/* Keyboard help */}
          <div className="text-center text-label-sm text-[var(--md-on-surface-variant)]/40 hidden lg:block">
            <kbd className="bg-[var(--md-surface-variant)] px-1.5 rounded border border-[var(--md-outline)] text-[10px]">←</kbd>
            <kbd className="bg-[var(--md-surface-variant)] px-1.5 rounded border border-[var(--md-outline)] text-[10px] ml-1">→</kbd> navigate
            <br />
            <kbd className="bg-[var(--md-surface-variant)] px-1.5 rounded border border-[var(--md-outline)] text-[10px] mt-1 inline-block">Space</kbd> read
          </div>
        </div>
      </div>
    </div>
  );
};

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export default PresentationMode;
