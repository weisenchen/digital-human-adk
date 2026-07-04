"use client";

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, Play, Square, StepForward, FileText, ToggleLeft, ToggleRight, SkipBack } from 'lucide-react';
import { getAIAudioFromText } from '@/pages/services/adk-assistant.service';

interface PresentationModeProps {
  /** Current voice character name (for display) */
  characterName: string;
  /** Active TTS voice ID */
  voiceId: string;
  /** Active language code */
  language: string;
  /** Close / exit callback */
  onClose: () => void;
}

/**
 * Parse a script into slides. Supports:
 *   - `---` as slide separator
 *   - `\n\n\n` (3+ newlines) as slide separator
 *   - Trims whitespace, drops empty slides
 */
function parseSlides(script: string): string[] {
  const raw = script.split(/\n---\n|\n{3,}/);
  return raw.map(s => s.trim()).filter(Boolean);
}

const PresentationMode: React.FC<PresentationModeProps> = ({
  characterName,
  voiceId,
  language,
  onClose,
}) => {
  // ── State ─────────────────────────────────────────
  const [stage, setStage] = useState<'input' | 'present'>('input');
  const [script, setScript] = useState('');
  const [slides, setSlides] = useState<string[]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isReading, setIsReading] = useState(false);
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [readingSlide, setReadingSlide] = useState<number | null>(null);

  // Audio playback
  const audioContextRef = useRef<AudioContext | null>(null);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);

  // Track if component is mounted (prevent state updates after unmount)
  const mountedRef = useRef(true);
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      stopReading();
      if (audioContextRef.current) {
        try { audioContextRef.current.close(); } catch {}
        audioContextRef.current = null;
      }
    };
  }, []);

  const stopReading = useCallback(() => {
    if (currentSourceRef.current) {
      try { currentSourceRef.current.stop(); } catch {}
      currentSourceRef.current = null;
    }
    setIsReading(false);
    setReadingSlide(null);
  }, []);

  const speakText = useCallback(async (text: string, slideIndex: number) => {
    if (!text.trim()) return;
    stopReading();

    try {
      const blob = await getAIAudioFromText(text, language, voiceId);
      if (!mountedRef.current) return;

      setReadingSlide(slideIndex);
      setIsReading(true);

      const audioContext = audioContextRef.current || new AudioContext();
      audioContextRef.current = audioContext;

      const arrayBuffer = await blob.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);
      currentSourceRef.current = source;

      source.start(0);

      await new Promise<void>((resolve) => {
        source.onended = () => resolve();
      });

      if (mountedRef.current) {
        setIsReading(false);
        setReadingSlide(null);

        // Auto-advance to next slide
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

  const handleStart = () => {
    const parsed = parseSlides(script);
    if (parsed.length === 0) return;
    setSlides(parsed);
    setCurrentSlide(0);
    setStage('present');
  };

  const goNext = useCallback(() => {
    if (currentSlide < slides.length - 1) {
      stopReading();
      setCurrentSlide(currentSlide + 1);
    }
  }, [currentSlide, slides.length, stopReading]);

  const goPrev = useCallback(() => {
    if (currentSlide > 0) {
      stopReading();
      setCurrentSlide(currentSlide - 1);
    }
  }, [currentSlide, stopReading]);

  const toggleReadCurrent = () => {
    if (isReading) {
      stopReading();
    } else {
      const slide = slides[currentSlide];
      if (slide) speakText(slide, currentSlide);
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
        if (slide) speakText(slide, currentSlide);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [stage, goNext, goPrev, isReading, slides, currentSlide, speakText]);

  // ── Render: Script Input ───────────────────────────
  if (stage === 'input') {
    return (
      <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-white rounded-[var(--shape-lg)] shadow-elevation-5 w-full max-w-2xl max-h-[90vh] flex flex-col">
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
              Paste your script below. Use <code className="bg-[var(--md-primary-container)] px-1.5 rounded text-label-sm">---</code> or <strong>3 blank lines</strong> to separate slides.
            </p>
            <textarea
              value={script}
              onChange={(e) => setScript(e.target.value)}
              placeholder={`Welcome to My Presentation\n\nThis is slide 1 content...\n\n---\n\n## Slide 2 Title\n\n- Bullet point 1\n- Bullet point 2\n\n---\n\n### Slide 3\n\nThank you!`}
              className="w-full h-64 p-4 text-body-md text-[var(--md-on-surface)] bg-[var(--md-surface-variant)] border border-[var(--md-outline)] rounded-[var(--shape-md)] resize-y focus:outline-none focus:border-[var(--md-primary)] transition-colors font-mono leading-relaxed"
              spellCheck={false}
            />
            <div className="flex items-center justify-between mt-2">
              <span className="text-label-sm text-[var(--md-on-surface-variant)]">
                {script ? `${parseSlides(script).length} slides detected` : 'Paste your script to begin'}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={onClose}
                  className="text-label-md px-4 py-2 rounded-[var(--shape-full)] text-[var(--md-on-surface-variant)] hover:bg-[var(--md-surface-variant)] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleStart}
                  disabled={parseSlides(script).length === 0}
                  className="text-label-md px-5 py-2 rounded-[var(--shape-full)] bg-[var(--md-primary)] text-white hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Start Presentation
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Render: Presentation ───────────────────────────
  const slide = slides[currentSlide] || '';
  const total = slides.length;
  const pct = total > 1 ? ((currentSlide + 1) / total) * 100 : 100;

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
    <div className="fixed inset-0 z-50 bg-gradient-to-br from-[var(--md-background)] to-[var(--md-surface-variant)] flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-[var(--md-outline)] bg-white/80 backdrop-blur-sm">
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
            onClick={() => setAutoAdvance(!autoAdvance)}
            className={`state-layer flex items-center gap-1 text-label-sm px-3 py-1.5 rounded-[var(--shape-full)] transition-colors ${
              autoAdvance ? 'text-[var(--md-primary)] bg-[var(--md-primary-container)]' : 'text-[var(--md-on-surface-variant)]'
            }`}
          >
            {autoAdvance ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
            Auto
          </button>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        {/* Slide content */}
        <div className="flex-1 flex flex-col items-center justify-center p-6 sm:p-10 lg:p-16 overflow-y-auto">
          <div
            className="w-full max-w-3xl prose-headings:text-[var(--md-on-surface)] prose-p:text-[var(--md-on-surface)] prose-li:text-[var(--md-on-surface)]"
            dangerouslySetInnerHTML={{ __html: renderSlideContent(slide) }}
          />
        </div>

        {/* Controls sidebar (bottom on mobile, right on desktop) */}
        <div className="lg:w-48 flex-shrink-0 border-t lg:border-t-0 lg:border-l border-[var(--md-outline)] bg-white/50 p-4 flex lg:flex-col items-center lg:items-stretch gap-3">
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
