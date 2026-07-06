"use client";

import React, { useState } from 'react';
import { X, Play, Plus, Trash2, GripVertical } from 'lucide-react';

interface AgendaItem {
  id: string;
  title: string;
  durationMinutes: number;
}

interface Participant {
  id: string;
  name: string;
  role: string;
}

const RESPONSE_TIME_OPTIONS = [
  { value: 20, label: '20s' },
  { value: 30, label: '30s' },
  { value: 60, label: '60s' },
  { value: 90, label: '90s' },
  { value: 120, label: '120s' },
  { value: 0, label: 'Unlimited' },
] as const;

export interface MeetingConfig {
  title: string;
  agenda: AgendaItem[];
  participants: Participant[];
  background: string;
  responseTimeSeconds: number;
}

interface MeetingSetupProps {
  onStart: (config: MeetingConfig) => void;
  onClose: () => void;
}

let _id = 0;
const uid = () => `m${++_id}`;

export default function MeetingSetup({ onStart, onClose }: MeetingSetupProps) {
  const [title, setTitle] = useState('');
  const [agenda, setAgenda] = useState<AgendaItem[]>([
    { id: uid(), title: 'Opening', durationMinutes: 2 },
    { id: uid(), title: 'Main Discussion', durationMinutes: 15 },
    { id: uid(), title: 'Action Items & Close', durationMinutes: 3 },
  ]);
  const [participants, setParticipants] = useState<Participant[]>([
    { id: uid(), name: '', role: '' },
  ]);
  const [background, setBackground] = useState('');
  const [responseTime, setResponseTime] = useState(60);

  const totalTime = agenda.reduce((sum, a) => sum + a.durationMinutes, 0);

  const addAgendaItem = () => {
    setAgenda(prev => [...prev, { id: uid(), title: '', durationMinutes: 5 }]);
  };

  const updateAgenda = (id: string, field: keyof AgendaItem, value: string | number) => {
    setAgenda(prev => prev.map(a => a.id === id ? { ...a, [field]: value } : a));
  };

  const removeAgenda = (id: string) => {
    setAgenda(prev => prev.filter(a => a.id !== id));
  };

  const addParticipant = () => {
    setParticipants(prev => [...prev, { id: uid(), name: '', role: '' }]);
  };

  const updateParticipant = (id: string, field: keyof Participant, value: string) => {
    setParticipants(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const removeParticipant = (id: string) => {
    setParticipants(prev => prev.filter(p => p.id !== id));
  };

  const canStart = title.trim() && agenda.some(a => a.title.trim()) && participants.some(p => p.name.trim());

  const handleStart = () => {
    onStart({
      title: title.trim(),
      agenda: agenda.filter(a => a.title.trim()).map(a => ({ ...a, title: a.title.trim() })),
      participants: participants.filter(p => p.name.trim()).map(p => ({ ...p, name: p.name.trim(), role: p.role.trim() })),
      background: background.trim(),
      responseTimeSeconds: responseTime,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-[640px] max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <span className="text-lg">🎯</span>
            <h2 className="text-lg font-semibold text-gray-900">New Meeting</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Meeting Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Meeting Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Sprint Review, Brainstorm Session..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-gray-400"
            />
          </div>

          {/* Agenda */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-sm font-medium text-gray-700">Agenda Items</label>
              <span className="text-xs text-gray-400">Total: {totalTime} min</span>
            </div>
            <div className="space-y-2">
              {agenda.map((item, idx) => (
                <div key={item.id} className="flex items-center gap-2">
                  <GripVertical className="w-4 h-4 text-gray-300 flex-shrink-0" />
                  <span className="text-xs text-gray-400 w-5 flex-shrink-0">{idx + 1}.</span>
                  <input
                    type="text"
                    value={item.title}
                    onChange={(e) => updateAgenda(item.id, 'title', e.target.value)}
                    placeholder="Item title"
                    className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-gray-400"
                  />
                  <input
                    type="number"
                    min={1}
                    max={60}
                    value={item.durationMinutes}
                    onChange={(e) => updateAgenda(item.id, 'durationMinutes', Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-16 px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-gray-400"
                  />
                  <span className="text-xs text-gray-400 w-8">min</span>
                  {agenda.length > 1 && (
                    <button onClick={() => removeAgenda(item.id)} className="p-1 rounded hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={addAgendaItem}
              className="mt-2 flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Add Item
            </button>
          </div>

          {/* Participants */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Participants</label>
            <div className="space-y-2">
              {participants.map((p) => (
                <div key={p.id} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={p.name}
                    onChange={(e) => updateParticipant(p.id, 'name', e.target.value)}
                    placeholder="Name"
                    className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-gray-400"
                  />
                  <input
                    type="text"
                    value={p.role}
                    onChange={(e) => updateParticipant(p.id, 'role', e.target.value)}
                    placeholder="Role (optional)"
                    className="w-36 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-gray-400"
                  />
                  {participants.length > 1 && (
                    <button onClick={() => removeParticipant(p.id)} className="p-1 rounded hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={addParticipant}
              className="mt-2 flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Add Participant
            </button>
          </div>

          {/* Background Materials */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Background Materials
              <span className="text-gray-400 font-normal ml-1">(optional topic research)</span>
            </label>
            <textarea
              value={background}
              onChange={(e) => setBackground(e.target.value)}
              placeholder="Paste any reference material, data, or context the host should reference..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-gray-400 resize-none"
            />
          </div>

          {/* Response Time */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Response Time</label>
            <p className="text-xs text-gray-400 mb-2">How long the mic stays open after the host asks a question</p>
            <div className="flex flex-wrap gap-2">
              {RESPONSE_TIME_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setResponseTime(opt.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    responseTime === opt.value
                      ? 'bg-[var(--md-tertiary)] text-white shadow-sm'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
          <span className="text-xs text-gray-400">Participants will speak in real-time during the meeting</span>
          <button
            onClick={handleStart}
            disabled={!canStart}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
              canStart
                ? 'bg-[var(--md-tertiary)] text-white hover:bg-[var(--md-tertiary)]/90 shadow-sm'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            <Play className="w-4 h-4" />
            Start Meeting
          </button>
        </div>
      </div>
    </div>
  );
}
