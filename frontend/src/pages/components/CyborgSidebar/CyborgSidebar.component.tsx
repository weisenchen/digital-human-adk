"use client";

import React, { useState, useContext } from 'react';
import { X, MessageSquarePlus, FileText, Sparkles, Loader2, Plus, Minus, Brain, BookOpen } from 'lucide-react';
import CharacterSelector from '../CharacterSelector/CharacterSelector.component';
import VoiceAssistantContext from '../../context/VoiceAssistantContext';
import { generateSlides, SlideData } from '@/services/adk-assistant.service';

interface CyborgSidebarProps {
  onClose: () => void;
  characterName?: string;
  voiceId?: string;
  language?: string;
  onOpenPresentation?: (slides: SlideData[], totalMinutes: number) => void;
}

export default function CyborgSidebar({ onClose, characterName, voiceId, language, onOpenPresentation }: CyborgSidebarProps) {
  const context = useContext(VoiceAssistantContext);

  // Read Script state
  const [script, setScript] = useState('');
  const [numSlides, setNumSlides] = useState(5);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState('');
  const [totalMinutes, setTotalMinutes] = useState(10);

  const adjustNumSlides = (delta: number) => {
    setNumSlides((n) => Math.max(1, Math.min(20, n + delta)));
  };

  const handleNewConversation = () => {
    window.dispatchEvent(new CustomEvent('new-conversation'));
  };

  const handleAIGenerate = async () => {
    if (!script.trim()) return;
    setIsGenerating(true);
    setGenerationError('');
    try {
      const slides = await generateSlides(script.trim(), language || 'en', numSlides);
      setIsGenerating(false);
      if (slides && slides.length > 0) {
        if (onOpenPresentation) {
          onOpenPresentation(slides, totalMinutes);
        }
      } else {
        setGenerationError('AI returned no slides. Try a different script.');
      }
    } catch (err: any) {
      setIsGenerating(false);
      setGenerationError(err?.message || 'Failed to generate slides');
    }
  };

  return (
    <aside className="w-[280px] flex-shrink-0 bg-white border-r border-gray-200 flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 sticky top-0 bg-white z-10">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">Cyborg</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 p-3 space-y-4">
        {/* ── New Conversation ── */}
        <button
          onClick={handleNewConversation}
          className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 rounded-lg border border-gray-200 transition-colors"
        >
          <MessageSquarePlus className="w-4 h-4 text-gray-400" />
          New Conversation
        </button>

        {/* ── Read Script ── */}
        <div className="border-t border-gray-100 pt-3">
          <div className="flex items-center gap-2 mb-2">
            <FileText className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Read Script</span>
          </div>

          <textarea
            value={script}
            onChange={(e) => setScript(e.target.value)}
            placeholder="Paste your script here..."
            className="w-full h-32 p-3 text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded-lg resize-y focus:outline-none focus:border-gray-400 transition-colors font-mono leading-relaxed"
            spellCheck={false}
          />

          {/* Slide count + Generate */}
          <div className="flex items-center gap-2 mt-2">
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => adjustNumSlides(-1)}
                disabled={isGenerating}
                className="p-0.5 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 disabled:opacity-30"
              >
                <Minus className="w-3 h-3" />
              </button>
              <span className="text-xs text-gray-500 min-w-[1rem] text-center">{numSlides}</span>
              <button
                onClick={() => adjustNumSlides(1)}
                disabled={isGenerating}
                className="p-0.5 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 disabled:opacity-30"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>

            <button
              onClick={handleAIGenerate}
              disabled={isGenerating || !script.trim()}
              className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 text-white hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              {isGenerating ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Sparkles className="w-3 h-3" />
              )}
              {isGenerating ? '...' : 'Generate'}
            </button>
          </div>

          {/* Error */}
          {generationError && (
            <div className="mt-1 text-xs text-red-500">{generationError}</div>
          )}

          {/* Timer */}
          <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
            <span>Duration:</span>
            <button
              onClick={() => setTotalMinutes(Math.max(1, totalMinutes - 1))}
              className="p-0.5 rounded text-gray-400 hover:text-gray-600"
            >
              <Minus className="w-3 h-3" />
            </button>
            <span className="min-w-[1rem] text-center">{totalMinutes}</span>
            <button
              onClick={() => setTotalMinutes(Math.min(60, totalMinutes + 1))}
              className="p-0.5 rounded text-gray-400 hover:text-gray-600"
            >
              <Plus className="w-3 h-3" />
            </button>
            <span>min</span>
          </div>
        </div>

        {/* ── Settings ── */}
        <div className="border-t border-gray-100 pt-3">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Settings</span>
          </div>

          <CharacterSelector />

          <div className="mt-3 border-t border-gray-100 pt-3">
            <div className="flex items-center gap-2 mb-2">
              <Brain className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Model</span>
            </div>

            {context.models && context.models.length > 0 ? (
              <div className="space-y-1 max-h-[180px] overflow-y-auto pr-1">
                {context.models.map((m: any) => {
                  const isSelected = context.selectedModel === m.id;
                  return (
                    <label
                      key={m.id}
                      className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all border ${
                        isSelected
                          ? 'bg-white border-gray-300 shadow-sm'
                          : 'border-transparent hover:bg-gray-50 hover:border-gray-200'
                      } ${!m.available ? 'opacity-40 cursor-not-allowed' : ''}`}
                    >
                      <input
                        type="radio"
                        name="model"
                        value={m.id}
                        checked={isSelected}
                        disabled={!m.available}
                        onChange={() => context.handleModelSelect(m.id)}
                        className="accent-gray-900 w-3 h-3 flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-gray-900 truncate">{m.name}</div>
                        <div className="text-[10px] text-gray-400 truncate">{m.provider}</div>
                      </div>
                    </label>
                  );
                })}
              </div>
            ) : (
              <div className="text-xs text-gray-400 text-center py-2">No models available</div>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}
