"use client";

import React, { useState } from 'react';
import { X, Presentation, Briefcase } from 'lucide-react';

export interface SlideData {
  display: string;
  speech: string;
}

export interface WorkReportConfig {
  mode: 'work-report';
  personality: string;
  background: string;
  presetQuestions: string[];
  slideMethod: 'upload' | 'ai-generate';
  uploadedSlides?: SlideData[];
  slideOutline?: string;
  totalMinutes: number;
  reportToRole: string;
}

interface PresentationSetupProps {
  onStartWorkReport: () => void;
  onStartClassic: () => void;
  onClose: () => void;
}

type SelectedMode = 'work-report' | 'classic' | null;

const MODE_OPTIONS = [
  {
    id: 'work-report' as const,
    icon: Briefcase,
    title: 'Work Report',
    description:
      'AI local lead reports with slides. Configure personality, background materials, preset questions, and slide generation. You can set who to report to (e.g. CTO, Manager, Director).',
  },
  {
    id: 'classic' as const,
    icon: Presentation,
    title: 'Classic Presentation',
    description:
      'The original presentation mode. Paste your script, AI-generate slides, and present with auto-advance & TTS narration.',
  },
] as const;

export default function PresentationSetup({
  onStartWorkReport,
  onStartClassic,
  onClose,
}: PresentationSetupProps) {
  const [selectedMode, setSelectedMode] = useState<SelectedMode>(null);

  const handleContinue = () => {
    if (selectedMode === 'work-report') {
      onStartWorkReport();
    } else if (selectedMode === 'classic') {
      onStartClassic();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-[560px] max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Presentation className="w-5 h-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">New Presentation</h2>
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
            Choose a presentation mode to get started.
          </p>

          <div className="space-y-3">
            {MODE_OPTIONS.map((mode) => {
              const Icon = mode.icon;
              const isSelected = selectedMode === mode.id;
              return (
                <button
                  key={mode.id}
                  onClick={() => setSelectedMode(mode.id)}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                    isSelected
                      ? 'border-gray-900 bg-gray-50 shadow-sm'
                      : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${
                        isSelected ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div
                        className={`text-sm font-semibold ${
                          isSelected ? 'text-gray-900' : 'text-gray-800'
                        }`}
                      >
                        {mode.title}
                      </div>
                      <div className="text-xs text-gray-500 mt-1 leading-relaxed">
                        {mode.description}
                      </div>
                    </div>
                    {/* Radio indicator */}
                    <div
                      className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center mt-1 ${
                        isSelected ? 'border-gray-900' : 'border-gray-300'
                      }`}
                    >
                      {isSelected && (
                        <div className="w-2.5 h-2.5 rounded-full bg-gray-900" />
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
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
            onClick={handleContinue}
            disabled={!selectedMode}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
              selectedMode
                ? 'bg-gray-900 text-white hover:bg-gray-800 shadow-sm'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
