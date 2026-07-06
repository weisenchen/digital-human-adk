"use client";

import React, { useState } from 'react';
import { X, Play, FileText } from 'lucide-react';

const PERSONALITY_PRESETS = [
  { id: 'professional-humorous', label: 'Professional + Humorous', desc: 'Witty yet polished — like a late-night talk show host' },
  { id: 'professional', label: 'Professional', desc: 'Formal, serious, and business-like' },
  { id: 'humorous', label: 'Humorous', desc: 'Lighthearted, funny, and playful' },
  { id: 'friendly', label: 'Friendly', desc: 'Warm, approachable, and casual' },
  { id: 'intellectual', label: 'Intellectual', desc: 'Deep, thoughtful, and insightful' },
] as const;

interface TalkShowConfig {
  topic: string;
  guestName: string;
  hostName: string;
  background: string;
  questions: string;
  personality: string;
  durationMinutes: number;
}

interface TalkShowSetupProps {
  defaultHostName: string;
  onStart: (config: TalkShowConfig) => void;
  onClose: () => void;
}

export default function TalkShowSetup({ defaultHostName, onStart, onClose }: TalkShowSetupProps) {
  const [topic, setTopic] = useState('');
  const [guestName, setGuestName] = useState('');
  const [hostName, setHostName] = useState(defaultHostName || 'Toxo');
  const [background, setBackground] = useState('');
  const [questions, setQuestions] = useState('');
  const [personality, setPersonality] = useState('professional-humorous');
  const [customPersonality, setCustomPersonality] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(10);

  const canStart = topic.trim() || guestName.trim() || background.trim();

  const handleStart = () => {
    onStart({
      topic: topic.trim(),
      guestName: guestName.trim() || 'Guest',
      hostName: hostName.trim() || defaultHostName || 'Toxo',
      background: background.trim(),
      questions: questions.trim(),
      personality: personality === 'custom' ? customPersonality.trim() : personality,
      durationMinutes,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-[560px] max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">New Talk Show</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Topic */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Topic / Theme</label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g., The Future of AI in Healthcare"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-gray-400"
            />
          </div>

          {/* Guest Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Guest Name</label>
            <input
              type="text"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder="Who are you interviewing?"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-gray-400"
            />
          </div>

          {/* Host Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Host Name</label>
            <input
              type="text"
              value={hostName}
              onChange={(e) => setHostName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-gray-400"
            />
          </div>

          {/* Host Style */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Host Style</label>
            <div className="grid grid-cols-2 gap-2">
              {PERSONALITY_PRESETS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPersonality(p.id)}
                  className={`text-left p-2.5 rounded-lg border text-sm transition-all ${
                    personality === p.id
                      ? 'bg-gray-900 text-white border-gray-900 shadow-sm'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className={`text-xs font-medium ${personality === p.id ? 'text-white' : 'text-gray-900'}`}>
                    {p.label}
                  </div>
                  <div className={`text-[10px] mt-0.5 ${personality === p.id ? 'text-gray-300' : 'text-gray-400'}`}>
                    {p.desc}
                  </div>
                </button>
              ))}
            </div>
            {/* Custom */}
            <button
              onClick={() => setPersonality('custom')}
              className={`w-full text-left p-2.5 rounded-lg border text-sm transition-all mt-2 ${
                personality === 'custom'
                  ? 'bg-gray-900 text-white border-gray-900 shadow-sm'
                  : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <div className={`text-xs font-medium ${personality === 'custom' ? 'text-white' : 'text-gray-900'}`}>
                Custom
              </div>
              <div className={`text-[10px] mt-0.5 ${personality === 'custom' ? 'text-gray-300' : 'text-gray-400'}`}>
                Write your own style description
              </div>
            </button>
            {personality === 'custom' && (
              <input
                type="text"
                value={customPersonality}
                onChange={(e) => setCustomPersonality(e.target.value)}
                placeholder="e.g., Sarcastic but caring, like a British butler"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-gray-400 mt-2"
              />
            )}
          </div>

          {/* Background Materials */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Background Materials
              <span className="text-gray-400 font-normal ml-1">(topic research)</span>
            </label>
            <textarea
              value={background}
              onChange={(e) => setBackground(e.target.value)}
              placeholder="Paste articles, data, key facts, or research about the topic — the host will reference these during the show..."
              rows={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-gray-400 resize-none"
            />
          </div>

          {/* Interview Questions */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Interview Questions / Outline
              <span className="text-[var(--md-tertiary)] font-normal ml-1">(required)</span>
            </label>
            <textarea
              value={questions}
              onChange={(e) => setQuestions(e.target.value)}
              placeholder="List your questions or outline for the interview..."
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-gray-400 resize-none"
            />
          </div>

          {/* Duration */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Show Duration</label>
            <div className="flex gap-2">
              {[5, 10, 15, 30].map((m) => (
                <button
                  key={m}
                  onClick={() => setDurationMinutes(m)}
                  className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-all ${
                    durationMinutes === m
                      ? 'bg-gray-900 text-white border-gray-900 shadow-sm'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {m} min
                </button>
              ))}
            </div>
            <p className="text-[11px] text-gray-400 mt-1">
              Opening &amp; Warm-up will be brief. Most time goes to Discussion.
            </p>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end">
          <button
            onClick={handleStart}
            disabled={!canStart}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
              canStart
                ? 'bg-gray-900 text-white hover:bg-gray-800 shadow-sm'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            <Play className="w-4 h-4" />
            Start Show
          </button>
        </div>
      </div>
    </div>
  );
}
