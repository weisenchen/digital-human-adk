"use client";

import { useState, useEffect, useRef, useCallback, useContext } from 'react';
import {
  X, ChevronLeft, ChevronRight, Play, Pause, Volume2, Mic, Square,
  Clock, SkipForward, SkipBack, MessageSquare, Send, FileText,
  Download, CheckCircle2, Loader2,
} from 'lucide-react';
import DigitalHumanContainer from '../DigitalHumanContainer/DigitalHumanContainer.component';
import { sendWorkReportMessage, generateReportSlides, getAIAudioFromText, downloadHtmlPresentation } from '@/services/adk-assistant.service';
import { getSharedAudioContext, resumeSharedAudioContext } from '@/lib/audio-context';
import VoiceAssistantContext from '../../context/VoiceAssistantContext';
import type { WorkReportConfig, SlideData } from '../WorkReport/WorkReportSetup.component';

interface WorkReportModeProps {
  config: WorkReportConfig;
  characterName: string;
  onEnd: () => void;
}

interface ChatMessage {
  role: 'ai' | 'user';
  content: string;
  slideIndex?: number;
}

/** Simple markdown-like to HTML for slide display */
function markdownToHtml(text: string): string {
  return text.split('\n').map(line => {
    const trimmed = line.trim();
    if (trimmed.startsWith('### ')) return `<h3 class="text-xl font-semibold mt-3 mb-2 text-gray-800">${escHtml(trimmed.slice(4))}</h3>`;
    if (trimmed.startsWith('## ')) return `<h2 class="text-2xl font-bold mt-4 mb-2 text-gray-900">${escHtml(trimmed.slice(3))}</h2>`;
    if (trimmed.startsWith('# ')) return `<h1 class="text-3xl font-bold mt-5 mb-3 text-gray-900">${escHtml(trimmed.slice(2))}</h1>`;
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      return `<li class="text-base ml-5 list-disc mb-1 text-gray-700">${escHtml(trimmed.slice(2))}</li>`;
    }
    if (trimmed.startsWith('> ')) return `<blockquote class="border-l-4 border-blue-400 pl-4 italic text-gray-600 my-2">${escHtml(trimmed.slice(2))}</blockquote>`;
    if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
      return `<p class="text-lg font-bold text-center text-blue-600 my-3">${escHtml(trimmed.slice(2, -2))}</p>`;
    }
    if (trimmed === '') return '<br/>';
    return `<p class="text-base mb-1 text-gray-700">${escHtml(trimmed)}</p>`;
  }).join('\n');
}

function escHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Simple markdown-like rendering for slide display */
function SlideContent({ display }: { display: string }) {
  // Try to extract title and body
  const lines = display.split('\n').map(l => l.trim()).filter(Boolean);
  const firstLine = lines[0] || '';

  // If it starts with ## it's likely a heading style
  if (firstLine.startsWith('## ')) {
    return (
      <div className="w-full max-w-3xl">
        <div dangerouslySetInnerHTML={{ __html: markdownToHtml(display) }} />
      </div>
    );
  }

  // Otherwise treat as a simple card-style slide
  return (
    <div className="w-full max-w-3xl">
      {lines.length === 1 ? (
        <div className="flex items-center justify-center min-h-[30vh]">
          <h2 className="text-3xl font-bold text-gray-900 text-center">{firstLine}</h2>
        </div>
      ) : (
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">{lines[0]}</h2>
          <div className="space-y-3">
            {lines.slice(1).map((line, i) => {
              if (line.startsWith('- ') || line.startsWith('* ')) {
                return (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-blue-500 mt-1.5 flex-shrink-0">•</span>
                    <span className="text-base text-gray-700">{line.replace(/^[-*]\s+/, '')}</span>
                  </div>
                );
              }
              if (line.match(/^\d+\./)) {
                return (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-blue-600 font-medium flex-shrink-0">{line.match(/^\d+\./)?.[0]}</span>
                    <span className="text-base text-gray-700">{line.replace(/^\d+\.\s*/, '')}</span>
                  </div>
                );
              }
              if (line.startsWith('**') && line.endsWith('**')) {
                return <p key={i} className="text-lg font-bold text-blue-600 text-center py-2">{line.replace(/\*\*/g, '')}</p>;
              }
              return <p key={i} className="text-base text-gray-700">{line}</p>;
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function WorkReportMode({
  config,
  characterName,
  onEnd,
}: WorkReportModeProps) {
  const { selectedLanguage, setMouthOpen, selectedVoice } = useContext(VoiceAssistantContext);

  // Slide state
  const [slides, setSlides] = useState<SlideData[]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [slideMode, setSlideMode] = useState<'auto' | 'manual'>('auto');
  const [isReading, setIsReading] = useState(false);
  const [readingSlide, setReadingSlide] = useState<number | null>(null);

  // Chat state
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isWaiting, setIsWaiting] = useState(false);

  // Auto-mic state
  const [autoMicActive, setAutoMicActive] = useState(false);
  const [responseTimeLeft, setResponseTimeLeft] = useState(0);
  const [isRecording, setIsRecording] = useState(false);

  // AI questions
  const [aiQuestions, setAiQuestions] = useState<string[]>([]);
  const [askedQuestions, setAskedQuestions] = useState<number[]>([]);

  // Phase
  const [phase, setPhase] = useState<'presentation' | 'cto-qa' | 'ai-questions' | 'ended'>('presentation');

  // Loading
  const [isGenerating, setIsGenerating] = useState(false);

  // Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  const spokenSlideRef = useRef<Set<number>>(new Set());
  const voiceRecogRef = useRef<any>(null);
  const voiceFinalRef = useRef<string>('');
  const responseTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  // Keep messagesRef in sync
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      stopReading();
      stopAutoRecord();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Audio helpers ──────────────────────────────────────

  const getAudioContext = useCallback((): AudioContext => {
    if (!audioContextRef.current) {
      audioContextRef.current = getSharedAudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.connect(audioContextRef.current.destination);
    }
    return audioContextRef.current;
  }, []);

  const stopReading = useCallback(() => {
    if (currentSourceRef.current) {
      try { currentSourceRef.current.stop(); } catch {}
      currentSourceRef.current = null;
    }
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    setIsReading(false);
    setReadingSlide(null);
    setMouthOpen(0);
  }, [setMouthOpen]);

  const speakText = useCallback(async (text: string, slideIndex: number) => {
    if (!text.trim()) return;
    stopReading();

    // Auto-detect language: if text contains CJK characters, use zh
    const hasCJK = /[\u4e00-\u9fff\u3400-\u4dbf]/.test(text);
    const ttsLanguage = hasCJK ? 'zh' : selectedLanguage.replace(/-.*$/, '');

    await resumeSharedAudioContext();

    setReadingSlide(slideIndex);
    setIsReading(true);

    try {
      const blob = await getAIAudioFromText(text, ttsLanguage, selectedVoice);
      const audioCtx = getAudioContext();
      const arrayBuffer = await blob.arrayBuffer();
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

      const source = audioCtx.createBufferSource();
      currentSourceRef.current = source;
      source.buffer = audioBuffer;

      const analyser = analyserRef.current!;
      source.connect(analyser);

      source.start(0);

      const updateMouth = () => {
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(dataArray);
        const volume = dataArray.reduce((a, b) => a + b) / dataArray.length;
        setMouthOpen(Math.min(1, volume / 50));
        if (audioCtx.state !== 'closed') {
          rafIdRef.current = requestAnimationFrame(updateMouth);
        }
      };
      updateMouth();

      source.onended = () => {
        if (rafIdRef.current !== null) {
          cancelAnimationFrame(rafIdRef.current);
          rafIdRef.current = null;
        }
        setIsReading(false);
        setReadingSlide(null);
        setMouthOpen(0);

        if (!mountedRef.current) return;

        // After finishing a slide TTS, handle auto-advance or phase transitions
        if (phase === 'presentation' && slideMode === 'auto') {
          if (slideIndex < slides.length - 1) {
            // Auto-advance to next slide
            goToSlide(slideIndex + 1);
          } else {
            // All slides done → transition to CTO Q&A phase
            setPhase('cto-qa');
            // Ask "Any questions?"
            askCTOQuestionOpen();
          }
        }
      };
    } catch (err) {
      console.error('Work report TTS error:', err);
      setIsReading(false);
      setReadingSlide(null);
      setMouthOpen(0);
    }
  }, [selectedLanguage, selectedVoice, getAudioContext, stopReading, setMouthOpen, slideMode, slides.length, phase]);

  // ── Generate slides on mount ──────────────────────────

  const initComponent = useCallback(async () => {
    let loadedSlides: SlideData[] = [];

    if (config.slideMethod === 'ai-generate' && config.slideOutline) {
      setIsGenerating(true);
      try {
        const result = await generateReportSlides({
          outline: config.slideOutline,
          background: config.background,
          personality: config.personality,
          numSlides: 5,
          language: selectedLanguage.replace(/-.*$/, ''),
        });
        // generateReportSlides may return { slides: [...] } or directly an array
        loadedSlides = Array.isArray(result) ? result : (result.slides || []);
        if (loadedSlides.length > 0) {
          setSlides(loadedSlides);
        }
      } catch (err) {
        console.error('Failed to generate slides:', err);
        // Fallback: create a minimal slide set
        loadedSlides = [
          { display: '## Work Report', speech: 'Welcome to the work report presentation.' },
          { display: '## Overview', speech: 'Let me walk you through the key highlights.' },
        ];
        setSlides(loadedSlides);
      } finally {
        setIsGenerating(false);
      }
    } else if (config.slideMethod === 'upload' && config.uploadedSlides && config.uploadedSlides.length > 0) {
      loadedSlides = config.uploadedSlides;
      setSlides(loadedSlides);
    }

    if (loadedSlides.length === 0) {
      // Fallback
      loadedSlides = [
        { display: '## Work Report', speech: 'Welcome to the work report presentation.' },
        { display: '## Summary', speech: 'Here are the key highlights.' },
      ];
      setSlides(loadedSlides);
    }

    // Set AI questions
    setAiQuestions(config.presetQuestions || []);

    // Start presenting first slide
    if (loadedSlides.length > 0) {
      setCurrentSlide(0);
      // Give a moment for state to settle, then present
      setTimeout(() => {
        presentSlide(0, loadedSlides);
      }, 500);
    }
  }, [config]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    initComponent();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Present a slide ───────────────────────────────────

  const presentSlide = useCallback(async (slideIndex: number, slideList?: SlideData[]) => {
    const s = slideList || slides;
    const slide = s[slideIndex];
    if (!slide) return;

    // Send work report message with mode='present' to get AI's slide narration
    setIsWaiting(true);

    // Add AI message about the slide to chat
    const aiMsg: ChatMessage = {
      role: 'ai',
      content: slide.speech || slide.display,
      slideIndex,
    };
    setMessages(prev => [...prev, aiMsg]);

    try {
      const history = messagesRef.current.map(m => ({ role: m.role === 'ai' ? 'assistant' : 'user', content: m.content }));
      const { reply } = await sendWorkReportMessage({
        mode: 'present',
        slideContent: slide.display,
        background: config.background,
        aiPersonality: config.personality,
        message: '',
        history,
        presetQuestions: aiQuestions,
        askedQuestions: askedQuestions.map(i => aiQuestions[i]).filter(Boolean),
        language: selectedLanguage.replace(/-.*$/, ''),
        currentSlideIndex: slideIndex,
      });

      // Use the reply as the TTS text (AI elaboration)
      if (reply && reply.trim()) {
        spokenSlideRef.current.add(slideIndex);
        speakText(reply, slideIndex);
      } else {
        // Fallback to speech text
        speakText(slide.speech || slide.display, slideIndex);
      }
    } catch (err) {
      console.error('Work report present error:', err);
      // Fallback TTS with the slide speech
      speakText(slide.speech || slide.display, slideIndex);
    } finally {
      setIsWaiting(false);
    }
  }, [slides, config, aiQuestions, askedQuestions, selectedLanguage, speakText]);

  // ── Slide navigation ──────────────────────────────────

  const goToSlide = useCallback((index: number) => {
    if (index < 0 || index >= slides.length) return;
    stopReading();
    setCurrentSlide(index);
    // Present the slide
    setTimeout(() => {
      presentSlide(index);
    }, 200);
  }, [slides.length, stopReading, presentSlide]);

  const goNext = useCallback(() => {
    if (currentSlide < slides.length - 1) {
      goToSlide(currentSlide + 1);
    }
  }, [currentSlide, slides.length, goToSlide]);

  const goPrev = useCallback(() => {
    if (currentSlide > 0) {
      goToSlide(currentSlide - 1);
    }
  }, [currentSlide, goToSlide]);

  const toggleAutoMode = useCallback(() => {
    setSlideMode(prev => prev === 'auto' ? 'manual' : 'auto');
  }, []);

  // ── CTO Q&A Phase ────────────────────────────────────

  const askCTOQuestionOpen = useCallback(async () => {
    const msg: ChatMessage = {
      role: 'ai',
      content: 'That concludes the presentation. Do you have any questions, CTO? I\'m happy to address any concerns or dive deeper into any topic.',
    };
    setMessages(prev => [...prev, msg]);

    try {
      const history = messagesRef.current.map(m => ({ role: m.role === 'ai' ? 'assistant' : 'user', content: m.content }));
      const { reply } = await sendWorkReportMessage({
        mode: 'cto_question',
        slideContent: '',
        background: config.background,
        aiPersonality: config.personality,
        message: '',
        history,
        presetQuestions: aiQuestions,
        askedQuestions: askedQuestions.map(i => aiQuestions[i]).filter(Boolean),
        language: selectedLanguage.replace(/-.*$/, ''),
        currentSlideIndex: currentSlide,
      });
      if (reply && reply.trim()) {
        speakText(reply, currentSlide);
      }
    } catch {
      // Just speak the opening question
      speakText('That concludes the presentation. Do you have any questions?', currentSlide);
    }
  }, [config, aiQuestions, askedQuestions, selectedLanguage, currentSlide, speakText]);

  // ── AI Questions Phase ───────────────────────────────

  const askNextQuestion = useCallback(async () => {
    // Find the next unanswered question
    const unanswered = aiQuestions
      .map((q, i) => ({ q, i }))
      .filter(({ i }) => !askedQuestions.includes(i));

    if (unanswered.length === 0) {
      // All questions done
      setPhase('ended');
      const msg: ChatMessage = {
        role: 'ai',
        content: 'Thank you for your time, CTO. The work report is complete. I\'ll prepare the summary document for you.',
      };
      setMessages(prev => [...prev, msg]);
      speakText('Thank you for your time, CTO! The work report is complete.', currentSlide);
      return;
    }

    const next = unanswered[0];
    setAskedQuestions(prev => [...prev, next.i]);

    const msg: ChatMessage = {
      role: 'ai',
      content: next.q,
    };
    setMessages(prev => [...prev, msg]);

    try {
      const history = messagesRef.current.map(m => ({ role: m.role === 'ai' ? 'assistant' : 'user', content: m.content }));
      const { reply } = await sendWorkReportMessage({
        mode: 'ai_question',
        slideContent: '',
        background: config.background,
        aiPersonality: config.personality,
        message: '',
        history,
        presetQuestions: aiQuestions,
        askedQuestions: askedQuestions.map(i => aiQuestions[i]).filter(Boolean),
        language: selectedLanguage.replace(/-.*$/, ''),
        currentSlideIndex: currentSlide,
      });

      if (reply && reply.trim()) {
        speakText(reply, currentSlide);
      } else {
        speakText(next.q, currentSlide);
      }
    } catch {
      speakText(next.q, currentSlide);
    }
  }, [aiQuestions, askedQuestions, config, selectedLanguage, currentSlide, speakText]);

  // ── Handle TTS onended transitions ───────────────────

  // Listen for phase transitions after TTS finishes
  const originalOnEnded = useRef<(() => void) | null>(null);

  // When a slide finishes reading in auto mode, advance
  useEffect(() => {
    if (!isReading && !isWaiting && phase === 'presentation' && slideMode === 'auto') {
      // If we're not currently speaking and we have slides, check if we need to advance
      // This is handled inside speakText's onended
    }
  }, [isReading, isWaiting, phase, slideMode]);

  // When CTO Q&A phase starts and AI is done speaking, open auto-mic
  useEffect(() => {
    if (phase === 'cto-qa' && !isReading && !isWaiting) {
      // Open mic for CTO
      startAutoRecord();
    }
  }, [phase, isReading, isWaiting]); // eslint-disable-line react-hooks/exhaustive-deps

  // When AI asks a question and finishes speaking, open auto-mic
  useEffect(() => {
    if (phase === 'ai-questions' && !isReading && !isWaiting) {
      startAutoRecord();
    }
  }, [phase, isReading, isWaiting]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-mic (CTO voice input) ───────────────────────

  const RESPONSE_TIME_SEC = config.totalMinutes * 3; // 3 seconds per minute of report time, min 15s

  const startAutoRecord = useCallback(() => {
    if (isRecording || isWaiting) return;
    setAutoMicActive(true);
    const timeout = Math.max(15, RESPONSE_TIME_SEC);
    setResponseTimeLeft(timeout);

    if (responseTimerRef.current) clearInterval(responseTimerRef.current);
    responseTimerRef.current = setInterval(() => {
      setResponseTimeLeft(prev => {
        if (prev <= 1) {
          if (responseTimerRef.current) clearInterval(responseTimerRef.current);
          stopAutoRecord();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Start voice recognition
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return;
    const recog = new SR();
    recog.lang = selectedLanguage;
    recog.continuous = false;
    recog.interimResults = false;
    recog.maxAlternatives = 1;
    recog.onresult = (event: any) => {
      voiceFinalRef.current = event.results[0][0].transcript;
    };
    recog.onerror = () => { stopAutoRecord(); };
    recog.onend = () => {
      setIsRecording(false);
      setAutoMicActive(false);
      if (responseTimerRef.current) { clearInterval(responseTimerRef.current); responseTimerRef.current = null; }
      const text = voiceFinalRef.current.trim();
      voiceFinalRef.current = '';
      if (text) {
        handleCTOResponse(text);
      }
    };
    voiceRecogRef.current = recog;
    voiceFinalRef.current = '';
    setIsRecording(true);
    recog.start();
  }, [isRecording, isWaiting, RESPONSE_TIME_SEC, selectedLanguage]);

  const stopAutoRecord = useCallback(() => {
    if (responseTimerRef.current) { clearInterval(responseTimerRef.current); responseTimerRef.current = null; }
    setAutoMicActive(false);
    setResponseTimeLeft(0);
    if (voiceRecogRef.current) {
      try { voiceRecogRef.current.stop(); } catch {}
      voiceRecogRef.current = null;
    }
    setIsRecording(false);
  }, []);

  // ── Handle CTO response (voice or text) ──────────────

  const handleCTOResponse = useCallback(async (text: string) => {
    if (!text.trim() || isWaiting) return;

    const userMsg: ChatMessage = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setIsWaiting(true);

    const mode = phase === 'ai-questions' ? 'ai_question' : 'cto_question';

    try {
      const history = [...messagesRef.current, userMsg].map(m => ({ role: m.role === 'ai' ? 'assistant' : 'user', content: m.content }));
      const { reply } = await sendWorkReportMessage({
        mode: mode as 'present' | 'cto_question' | 'ai_question',
        slideContent: '',
        background: config.background,
        aiPersonality: config.personality,
        message: text,
        history,
        presetQuestions: aiQuestions,
        askedQuestions: askedQuestions.map(i => aiQuestions[i]).filter(Boolean),
        language: selectedLanguage.replace(/-.*$/, ''),
        currentSlideIndex: currentSlide,
      });

      const aiMsg: ChatMessage = { role: 'ai', content: reply };
      setMessages(prev => [...prev, aiMsg]);

      if (reply && reply.trim()) {
        speakText(reply, currentSlide);
      }

      // After AI responds, check if we should advance phases
      if (phase === 'cto-qa') {
        // Stay in CTO Q&A and wait for next TTS to finish before re-opening mic
      } else if (phase === 'ai-questions') {
        // Ask next question after AI finishes speaking
      }
    } catch (err) {
      console.error('Work report response error:', err);
      const errMsg: ChatMessage = { role: 'ai', content: '(Error getting response)' };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setIsWaiting(false);
      setInput('');
    }
  }, [isWaiting, phase, config, aiQuestions, askedQuestions, selectedLanguage, currentSlide, speakText]);

  // ── Text send ────────────────────────────────────────

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isWaiting) return;
    setInput('');

    await handleCTOResponse(text);
  }, [input, isWaiting, handleCTOResponse]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ── Voice recording (manual) ─────────────────────────

  const voiceStartRecording = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert('Speech recognition not supported'); return; }
    const recog = new SR();
    recog.lang = selectedLanguage;
    recog.continuous = true;
    recog.interimResults = true;
    recog.maxAlternatives = 1;
    recog.onresult = (event: any) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i];
        if (r.isFinal) voiceFinalRef.current += r[0].transcript;
        else interim += r[0].transcript;
      }
      setInput(voiceFinalRef.current + interim);
    };
    recog.onerror = () => { setIsRecording(false); };
    recog.onend = () => { setIsRecording(false); };
    voiceRecogRef.current = recog;
    setIsRecording(true);
    recog.start();
  }, [selectedLanguage]);

  const voiceStopRecording = useCallback(() => {
    setIsRecording(false);
    try { voiceRecogRef.current?.stop(); } catch {}
    const text = voiceFinalRef.current.trim();
    voiceFinalRef.current = '';
    if (!text || isWaiting) return;
    setInput(text);
  }, [isWaiting]);

  // ── End report ───────────────────────────────────────

  const handleEnd = useCallback(() => {
    stopReading();
    stopAutoRecord();
    onEnd();
  }, [stopReading, stopAutoRecord, onEnd]);

  // ── Download transcript ──────────────────────────────

  const downloadTranscript = useCallback(() => {
    const transcript = messages.map(m =>
      `[${m.role === 'ai' ? 'AI Lead (' + characterName + ')' : 'CTO'}]: ${m.content}`
    ).join('\n\n');
    const blob = new Blob([transcript], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `work-report-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [messages, characterName]);

  // ── Download HTML interactive presentation ───────────

  const downloadHtmlPresentationFile = useCallback(async () => {
    if (slides.length === 0) return;
    try {
      const blob = await downloadHtmlPresentation(slides, 'Work Report');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `work-report-presentation-${new Date().toISOString().slice(0, 10)}.html`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download HTML presentation error:', err);
    }
  }, [slides]);

  // ── Transition to AI questions phase ────────────────

  const startAIQuestions = useCallback(() => {
    setPhase('ai-questions');
    // Start asking questions
    setTimeout(() => {
      askNextQuestion();
    }, 500);
  }, [askNextQuestion]);

  // ── Phase label ──────────────────────────────────────

  const phaseLabel = {
    'presentation': 'Presentation',
    'cto-qa': 'CTO Q&A',
    'ai-questions': 'AI Questions',
    'ended': 'Completed',
  }[phase];

  const phaseColor = {
    'presentation': 'text-blue-600 bg-blue-50',
    'cto-qa': 'text-purple-600 bg-purple-50',
    'ai-questions': 'text-amber-600 bg-amber-50',
    'ended': 'text-green-600 bg-green-50',
  }[phase];

  // ── Loading ──────────────────────────────────────────

  if (isGenerating) {
    return (
      <div className="fixed inset-0 bg-white z-40 flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 text-gray-400 animate-spin mb-4" />
        <p className="text-lg text-gray-600 font-medium">Generating work report slides...</p>
        <p className="text-sm text-gray-400 mt-1">AI is preparing the presentation based on your outline</p>
      </div>
    );
  }

  if (slides.length === 0) {
    return (
      <div className="fixed inset-0 bg-white z-40 flex flex-col items-center justify-center">
        <Loader2 className="w-10 h-10 text-gray-400 animate-spin mb-4" />
        <p className="text-lg text-gray-600 font-medium">Preparing work report...</p>
      </div>
    );
  }

  const slide = slides[currentSlide] || { display: '', speech: '' };
  const totalSlides = slides.length;
  const progressPct = totalSlides > 1 ? ((currentSlide + 1) / totalSlides) * 100 : 100;

  // ── Render ──────────────────────────────────────────

  return (
    <div className="fixed inset-0 bg-white z-40 flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <h2 className="text-base font-semibold text-gray-900 truncate">Work Report</h2>
          <span className="text-xs text-gray-400">|</span>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${phaseColor}`}>
            {phaseLabel}
          </span>
          {isReading && (
            <span className="flex items-center gap-1 text-xs text-green-600">
              <Volume2 className="w-3 h-3" />
              Speaking
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* End button */}
          <button
            onClick={downloadTranscript}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title="Download transcript"
          >
            <Download className="w-3.5 h-3.5" />
            Transcript
          </button>
          <button
            onClick={downloadHtmlPresentationFile}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
            title="Download interactive HTML presentation"
          >
            <FileText className="w-3.5 h-3.5" />
            HTML Slide
          </button>
          <button
            onClick={handleEnd}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            End
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="shrink-0 h-1 bg-gray-100">
        <div
          className="h-full bg-blue-500 transition-all duration-500"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Main content: slide viewer left + chat right */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── LEFT: Slide Viewer ── */}
        <div className="w-[45%] min-w-[320px] border-r border-gray-100 flex flex-col bg-gradient-to-b from-white to-gray-50">
          {/* Slide content */}
          <div className="flex-1 flex flex-col items-center justify-center p-6 overflow-y-auto">
            {/* Slide number indicator */}
            <div className="text-xs text-gray-400 mb-3 font-medium">
              Slide {currentSlide + 1} of {totalSlides}
            </div>

            {/* Slide renderer */}
            <div className="w-full flex-1 flex items-center justify-center">
              <SlideContent display={slide.display} />
            </div>

            {/* Narration indicator */}
            {slide.speech !== slide.display && readingSlide === currentSlide && (
              <div className="mt-3 flex items-center gap-1.5 text-xs text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
                <MessageSquare className="w-3 h-3" />
                Narration in progress
              </div>
            )}
          </div>

          {/* Slide controls */}
          <div className="shrink-0 border-t border-gray-200 px-4 py-3 bg-white">
            <div className="flex items-center justify-between">
              {/* Navigation */}
              <div className="flex items-center gap-1">
                <button
                  onClick={goPrev}
                  disabled={currentSlide === 0 || isWaiting}
                  className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  aria-label="Previous slide"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="text-xs text-gray-500 font-mono min-w-[3rem] text-center">
                  {currentSlide + 1}/{totalSlides}
                </span>
                <button
                  onClick={goNext}
                  disabled={currentSlide >= totalSlides - 1 || isWaiting}
                  className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  aria-label="Next slide"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>

              {/* Auto/Manual toggle + Read/Stop */}
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleAutoMode}
                  disabled={phase !== 'presentation'}
                  className={`flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg font-medium transition-colors ${
                    slideMode === 'auto'
                      ? 'bg-blue-50 text-blue-700'
                      : 'bg-gray-100 text-gray-600'
                  } disabled:opacity-40 disabled:cursor-not-allowed`}
                >
                  {slideMode === 'auto' ? '🤖 Auto' : '🎮 Manual'}
                </button>

                <button
                  onClick={() => {
                    if (isReading) {
                      stopReading();
                    } else {
                      speakText(slide.speech || slide.display, currentSlide);
                    }
                  }}
                  disabled={isWaiting}
                  className={`flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                    isReading
                      ? 'bg-red-50 text-red-700 hover:bg-red-100'
                      : 'bg-gray-900 text-white hover:bg-gray-800'
                  } disabled:opacity-40 disabled:cursor-not-allowed`}
                >
                  {isReading ? (
                    <><Square className="w-3.5 h-3.5" /> Stop</>
                  ) : (
                    <><Play className="w-3.5 h-3.5" /> Read</>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── RIGHT: Chat / Messages ── */}
        <div className="flex-1 flex flex-col bg-white">
          {/* Phase transition button */}
          {phase === 'cto-qa' && !isReading && !isWaiting && (
            <div className="shrink-0 px-4 py-2 bg-purple-50 border-b border-purple-100 flex items-center justify-between">
              <span className="text-xs text-purple-700 font-medium">
                💬 CTO Q&A — Ask questions about the report
              </span>
              <button
                onClick={startAIQuestions}
                className="text-xs px-3 py-1 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                Skip to AI Questions
              </button>
            </div>
          )}

          {phase === 'ai-questions' && !isReading && !isWaiting && (
            <div className="shrink-0 px-4 py-2 bg-amber-50 border-b border-amber-100">
              <span className="text-xs text-amber-700 font-medium">
                ❓ AI is asking you preset questions — please respond
              </span>
            </div>
          )}

          {phase === 'ended' && (
            <div className="shrink-0 px-4 py-3 bg-green-50 border-b border-green-100 flex items-center justify-between">
              <span className="text-xs text-green-700 font-medium flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" />
                Work report completed
              </span>
              <button
                onClick={downloadTranscript}
                className="text-xs px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-1"
              >
                <Download className="w-3 h-3" />
                Download Report
              </button>
            </div>
          )}

          {/* Chat area */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
            {messages.length === 0 && (
              <div className="text-center text-sm text-gray-400 py-12">
                AI Lead is preparing the presentation...
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-gray-900 text-white rounded-br-md'
                      : 'bg-gray-100 text-gray-800 rounded-bl-md'
                  }`}
                >
                  {msg.role === 'ai' && (
                    <span className="text-xs font-semibold text-blue-600 block mb-1">
                      AI Lead ({characterName})
                    </span>
                  )}
                  {msg.role === 'user' && (
                    <span className="text-xs font-semibold text-gray-400 block mb-1">CTO</span>
                  )}
                  <span className="whitespace-pre-wrap">{msg.content}</span>
                </div>
              </div>
            ))}

            {isWaiting && (
              <div className="flex justify-start">
                <div className="max-w-[80%] rounded-2xl px-4 py-3 bg-gray-100 rounded-bl-md">
                  <span className="text-xs font-semibold text-blue-600 block mb-1">AI Lead ({characterName})</span>
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Auto-mic indicator */}
          {autoMicActive && (
            <div className="shrink-0 px-4 py-2 bg-purple-50 border-t border-purple-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-medium text-purple-700">
                  <Mic className="w-3.5 h-3.5 animate-pulse" />
                  {isRecording ? 'Listening for your response...' : 'Microphone ready...'}
                </div>
                <div className="flex items-center gap-2">
                  <div className={`flex items-center gap-1 text-xs font-mono font-bold ${
                    responseTimeLeft <= 10 ? 'text-red-600' : 'text-purple-600'
                  }`}>
                    <Clock className="w-3 h-3" />
                    {responseTimeLeft}s
                  </div>
                  <button
                    onClick={stopAutoRecord}
                    className="text-xs px-2 py-1 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Input area */}
          {(phase === 'cto-qa' || phase === 'ai-questions') && (
            <div className="shrink-0 border-t border-gray-200 px-4 py-3 bg-white">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={phase === 'ai-questions' ? 'Answer the AI\'s question...' : 'Ask a question about the report...'}
                  disabled={isWaiting}
                  className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-gray-400 disabled:bg-gray-50 disabled:text-gray-400"
                />
                <div className="relative">
                  {isRecording && !autoMicActive && (
                    <div className="absolute inset-0 rounded-full animate-ping bg-red-400/30" />
                  )}
                  <button
                    type="button"
                    onClick={() => { if (isRecording && !autoMicActive) voiceStopRecording(); else voiceStartRecording(); }}
                    disabled={isWaiting || autoMicActive}
                    className={`p-2.5 rounded-xl transition-colors ${
                      isRecording && !autoMicActive
                        ? 'bg-red-500 text-white animate-pulse'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    } disabled:opacity-40 disabled:cursor-not-allowed`}
                    title={isRecording ? 'Tap to stop' : 'Tap to speak'}
                  >
                    <Mic className="w-4 h-4" />
                  </button>
                </div>
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isWaiting}
                  className="p-2.5 bg-gray-900 text-white rounded-xl hover:bg-gray-800 disabled:bg-gray-200 disabled:text-gray-400 transition-colors"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Ended phase — show final controls */}
          {phase === 'ended' && (
            <div className="shrink-0 border-t border-gray-200 px-4 py-4 bg-white">
              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={downloadTranscript}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                >
                  <Download className="w-4 h-4" />
                  Download Report
                </button>
                <button
                  onClick={handleEnd}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
                >
                  <X className="w-4 h-4" />
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
