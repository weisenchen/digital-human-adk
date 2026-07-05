"use client";

import React, { useState } from 'react';
import { X, Play, FileText } from 'lucide-react';

interface TalkShowConfig {
  topic: string;
  guestName: string;
  hostName: string;
  background: string;
  questions: string;
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

  const canStart = topic.trim() || guestName.trim() || background.trim();

  const handleStart = () => {
    onStart({
      topic: topic.trim(),
      guestName: guestName.trim() || 'Guest',
      hostName: hostName.trim() || defaultHostName || 'Toxo',
      background: background.trim(),
      questions: questions.trim(),
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

          {/* Background Materials */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Background Materials
              <span className="text-gray-400 font-normal ml-1">(paste articles, notes, context)</span>
            </label>
            <textarea
              value={background}
              onChange={(e) => setBackground(e.target.value)}
              placeholder="Paste your background research, articles, or key points here..."
              rows={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-gray-400 resize-none"
            />
          </div>

          {/* Interview Questions */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Interview Questions / Outline
              <span className="text-gray-400 font-normal ml-1">(optional)</span>
            </label>
            <textarea
              value={questions}
              onChange={(e) => setQuestions(e.target.value)}
              placeholder="List your questions or outline for the interview..."
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-gray-400 resize-none"
            />
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
