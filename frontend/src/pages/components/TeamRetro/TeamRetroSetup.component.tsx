"use client";

import React, { useState } from 'react';
import { X, Eye, Users, Vote, Sparkles } from 'lucide-react';

export interface TeamRetroConfig {
  sessionId: string;
  name: string;
  participants: string[];
  votesPerPerson: number;
  language: string;
}

interface TeamRetroSetupProps {
  onStart: (config: TeamRetroConfig) => void;
  onClose: () => void;
}

export default function TeamRetroSetup({ onStart, onClose }: TeamRetroSetupProps) {
  const [name, setName] = useState('Sprint Retro');
  const [participantInput, setParticipantInput] = useState('');
  const [participants, setParticipants] = useState<string[]>([]);
  const [votesPerPerson, setVotesPerPerson] = useState(5);
  const [language, setLanguage] = useState('en');

  const addParticipant = () => {
    const name = participantInput.trim();
    if (name && !participants.includes(name)) {
      setParticipants(prev => [...prev, name]);
      setParticipantInput('');
    }
  };

  const removeParticipant = (idx: number) => {
    setParticipants(prev => prev.filter((_, i) => i !== idx));
  };

  const handleParticipantKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addParticipant();
    }
  };

  const handleStart = () => {
    const sessionId = `retro_${Date.now()}`;
    onStart({ sessionId, name, participants, votesPerPerson, language });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-[520px] max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-violet-500" />
            <h2 className="text-lg font-semibold text-gray-900">Team Retro Perspective</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Session Name */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wide">
              Session Name
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Sprint 25 Retro"
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            />
          </div>

          {/* Participants */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wide">
              <Users className="w-3.5 h-3.5 inline mr-1" />
              Participants
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={participantInput}
                onChange={e => setParticipantInput(e.target.value)}
                onKeyDown={handleParticipantKeyDown}
                placeholder="Type name and press Enter"
                className="flex-1 px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              />
              <button
                onClick={addParticipant}
                disabled={!participantInput.trim()}
                className="px-4 py-2.5 rounded-xl text-sm font-medium bg-violet-500 text-white hover:bg-violet-600 disabled:bg-gray-100 disabled:text-gray-400 transition-all"
              >
                Add
              </button>
            </div>
            {participants.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {participants.map((p, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-violet-50 text-violet-700 text-xs font-medium"
                  >
                    {p}
                    <button onClick={() => removeParticipant(i)} className="text-violet-400 hover:text-violet-600">×</button>
                  </span>
                ))}
              </div>
            )}
            {participants.length === 0 && (
              <p className="text-xs text-gray-400">Add team members who will participate</p>
            )}
          </div>

          {/* Votes per Person */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wide">
              <Vote className="w-3.5 h-3.5 inline mr-1" />
              Votes per Person
            </label>
            <div className="flex gap-2">
              {[3, 5, 10].map(n => (
                <button
                  key={n}
                  onClick={() => setVotesPerPerson(n)}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    votesPerPerson === n
                      ? 'bg-violet-500 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {n} votes
                </button>
              ))}
            </div>
          </div>

          {/* Language */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wide">
              Summary Language
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setLanguage('en')}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  language === 'en' ? 'bg-violet-500 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                English
              </button>
              <button
                onClick={() => setLanguage('zh')}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  language === 'zh' ? 'bg-violet-500 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Chinese
              </button>
              <button
                onClick={() => setLanguage('ko')}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  language === 'ko' ? 'bg-violet-500 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                한국어
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleStart}
            disabled={!name.trim()}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium bg-violet-500 text-white hover:bg-violet-600 disabled:bg-gray-100 disabled:text-gray-400 shadow-sm transition-all"
          >
            <Sparkles className="w-4 h-4" />
            Start Retro
          </button>
        </div>
      </div>
    </div>
  );
}
