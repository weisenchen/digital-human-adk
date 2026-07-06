"use client";

import React, { useState } from 'react';
import { X, Mic, FileText, Clock, Trophy } from 'lucide-react';

type ToastmasterMode = 'table_topics' | 'prepared_speech';

const MODE_OPTIONS = [
  {
    id: 'table_topics' as const,
    icon: Mic,
    title: 'Table Topics',
    description:
      'AI gives you a random topic. You speak for 1-2 minutes. AI evaluates with scores and feedback.',
  },
  {
    id: 'prepared_speech' as const,
    icon: FileText,
    title: 'Speech Evaluation',
    description:
      'Submit your prepared speech text. AI evaluates with structured scoring and recommendations.',
  },
] as const;

const TIME_OPTIONS = [
  { value: 60, label: '1 min' },
  { value: 90, label: '1:30 min' },
  { value: 120, label: '2 min' },
  { value: 180, label: '3 min' },
] as const;

export interface ToastmasterConfig {
  mode: ToastmasterMode;
  timeSeconds: number;
  language: string;
  rounds: number;
}

interface ToastmasterSetupProps {
  onStart: (config: ToastmasterConfig) => void;
  onClose: () => void;
}

export default function ToastmasterSetup({ onStart, onClose }: ToastmasterSetupProps) {
  const [mode, setMode] = useState<ToastmasterMode>('table_topics');
  const [timeSeconds, setTimeSeconds] = useState(120);
  const [language, setLanguage] = useState('en');
  const [rounds, setRounds] = useState(3);

  const handleStart = () => {
    onStart({ mode, timeSeconds, language, rounds });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-[520px] max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-500" />
            <h2 className="text-lg font-semibold text-gray-900">Toastmaster Training</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <p className="text-sm text-gray-500 mb-5">
            Improve your public speaking skills with Toastmasters-style training and AI evaluation.
          </p>

          {/* Mode Selection */}
          <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
            Training Mode
          </label>
          <div className="space-y-2 mb-5">
            {MODE_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const isSelected = mode === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => setMode(opt.id)}
                  className={`w-full text-left p-3.5 rounded-xl border-2 transition-all ${
                    isSelected
                      ? 'border-amber-500 bg-amber-50 shadow-sm'
                      : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${
                        isSelected ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      <Icon className="w-4.5 h-4.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm font-semibold ${isSelected ? 'text-gray-900' : 'text-gray-800'}`}>
                        {opt.title}
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                        {opt.description}
                      </div>
                    </div>
                    <div className={`flex-shrink-0 w-4.5 h-4.5 rounded-full border-2 flex items-center justify-center mt-1 ${
                      isSelected ? 'border-amber-500' : 'border-gray-300'
                    }`}>
                      {isSelected && <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Speaking Time */}
          <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
            <Clock className="w-3.5 h-3.5 inline mr-1" />
            Speaking Time (Table Topics)
          </label>
          <div className="flex gap-2 mb-5">
            {TIME_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setTimeSeconds(opt.value)}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  timeSeconds === opt.value
                    ? 'bg-amber-500 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Rounds */}
          <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
            Number of Rounds
          </label>
          <div className="flex gap-2 mb-5">
            {[1, 3, 5].map((n) => (
              <button
                key={n}
                onClick={() => setRounds(n)}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  rounds === n
                    ? 'bg-amber-500 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {n} {n === 1 ? 'round' : 'rounds'}
              </button>
            ))}
          </div>

          {/* Language */}
          <label className="block text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">
            Evaluation Language
          </label>
          <div className="flex gap-2">
            <button
              onClick={() => setLanguage('en')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                language === 'en'
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              English
            </button>
            <button
              onClick={() => setLanguage('zh')}
              className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                language === 'zh'
                  ? 'bg-amber-500 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Chinese
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleStart}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium bg-amber-500 text-white hover:bg-amber-600 shadow-sm transition-all"
          >
            <Trophy className="w-4 h-4" />
            Start Training
          </button>
        </div>
      </div>
    </div>
  );
}
