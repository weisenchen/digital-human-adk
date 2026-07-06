"use client";

import React, { useState } from 'react';
import { X, Play, Upload, FileText, Sparkles } from 'lucide-react';

const PERSONALITY_OPTIONS = [
  {
    id: 'data-driven',
    label: 'Data-Driven',
    desc: 'Focuses on metrics, KPIs, and quantitative results. Every claim backed by numbers.',
  },
  {
    id: 'engineering',
    label: 'Engineering',
    desc: 'Technical deep-dive. Emphasizes architecture, trade-offs, and system design decisions.',
  },
  {
    id: 'visionary',
    label: 'Visionary',
    desc: 'Big-picture thinker. Talks about product vision, market trends, and long-term strategy.',
  },
  {
    id: 'cautious',
    label: 'Cautious',
    desc: 'Risk-aware communicator. Highlights challenges, mitigation plans, and conservative forecasts.',
  },
  {
    id: 'results-driven',
    label: 'Results-Driven',
    desc: 'Execution-focused. Emphasizes shipped features, milestones achieved, and team velocity.',
  },
] as const;

const DURATION_OPTIONS = [15, 20, 30] as const;

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
  reportToRole: string;  // e.g. "CTO", "Manager", "Director"
}

interface WorkReportSetupProps {
  onStart: (config: WorkReportConfig) => void;
  onClose: () => void;
}

export default function WorkReportSetup({ onStart, onClose }: WorkReportSetupProps) {
  const [personality, setPersonality] = useState('data-driven');
  const [background, setBackground] = useState('');
  const [questions, setQuestions] = useState<string[]>(['', '', '']);
  const [slideMethod, setSlideMethod] = useState<'upload' | 'ai-generate'>('ai-generate');
  const [slideOutline, setSlideOutline] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [totalMinutes, setTotalMinutes] = useState(15);
  const [reportToRole, setReportToRole] = useState('CTO');

  const handleAddQuestion = () => {
    setQuestions((prev) => [...prev, '']);
  };

  const handleRemoveQuestion = (index: number) => {
    if (questions.length <= 2) return;
    setQuestions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleQuestionChange = (index: number, value: string) => {
    setQuestions((prev) => prev.map((q, i) => (i === index ? value : q)));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadedFileName(file.name);
    }
  };

  const canStart =
    (slideMethod === 'ai-generate' ? slideOutline.trim() : !!uploadedFileName) ||
    background.trim();

  const handleStart = () => {
    onStart({
      mode: 'work-report',
      personality,
      background: background.trim(),
      presetQuestions: questions.filter((q) => q.trim()),
      slideMethod,
      uploadedSlides: slideMethod === 'upload' ? [] : undefined,
      slideOutline: slideMethod === 'ai-generate' ? slideOutline.trim() : undefined,
      totalMinutes,
      reportToRole,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-[560px] max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">Work Report Setup</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* AI Personality */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              AI Personality
            </label>
            <div className="grid grid-cols-2 gap-2">
              {PERSONALITY_OPTIONS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPersonality(p.id)}
                  className={`text-left p-2.5 rounded-lg border text-sm transition-all ${
                    personality === p.id
                      ? 'bg-gray-900 text-white border-gray-900 shadow-sm'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div
                    className={`text-xs font-medium ${
                      personality === p.id ? 'text-white' : 'text-gray-900'
                    }`}
                  >
                    {p.label}
                  </div>
                  <div
                    className={`text-[10px] mt-0.5 ${
                      personality === p.id ? 'text-gray-300' : 'text-gray-400'
                    }`}
                  >
                    {p.desc}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Background Materials */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Background Materials
              <span className="text-gray-400 font-normal ml-1">
                (data & context — fills slide content with real facts)
              </span>
            </label>
            <textarea
              value={background}
              onChange={(e) => setBackground(e.target.value)}
              placeholder="Project timelines, team updates, blockers, achievements, or any context the CTO should know..."
              rows={5}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-gray-400 resize-none"
            />
          </div>

          {/* Preset Questions */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Preset Questions
              <span className="text-gray-400 font-normal ml-1">
                (questions the AI lead will ask the CTO)
              </span>
            </label>
            <div className="space-y-2">
              {questions.map((q, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={q}
                    onChange={(e) => handleQuestionChange(i, e.target.value)}
                    placeholder={`Question ${i + 1}...`}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-gray-400"
                  />
                  {questions.length > 2 && (
                    <button
                      onClick={() => handleRemoveQuestion(i)}
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="Remove question"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={handleAddQuestion}
              className="mt-2 text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1 transition-colors"
            >
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Add question
            </button>
          </div>

          {/* PPT Method */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Presentation Slides
            </label>
            <div className="flex gap-2 mb-3">
              <button
                onClick={() => setSlideMethod('ai-generate')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border text-sm font-medium transition-all ${
                  slideMethod === 'ai-generate'
                    ? 'bg-gray-900 text-white border-gray-900 shadow-sm'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                }`}
              >
                <Sparkles className="w-4 h-4" />
                AI Generate
              </button>
              <button
                onClick={() => setSlideMethod('upload')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg border text-sm font-medium transition-all ${
                  slideMethod === 'upload'
                    ? 'bg-gray-900 text-white border-gray-900 shadow-sm'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                }`}
              >
                <Upload className="w-4 h-4" />
                Upload HTML
              </button>
            </div>

            {slideMethod === 'ai-generate' ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Slide Outline
                  <span className="text-gray-400 font-normal ml-1">
                    (structure — defines what each slide covers)
                  </span>
                </label>
                <textarea
                value={slideOutline}
                onChange={(e) => setSlideOutline(e.target.value)}
                placeholder="Describe the slide outline. e.g.:
- Slide 1: Q2 Performance Metrics (revenue, NPS, velocity)
- Slide 2: Key Wins — shipping pipeline optimization
- Slide 3: Blockers & Risks — hiring freeze impact
- Slide 4: Next Quarter Roadmap"
                rows={6}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-gray-400 resize-none"
              />
              </div>
            ) : (
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                <input
                  type="file"
                  accept=".html,.htm"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="slide-upload"
                />
                <label
                  htmlFor="slide-upload"
                  className="cursor-pointer flex flex-col items-center gap-2"
                >
                  <Upload className="w-6 h-6 text-gray-400" />
                  <span className="text-sm text-gray-500">
                    {uploadedFileName
                      ? uploadedFileName
                      : 'Click to upload HTML slides'}
                  </span>
                  <span className="text-xs text-gray-400">.html files only</span>
                </label>
              </div>
            )}
          </div>

          {/* Duration */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Total Duration
            </label>
            <div className="flex gap-2">
              {DURATION_OPTIONS.map((m) => (
                <button
                  key={m}
                  onClick={() => setTotalMinutes(m)}
                  className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-all ${
                    totalMinutes === m
                      ? 'bg-gray-900 text-white border-gray-900 shadow-sm'
                      : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {m} min
                </button>
              ))}
            </div>
          </div>

          {/* Report To Role */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Report To (role / name)
            </label>
            <input
              type="text"
              value={reportToRole}
              onChange={(e) => setReportToRole(e.target.value)}
              placeholder="e.g. CTO, Manager, Director Chen"
              className="w-full px-3.5 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-gray-400"
            />
            <p className="text-xs text-gray-400 mt-1">The AI lead will address this person throughout the report</p>
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
            Start Work Report
          </button>
        </div>
      </div>
    </div>
  );
}
