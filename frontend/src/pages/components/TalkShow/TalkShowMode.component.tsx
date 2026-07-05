"use client";

import { useState, useEffect, useRef, useCallback, useContext } from 'react';
import { X, Send, Volume2, Pause, Play } from 'lucide-react';
import DigitalHumanContainer from '../DigitalHumanContainer/DigitalHumanContainer.component';
import { sendTalkShowMessage, getAIAudioFromText } from '@/services/adk-assistant.service';
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
  onEnd: () => void;
}

export default function TalkShowMode({
  topic,
  guestName,
  hostName,
  background,
  questions,
  personality,
  onEnd,
}: TalkShowModeProps) {
  const { selectedLanguage, setMouthOpen } = useContext(VoiceAssistantContext);
  const [messages, setMessages] = useState<TalkShowMessage[]>([]);
  const [input, setInput] = useState('');
  const [isWaiting, setIsWaiting] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const rafIdRef = useRef<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const messagesRef = useRef<TalkShowMessage[]>([]);

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

  const togglePause = useCallback(() => {
    setIsPaused(prev => {
      if (!prev) {
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

  // Start the show: generate opening
  const startShow = useCallback(async () => {
    setIsWaiting(true);
    try {
      const reply = await sendTalkShowMessage({
        topic,
        guestName,
        hostName,
        background,
        questions,
        personality,
        message: '',
        history: [],
        language: 'en',
      });
      const hostMsg: TalkShowMessage = { role: 'host', content: reply };
      setMessages([hostMsg]);
    } catch (err) {
      console.error('Talk show start error:', err);
      setMessages([{ role: 'host', content: `(Error starting the show: ${err})` }]);
    } finally {
      setIsWaiting(false);
    }
  }, [topic, guestName, hostName, background, questions, personality]);

  useEffect(() => {
    startShow();
    return () => stopSpeaking();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isWaiting || isPaused) return;
    setInput('');

    const guestMsg: TalkShowMessage = { role: 'guest', content: text };
    const updated = [...messagesRef.current, guestMsg];
    setMessages(updated);
    setIsWaiting(true);

    try {
      const history = updated.map(m => ({ role: m.role, content: m.content }));
      const reply = await sendTalkShowMessage({
        topic,
        guestName,
        hostName,
        background,
        questions,
        personality,
        message: text,
        history,
        language: 'en',
      });
      const hostMsg: TalkShowMessage = { role: 'host', content: reply };
      setMessages(prev => [...prev, hostMsg]);
    } catch (err) {
      console.error('Talk show ask error:', err);
      setMessages(prev => [...prev, { role: 'host', content: '(Error getting response)' }]);
    } finally {
      setIsWaiting(false);
    }
  }, [input, isWaiting, topic, guestName, hostName, background, questions, personality, isPaused]);

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

          {/* Input bar */}
          {isPaused && (
            <div className="shrink-0 border-t border-amber-200 px-4 py-3 bg-amber-50">
              <div className="flex items-center justify-center gap-2 text-sm text-amber-700">
                <Pause className="w-4 h-4" />
                Show paused — click <button onClick={togglePause} className="font-medium underline hover:text-amber-900">Resume</button> to continue
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
