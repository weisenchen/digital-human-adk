"use client";

import { useState, useEffect, useRef, useCallback, useContext } from 'react';
import { X, Send, Volume2, Pause, Play, Mic } from 'lucide-react';
import DigitalHumanContainer from '../DigitalHumanContainer/DigitalHumanContainer.component';
import { sendTalkShowMessage, getAIAudioFromText, getTalkShowSuggestions } from '@/services/adk-assistant.service';
import { getSharedAudioContext } from '@/lib/audio-context';
import VoiceAssistantContext from '../../context/VoiceAssistantContext';

interface TalkShowMessage {
  role: 'host' | 'guest';
  content: string;
}

interface TalkShowModeProps {
  topic: string;
  guestName: string;
  hostName: string;
  background: string;
  questions: string;
  personality: string;
  durationMinutes: number;
  onEnd: () => void;
}

export default function TalkShowMode({
  topic,
  guestName,
  hostName,
  background,
  questions,
  personality,
  durationMinutes,
  onEnd,
}: TalkShowModeProps) {
  const { selectedLanguage, setMouthOpen, selectedVoice } = useContext(VoiceAssistantContext);
  const [messages, setMessages] = useState<TalkShowMessage[]>([]);
  const [input, setInput] = useState('');
  const [isWaiting, setIsWaiting] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [voiceRecording, setVoiceRecording] = useState(false);
  const voiceRecogRef = useRef<any>(null);
  const voiceFinalRef = useRef<string>('');

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const messagesRef = useRef<TalkShowMessage[]>([]);
  const spokenIdsRef = useRef<Set<number>>(new Set());

  // Keep messagesRef in sync
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const getAudioContext = useCallback((): AudioContext => {
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
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    setIsSpeaking(false);
    setMouthOpen(0);
  }, [setMouthOpen]);

  const playSound = useCallback(async (effect: string) => {
    const soundMap: Record<string, string> = {
      applause: '/sounds/applause.wav',
      laugh: '/sounds/laugh.wav',
      whoosh: '/sounds/whoosh.wav',
    };
    const url = soundMap[effect];
    if (!url) return;
    try {
      const audioCtx = getAudioContext();
      if (audioCtx.state === 'suspended') await audioCtx.resume();
      const resp = await fetch(url);
      const arrayBuffer = await resp.arrayBuffer();
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      const source = audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioCtx.destination);
      source.start(0);
    } catch {}
  }, [getAudioContext]);

  const togglePause = useCallback(() => {
    setIsPaused(prev => {
      if (prev) {
        // Resuming: clear last host message from spokenIds so it gets re-spoken
        const msgs = messagesRef.current;
        for (let i = msgs.length - 1; i >= 0; i--) {
          if (msgs[i].role === 'host') {
            spokenIdsRef.current.delete(i);
            break;
          }
        }
      } else {
        stopSpeaking();
      }
      return !prev;
    });
  }, [stopSpeaking]);

  const speakHostResponse = useCallback(async (text: string, voice: string) => {
    stopSpeaking();
    setIsSpeaking(true);
    try {
      const blob = await getAIAudioFromText(text, selectedLanguage, voice);
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
        rafIdRef.current = null;
        setIsSpeaking(false);
        setMouthOpen(0);
      };
    } catch (err) {
      console.error('Talk show TTS error:', err);
      setIsSpeaking(false);
      setMouthOpen(0);
    }
  }, [selectedLanguage, getAudioContext, stopSpeaking, setMouthOpen]);

  // Auto-play host TTS when new host messages arrive
  useEffect(() => {
    if (isPaused || isWaiting || !selectedVoice) return;
    const lastIdx = messages.length - 1;
    if (lastIdx < 0) return;
    const lastMsg = messages[lastIdx];
    if (lastMsg.role !== 'host' || spokenIdsRef.current.has(lastIdx)) return;
    if (lastMsg.content.startsWith('(Error')) return;
    spokenIdsRef.current.add(lastIdx);
    speakHostResponse(lastMsg.content, selectedVoice);
  }, [messages, isPaused, isWaiting, selectedVoice, speakHostResponse]);

  // Fetch guest suggestions after host responds
  useEffect(() => {
    if (isWaiting || messages.length === 0) return;
    const lastMsg = messages[messages.length - 1];
    if (lastMsg.role !== 'host') return;
    if (lastMsg.content.startsWith('(Error')) { setSuggestions([]); return; }
    const history = messagesRef.current.map(m => ({ role: m.role, content: m.content }));
    getTalkShowSuggestions({ topic, guestName, hostName, background, history, language: 'en' })
      .then(setSuggestions)
      .catch(() => setSuggestions([]));
  }, [isWaiting, messages, topic, guestName, hostName, background]);

  // Start the show: generate opening
  const startShow = useCallback(async () => {
    setIsWaiting(true);
    try {
      const { reply, soundEffect } = await sendTalkShowMessage({
        topic,
        guestName,
        hostName,
        background,
        questions,
        personality,
        durationMinutes,
        message: '',
        history: [],
        language: 'en',
      });
      const hostMsg: TalkShowMessage = { role: 'host', content: reply };
      setMessages([hostMsg]);
      if (soundEffect) playSound(soundEffect);
    } catch (err) {
      console.error('Talk show start error:', err);
      setMessages([{ role: 'host', content: `(Error starting the show: ${err})` }]);
    } finally {
      setIsWaiting(false);
    }
  }, [topic, guestName, hostName, background, questions, personality, durationMinutes, playSound]);

  useEffect(() => {
    startShow();
    return () => stopSpeaking();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const voiceStartRecording = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert('Speech recognition not supported'); return; }
    const recog = new SR();
    recog.lang = 'en';
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
    recog.onerror = () => { setVoiceRecording(false); };
    recog.onend = () => { setVoiceRecording(false); };
    voiceRecogRef.current = recog;
    setVoiceRecording(true);
    recog.start();
  }, []);

  const voiceStopRecording = useCallback(() => {
    setVoiceRecording(false);
    try { voiceRecogRef.current?.stop(); } catch {}
    const text = voiceFinalRef.current.trim();
    voiceFinalRef.current = '';
    if (!text || isWaiting) return;
    setInput(text);
    setSuggestions([]);
    const guestMsg: TalkShowMessage = { role: 'guest', content: text };
    const updated = [...messagesRef.current, guestMsg];
    setMessages(updated);
    setIsWaiting(true);
    const history = updated.map(m => ({ role: m.role, content: m.content }));
    sendTalkShowMessage({
      topic, guestName, hostName, background, questions, personality,
      durationMinutes, message: text, history, language: 'en',
    }).then(({ reply, soundEffect }: {reply: string; soundEffect: string | null}) => {
      setMessages(prev => [...prev, { role: 'host', content: reply }]);
      if (soundEffect) playSound(soundEffect);
    }).catch(err => {
      console.error('Talk show voice error:', err);
      setMessages(prev => [...prev, { role: 'host', content: '(Error getting response)' }]);
    }).finally(() => { setIsWaiting(false); setInput(''); });
  }, [isWaiting, topic, guestName, hostName, background, questions, personality, durationMinutes, playSound]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isWaiting || isPaused) return;
    setInput('');
    setSuggestions([]);

    const guestMsg: TalkShowMessage = { role: 'guest', content: text };
    const updated = [...messagesRef.current, guestMsg];
    setMessages(updated);
    setIsWaiting(true);

    try {
      const history = updated.map(m => ({ role: m.role, content: m.content }));
      const { reply, soundEffect } = await sendTalkShowMessage({
        topic,
        guestName,
        hostName,
        background,
        questions,
        personality,
        durationMinutes,
        message: text,
        history,
        language: 'en',
      });
      const hostMsg: TalkShowMessage = { role: 'host', content: reply };
      setMessages(prev => [...prev, hostMsg]);
      if (soundEffect) playSound(soundEffect);
    } catch (err) {
      console.error('Talk show ask error:', err);
      setMessages(prev => [...prev, { role: 'host', content: '(Error getting response)' }]);
    } finally {
      setIsWaiting(false);
    }
  }, [input, isWaiting, topic, guestName, hostName, background, questions, personality, durationMinutes, isPaused, playSound]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="fixed inset-0 bg-white z-40 flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <h2 className="text-base font-semibold text-gray-900 truncate">{topic || 'Talk Show'}</h2>
          <span className="text-xs text-gray-400">|</span>
          <span className="text-sm text-gray-600">Guest: <span className="font-medium">{guestName}</span></span>
          {isSpeaking && (
            <span className="flex items-center gap-1 text-xs text-green-600">
              <Volume2 className="w-3 h-3" />
              Speaking
            </span>
          )}
          {isPaused && (
            <span className="flex items-center gap-1 text-xs text-amber-600 font-medium">
              <Pause className="w-3 h-3" />
              Paused
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={togglePause}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              isPaused
                ? 'bg-green-50 text-green-700 hover:bg-green-100'
                : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
            }`}
            title={isPaused ? 'Resume Show' : 'Pause Show'}
          >
            {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
            {isPaused ? 'Resume' : 'Pause'}
          </button>
          <button
            onClick={() => { stopSpeaking(); onEnd(); }}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            End Show
          </button>
        </div>
      </div>

      {/* ── Show Progress Indicator ── */}
      {(() => {
        const hostCount = messages.filter(m => m.role === 'host').length;
        const segments = [
          { id: 'opening', label: 'Opening', icon: '🎬' },
          { id: 'warmup', label: 'Warm-up', icon: '👋' },
          { id: 'main', label: 'Discussion', icon: '🎯' },
          { id: 'closing', label: 'Closing', icon: '🎬' },
        ];
        let activeIdx = 0;
        if (hostCount >= 8) activeIdx = 3;
        else if (hostCount >= 4) activeIdx = 2;
        else if (hostCount >= 2) activeIdx = 1;
        return (
          <div className="shrink-0 flex items-center gap-1 px-4 py-1.5 bg-gray-50 border-b border-gray-100">
            {segments.map((seg, i) => (
              <div key={seg.id} className="flex items-center gap-0 flex-1">
                <div className={`flex items-center gap-1 text-[10px] font-medium transition-colors ${
                  i < activeIdx ? 'text-green-600' : i === activeIdx ? 'text-gray-900' : 'text-gray-300'
                }`}>
                  <span>{i <= activeIdx ? seg.icon : '○'}</span>
                  <span className="hidden sm:inline">{seg.label}</span>
                </div>
                {i < segments.length - 1 && (
                  <div className={`flex-1 h-px mx-1.5 transition-colors ${
                    i < activeIdx ? 'bg-green-400' : 'bg-gray-200'
                  }`} />
                )}
              </div>
            ))}
          </div>
        );
      })()}

      {/* Main content: avatar left + chat right */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Avatar */}
        <div className="w-[45%] min-w-[300px] border-r border-gray-100 flex items-center justify-center bg-gradient-to-b from-white to-gray-50">
          <div className="w-full h-full flex items-center justify-center">
            <DigitalHumanContainer compact />
          </div>
        </div>

        {/* Right: Interview */}
        <div className="flex-1 flex flex-col bg-white">
          {/* Chat area */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
            <div className="text-center text-xs text-gray-400 mb-2">
              {hostName} interviewing {guestName}
            </div>

            {messages.length === 0 && isWaiting && (
              <div className="text-center text-sm text-gray-400 py-12">
                {hostName} is preparing the show...
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'guest' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    msg.role === 'guest'
                      ? 'bg-gray-900 text-white rounded-br-md'
                      : 'bg-gray-100 text-gray-800 rounded-bl-md'
                  }`}
                >
                  {msg.role === 'host' && (
                    <span className="text-xs font-semibold text-purple-600 block mb-1">{hostName}</span>
                  )}
                  {msg.role === 'guest' && (
                    <span className="text-xs font-semibold text-gray-400 block mb-1">{guestName}</span>
                  )}
                  <span className="whitespace-pre-wrap">{msg.content}</span>
                </div>
              </div>
            ))}

            {isWaiting && (
              <div className="flex justify-start">
                <div className="max-w-[80%] rounded-2xl px-4 py-3 bg-gray-100 rounded-bl-md">
                  <span className="text-xs font-semibold text-purple-600 block mb-1">{hostName}</span>
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

          {/* Suggestion chips */}
          {suggestions.length > 0 && !isWaiting && !isPaused && (
            <div className="shrink-0 px-4 py-2 border-t border-gray-100 bg-gray-50/50">
              <div className="flex flex-wrap gap-2">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => { setInput(s); setSuggestions([]); }}
                    className="text-xs px-3 py-1.5 bg-white border border-gray-200 rounded-full text-gray-600 hover:bg-gray-100 hover:border-gray-300 hover:text-gray-800 transition-colors whitespace-nowrap max-w-[280px] truncate"
                    title={s}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Pause overlay */}
          {isPaused && (
            <div className="shrink-0 border-t border-amber-200 px-4 py-4 bg-amber-50">
              <div className="flex items-center justify-center gap-2 text-sm text-amber-700 mb-3">
                <Pause className="w-4 h-4" />
                Show paused — click <button onClick={togglePause} className="font-medium underline hover:text-amber-900">Resume</button> to continue
              </div>
              <div className="flex items-center justify-center gap-6 text-xs text-amber-600">
                <span>🎬 <span className="font-medium">{messages.filter(m => m.role === 'host').length}</span> host replies</span>
                <span>💬 <span className="font-medium">{messages.filter(m => m.role === 'guest').length}</span> guest replies</span>
                {messages.filter(m => m.role === 'host').slice(-1)[0] && (
                  <span className="max-w-[300px] truncate" title={messages.filter(m => m.role === 'host').slice(-1)[0].content}>
                    📌 Last: {messages.filter(m => m.role === 'host').slice(-1)[0].content.slice(0, 60)}...
                  </span>
                )}
              </div>
            </div>
          )}
          {!isPaused && (
          <div className="shrink-0 border-t border-gray-200 px-4 py-3 bg-white">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Reply as ${guestName}...`}
                disabled={isWaiting || isPaused}
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-gray-400 disabled:bg-gray-50 disabled:text-gray-400"
              />
              <div className="relative">
                {voiceRecording && (
                  <div className="absolute inset-0 rounded-full animate-ping bg-red-400/30" />
                )}
                <button
                  type="button"
                  onClick={() => { if (voiceRecording) voiceStopRecording(); else voiceStartRecording(); }}
                  disabled={isWaiting || isPaused}
                  className={`p-2.5 rounded-xl transition-colors ${
                    voiceRecording
                      ? 'bg-red-500 text-white animate-pulse'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  } disabled:opacity-40 disabled:cursor-not-allowed`}
                  title={voiceRecording ? 'Tap to stop' : 'Tap to speak'}
                >
                  <Mic className="w-4 h-4" />
                </button>
              </div>
              <button
                onClick={handleSend}
                disabled={!input.trim() || isWaiting || isPaused}
                className="p-2.5 bg-gray-900 text-white rounded-xl hover:bg-gray-800 disabled:bg-gray-200 disabled:text-gray-400 transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
          )}
        </div>
      </div>
    </div>
  );
}
