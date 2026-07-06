"use client";

import React, { useState, useEffect, useRef, useCallback, useContext } from 'react';
import { X, Send, Volume2, Clock, Target, ChevronRight, Mic, Square } from 'lucide-react';
import { sendMeetingMessage } from '@/services/adk-assistant.service';
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

export default function MeetingMode({ config, onEnd }: MeetingModeProps) {
  const { selectedLanguage } = useContext(VoiceAssistantContext);
  const [messages, setMessages] = useState<MeetingMessage[]>([]);
  const [input, setInput] = useState('');
  const [isWaiting, setIsWaiting] = useState(false);
  const [currentItemIdx, setCurrentItemIdx] = useState(0);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const messagesRef = useRef<MeetingMessage[]>([]);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isPausedRef = useRef(false);

  useEffect(() => { messagesRef.current = messages; }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Timer countdown per agenda item
  useEffect(() => {
    if (currentItemIdx >= config.agenda.length) return;
    const item = config.agenda[currentItemIdx];
    const totalSec = item.durationMinutes * 60;
    setTimerSeconds(totalSec);
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    timerIntervalRef.current = setInterval(() => {
      setTimerSeconds(prev => {
        if (prev <= 1) {
          if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
          return 0;
        }
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

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isWaiting) return;
    setInput('');

    const userMsg: MeetingMessage = { role: 'participant', content: text, author: 'You' };
    const updated = [...messagesRef.current, userMsg];
    setMessages(updated);

    const reply = await callHost(updated, text);
    const hostMsg: MeetingMessage = { role: 'host', content: reply, author: 'Meeting Host' };
    const final = [...updated, hostMsg];
    setMessages(final);

    // Auto-advance agenda after ~3 host responses per item
    const hostCount = final.filter(m => m.role === 'host').length;
    const newIdx = Math.min(Math.floor(hostCount / 3), config.agenda.length - 1);
    setCurrentItemIdx(newIdx);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
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
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              // Generate meeting summary
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
            onClick={onEnd}
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
                  <div
                    key={item.id}
                    className={`flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs transition-all ${
                      active
                        ? 'bg-[var(--md-tertiary)]/10 border border-[var(--md-tertiary)]/20'
                        : done
                        ? 'text-gray-400'
                        : 'text-gray-600'
                    }`}
                  >
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                      done ? 'bg-green-100 text-green-600' :
                      active ? 'bg-[var(--md-tertiary)] text-white' :
                      'bg-gray-200 text-gray-500'
                    }`}>
                      {done ? '✓' : idx + 1}
                    </span>
                    <span className={`flex-1 truncate ${done ? 'line-through' : ''}`}>
                      {item.title}
                    </span>
                    <span className="text-[10px] opacity-60">{item.durationMinutes}m</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Timer */}
          <div className="px-3 py-3 border-b border-gray-200">
            <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">Timer</div>
            <div className={`text-center py-3 rounded-lg text-lg font-bold font-mono ${
              timerCritical ? 'text-red-600 bg-red-50' :
              timerWarning ? 'text-amber-600 bg-amber-50' :
              'text-gray-700 bg-white'
            }`}>
              <Clock className="w-4 h-4 inline mr-1" />
              {formatTime(timerSeconds)}
            </div>
          </div>

          {/* Participants */}
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
              <div className="text-center text-sm text-gray-400 py-12">
                Meeting Host is opening the meeting...
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'participant' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    msg.role === 'participant'
                      ? 'bg-gray-900 text-white rounded-br-md'
                      : 'bg-gray-100 text-gray-800 rounded-bl-md'
                  }`}
                >
                  <span className={`text-xs font-semibold block mb-1 ${
                    msg.role === 'participant' ? 'text-gray-400' : 'text-[var(--md-tertiary)]'
                  }`}>
                    {msg.author}
                  </span>
                  <span className="whitespace-pre-wrap">{msg.content}</span>
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
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your response..."
                disabled={isWaiting}
                className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-gray-400 disabled:bg-gray-50 disabled:text-gray-400"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isWaiting}
                className="p-2.5 rounded-xl bg-gray-900 text-white hover:bg-gray-800 disabled:bg-gray-200 disabled:text-gray-400 transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
