"use client";

import React, { useState, useEffect, useRef, useCallback, useContext } from 'react';
import { X, Send, Volume2, Clock, Target, Mic, Square } from 'lucide-react';
import { sendMeetingMessage, getMeetingSummary, getAIAudioFromText } from '@/services/adk-assistant.service';
import { getSharedAudioContext } from '@/lib/audio-context';
import VoiceAssistantContext from '../../context/VoiceAssistantContext';
import type { MeetingConfig } from './MeetingSetup.component';

interface MeetingMessage {
  role: 'host' | 'participant';
  content: string;
  author: string;
}

interface MeetingModeProps {
  config: MeetingConfig;
  onEnd: () => void;
}

/** Highlight question sentences ending with ? */
function highlightQuestions(text: string): React.ReactNode {
  const parts = text.split(/(?<=[.!?])\s+/);
  return parts.map((part, i) => {
    const isQuestion = part.trim().endsWith('?');
    return isQuestion
      ? <span key={i} className="font-bold text-purple-700 bg-purple-50 px-1 -mx-1 rounded">{part} </span>
      : <span key={i}>{part} </span>;
  });
}

export default function MeetingMode({ config, onEnd }: MeetingModeProps) {
  const { selectedLanguage, selectedVoice, setMouthOpen } = useContext(VoiceAssistantContext);
  const [messages, setMessages] = useState<MeetingMessage[]>([]);
  const [input, setInput] = useState('');
  const [isWaiting, setIsWaiting] = useState(false);
  const [currentItemIdx, setCurrentItemIdx] = useState(0);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [summaryText, setSummaryText] = useState('');
  const [autoMicActive, setAutoMicActive] = useState(false);
  const [responseTimeLeft, setResponseTimeLeft] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const messagesRef = useRef<MeetingMessage[]>([]);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const spokenIdsRef = useRef<Set<number>>(new Set());
  const audioContextRef = useRef<AudioContext | null>(null);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const voiceRecogRef = useRef<any>(null);
  const voiceFinalRef = useRef<string>('');
  const responseTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => { messagesRef.current = messages; }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Timer
  useEffect(() => {
    if (currentItemIdx >= config.agenda.length) return;
    const item = config.agenda[currentItemIdx];
    setTimerSeconds(item.durationMinutes * 60);
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    timerIntervalRef.current = setInterval(() => {
      setTimerSeconds(prev => {
        if (prev <= 1) { if (timerIntervalRef.current) clearInterval(timerIntervalRef.current); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerIntervalRef.current) clearInterval(timerIntervalRef.current); };
  }, [currentItemIdx, config.agenda]);

  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Audio setup
  const getAudioCtx = useCallback((): AudioContext => {
    if (!audioContextRef.current) {
      audioContextRef.current = getSharedAudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.connect(audioContextRef.current.destination);
    }
    return audioContextRef.current;
  }, []);

  const stopSpeaking = useCallback(() => {
    if (currentSourceRef.current) {
      try { currentSourceRef.current.stop(); } catch {}
      currentSourceRef.current = null;
    }
    if (rafIdRef.current) { cancelAnimationFrame(rafIdRef.current); rafIdRef.current = null; }
    setIsSpeaking(false);
    setMouthOpen(0);
  }, [setMouthOpen]);

  // Speak host response via TTS
  const speakHostResponse = useCallback(async (text: string) => {
    stopSpeaking();
    if (!selectedVoice) return;
    setIsSpeaking(true);
    try {
      const blob = await getAIAudioFromText(text, 'en', selectedVoice);
      const audioCtx = getAudioCtx();
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
        if (audioCtx.state !== 'closed') rafIdRef.current = requestAnimationFrame(updateMouth);
      };
      updateMouth();
      source.onended = () => {
        rafIdRef.current = null;
        setIsSpeaking(false);
        setMouthOpen(0);
        // Auto-record: if host message has a question, open mic for participant
        const lastMsg = messagesRef.current[messagesRef.current.length - 1];
        if (lastMsg && lastMsg.role === 'host' && lastMsg.content.includes('?')) {
          startAutoRecord();
        }
      };
    } catch {
      setIsSpeaking(false);
      setMouthOpen(0);
    }
  }, [getAudioCtx, stopSpeaking, setMouthOpen, selectedVoice]);

  // Auto-play TTS for new host messages
  useEffect(() => {
    if (isWaiting || !selectedVoice) return;
    const lastIdx = messages.length - 1;
    if (lastIdx < 0) return;
    const lastMsg = messages[lastIdx];
    if (lastMsg.role !== 'host' || spokenIdsRef.current.has(lastIdx)) return;
    if (lastMsg.content.startsWith('(Error')) return;
    spokenIdsRef.current.add(lastIdx);
    speakHostResponse(lastMsg.content);
  }, [messages, isWaiting, selectedVoice, speakHostResponse]);

  const callHost = useCallback(async (history: MeetingMessage[], msg: string) => {
    setIsWaiting(true);
    try {
      const { reply } = await sendMeetingMessage({
        title: config.title,
        agenda: config.agenda,
        participants: config.participants,
        background: config.background,
        message: msg,
        history: history.map(m => ({ role: m.role === 'host' ? 'host' : 'user', content: m.content })),
        language: 'en',
      });
      return reply;
    } catch (err) {
      return `(Error: ${err})`;
    } finally {
      setIsWaiting(false);
    }
  }, [config]);

  // Start meeting
  useEffect(() => {
    const startMeeting = async () => {
      const reply = await callHost([], '');
      setMessages([{ role: 'host', content: reply, author: 'Meeting Host' }]);
    };
    startMeeting();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSend = async (text: string) => {
    if (!text.trim() || isWaiting) return;
    setInput('');

    const userMsg: MeetingMessage = { role: 'participant', content: text.trim(), author: 'You' };
    const updated = [...messagesRef.current, userMsg];
    setMessages(updated);

    const reply = await callHost(updated, text.trim());
    const hostMsg: MeetingMessage = { role: 'host', content: reply, author: 'Meeting Host' };
    const final = [...updated, hostMsg];
    setMessages(final);

    const hostCount = final.filter(m => m.role === 'host').length;
    const newIdx = Math.min(Math.floor(hostCount / 3), config.agenda.length - 1);
    setCurrentItemIdx(newIdx);
  };

  // Voice recording (tap-to-record)
  const toggleRecording = () => {
    if (isRecording) {
      // Stop recording
      if (voiceRecogRef.current) {
        voiceRecogRef.current.stop();
        voiceRecogRef.current = null;
      }
      setIsRecording(false);
      const text = voiceFinalRef.current.trim();
      voiceFinalRef.current = '';
      if (text) handleSend(text);
    } else {
      // Start recording
      if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        alert('Voice input is not supported in this browser.');
        return;
      }
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        voiceFinalRef.current = transcript;
      };
      recognition.onerror = () => { setIsRecording(false); };
      recognition.onend = () => {
        setIsRecording(false);
        const text = voiceFinalRef.current.trim();
        voiceFinalRef.current = '';
        if (text) handleSend(text);
      };
      voiceRecogRef.current = recognition;
      voiceFinalRef.current = '';
      recognition.start();
      setIsRecording(true);
    }
  };

  const RESPONSE_TIME_SEC = config.responseTimeSeconds;

  const startAutoRecord = () => {
    if (isRecording || isWaiting || isSpeaking) return;
    setAutoMicActive(true);
    if (RESPONSE_TIME_SEC > 0) {
      setResponseTimeLeft(RESPONSE_TIME_SEC);
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
    } else {
      setResponseTimeLeft(0);
    }
    // Start voice recording
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    recognition.onresult = (event: any) => {
      voiceFinalRef.current = event.results[0][0].transcript;
    };
    recognition.onerror = () => { stopAutoRecord(); };
    recognition.onend = () => {
      setIsRecording(false);
      setAutoMicActive(false);
      if (responseTimerRef.current) clearInterval(responseTimerRef.current);
      const text = voiceFinalRef.current.trim();
      voiceFinalRef.current = '';
      if (text) handleSend(text);
    };
    voiceRecogRef.current = recognition;
    voiceFinalRef.current = '';
    recognition.start();
    setIsRecording(true);
  };

  const stopAutoRecord = () => {
    if (responseTimerRef.current) { clearInterval(responseTimerRef.current); responseTimerRef.current = null; }
    setAutoMicActive(false);
    setResponseTimeLeft(0);
    if (voiceRecogRef.current) {
      try { voiceRecogRef.current.stop(); } catch {}
      voiceRecogRef.current = null;
    }
    setIsRecording(false);
  };

  const handleTextSend = () => {
    handleSend(input);
  };

  const handleEnd = async () => {
    stopSpeaking();
    const msgs = messagesRef.current;
    if (msgs.length > 1) {
      try {
        const { summary } = await getMeetingSummary({
          title: config.title,
          agenda: config.agenda,
          participants: config.participants,
          history: msgs.map(m => ({ role: m.role, content: m.content })),
        });
        setSummaryText(summary);
      } catch {
        setSummaryText('Failed to generate summary.');
      }
    } else {
      setSummaryText('Meeting ended with no discussion.');
    }
    setShowSummary(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleTextSend();
    }
  };

  const timerWarning = timerSeconds <= 30 && timerSeconds > 0;
  const timerCritical = timerSeconds <= 10 && timerSeconds > 0;

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white">
      {/* ── Top Controls ── */}
      <div className="shrink-0 flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-[var(--md-tertiary)]" />
          <span className="text-sm font-semibold text-gray-900">{config.title}</span>
          {isSpeaking && <Volume2 className="w-3.5 h-3.5 text-green-500 animate-pulse" />}
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              const summary = messages.map(m =>
                `[${m.role === 'host' ? 'Host' : m.author}]: ${m.content}`
              ).join('\n\n');
              const blob = new Blob([summary], { type: 'text/plain' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url; a.download = `meeting-${config.title.replace(/\s+/g, '-')}.txt`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Volume2 className="w-3.5 h-3.5" />
            Minutes
          </button>
          <button
            onClick={handleEnd}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            End Meeting
          </button>
        </div>
      </div>

      <div className="flex-1 flex min-h-0">
        {/* ── Left: Agenda Sidebar ── */}
        <div className="w-[240px] shrink-0 border-r border-gray-200 bg-gray-50/50 flex flex-col overflow-y-auto">
          <div className="px-3 py-3 border-b border-gray-200">
            <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Agenda</div>
            <div className="space-y-1">
              {config.agenda.map((item, idx) => {
                const done = idx < currentItemIdx;
                const active = idx === currentItemIdx;
                return (
                  <div key={item.id} className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs transition-all ${
                    active ? 'bg-[var(--md-tertiary)]/10 border border-[var(--md-tertiary)]/20' : done ? 'text-gray-400' : 'text-gray-600'
                  }`}>
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      done ? 'bg-green-100 text-green-600' : active ? 'bg-[var(--md-tertiary)] text-white' : 'bg-gray-200 text-gray-500'
                    }`}>
                      {done ? '✓' : idx + 1}
                    </span>
                    <span className={`flex-1 truncate ${done ? 'line-through' : ''}`}>{item.title}</span>
                    <span className="text-[10px] opacity-60">{item.durationMinutes}m</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="px-3 py-3 border-b border-gray-200">
            <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Timer</div>
            <div className={`text-center py-3 rounded-lg text-lg font-bold font-mono ${
              timerCritical ? 'text-red-600 bg-red-50' : timerWarning ? 'text-amber-600 bg-amber-50' : 'text-gray-700 bg-white'
            }`}>
              <Clock className="w-4 h-4 inline mr-1" />
              {formatTime(timerSeconds)}
            </div>
          </div>
          <div className="px-3 py-3 flex-1">
            <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Participants</div>
            <div className="space-y-1">
              {config.participants.map((p) => (
                <div key={p.id} className="flex items-center gap-2 px-2 py-1.5 text-xs text-gray-600">
                  <span className="w-2 h-2 rounded-full bg-green-400" />
                  <span className="font-medium">{p.name}</span>
                  {p.role && <span className="text-gray-400">({p.role})</span>}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Right: Chat ── */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
            {messages.length === 0 && isWaiting && (
              <div className="text-center text-sm text-gray-400 py-12">Meeting Host is opening the meeting...</div>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'participant' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  msg.role === 'participant' ? 'bg-gray-900 text-white rounded-br-md' : 'bg-gray-100 text-gray-800 rounded-bl-md'
                }`}>
                  <span className={`text-xs font-semibold block mb-1 ${msg.role === 'participant' ? 'text-gray-400' : 'text-[var(--md-tertiary)]'}`}>
                    {msg.author}
                    {msg.role === 'host' && isSpeaking && i === messages.length - 1 && (
                      <span className="ml-1.5 inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    )}
                  </span>
                  <span className="whitespace-pre-wrap">{highlightQuestions(msg.content)}</span>
                </div>
              </div>
            ))}
            {isWaiting && (
              <div className="flex justify-start">
                <div className="max-w-[75%] rounded-2xl px-4 py-3 bg-gray-100 rounded-bl-md">
                  <span className="text-xs font-semibold text-[var(--md-tertiary)] block mb-1">Meeting Host</span>
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

          {/* ── Input ── */}
          <div className="shrink-0 border-t border-gray-200 px-4 py-3 bg-white">
            {autoMicActive && (
              <div className="flex items-center justify-between mb-2 px-3 py-2 bg-purple-50 border border-purple-200 rounded-lg">
                <div className="flex items-center gap-2 text-xs font-medium text-purple-700">
                  <Mic className="w-3.5 h-3.5 animate-pulse" />
                  Recording your response...
                </div>
                {RESPONSE_TIME_SEC > 0 && (
                  <div className={`flex items-center gap-1 text-xs font-mono font-bold ${
                    responseTimeLeft <= 10 ? 'text-red-600' : 'text-purple-600'
                  }`}>
                    <Clock className="w-3 h-3" />
                    {responseTimeLeft}s
                  </div>
                )}
              </div>
            )}
            <div className="flex items-center gap-2">
              <button
                onClick={toggleRecording}
                className={`p-2.5 rounded-xl transition-all ${
                  isRecording
                    ? 'bg-red-500 text-white animate-pulse'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                }`}
                title={isRecording ? 'Tap to stop recording' : 'Tap to record voice'}
              >
                {isRecording ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isRecording ? 'Recording... tap 🟥 to stop' : 'Type your response...'}
                disabled={isWaiting || isRecording}
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-gray-400 disabled:bg-gray-50 disabled:text-gray-400"
              />
              <button
                onClick={handleTextSend}
                disabled={!input.trim() || isWaiting}
                className="p-2.5 rounded-xl bg-gray-900 text-white hover:bg-gray-800 disabled:bg-gray-200 disabled:text-gray-400 transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Summary Overlay ── */}
      {showSummary && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-[640px] max-h-[85vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5 text-[var(--md-tertiary)]" />
                <h2 className="text-lg font-semibold text-gray-900">Meeting Summary</h2>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap font-mono text-xs">
                {summaryText || 'Generating summary...'}
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
              <button
                onClick={() => {
                  const blob = new Blob([summaryText], { type: 'text/markdown' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url; a.download = `meeting-${config.title.replace(/\s+/g, '-')}-summary.md`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <Volume2 className="w-4 h-4" />
                Download .md
              </button>
              <button
                onClick={onEnd}
                className="flex items-center gap-1.5 px-5 py-2 text-sm font-medium text-white bg-[var(--md-tertiary)] hover:opacity-90 rounded-lg transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
