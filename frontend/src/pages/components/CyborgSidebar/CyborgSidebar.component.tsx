"use client";

import React, { useState, useContext } from 'react';
import { X, MessageSquarePlus, FileText, Settings, Brain, ChevronDown, ChevronUp, History, Mic } from 'lucide-react';
import CharacterSelector from '../CharacterSelector/CharacterSelector.component';
import VoiceAssistantContext from '../../context/VoiceAssistantContext';

interface CyborgSidebarProps {
  onClose: () => void;
}

export default function CyborgSidebar({ onClose }: CyborgSidebarProps) {
  const context = useContext(VoiceAssistantContext);

  // Collapsible sections
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [modelOpen, setModelOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const handleNewConversation = () => {
    window.dispatchEvent(new CustomEvent('new-conversation'));
  };

  const handleReadScript = () => {
    window.dispatchEvent(new CustomEvent('open-presentation'));
  };

  const handleTalkShow = () => {
    window.dispatchEvent(new CustomEvent('open-talk-show'));
  };

  return (
    <aside className="w-[280px] flex-shrink-0 bg-white border-r border-[var(--md-outline)] flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-end px-4 py-3 border-b border-[var(--md-outline)] sticky top-0 bg-white z-10">
        <button
          onClick={onClose}
          className="state-layer p-1.5 rounded-[var(--shape-full)] text-[var(--md-on-surface-variant)] hover:bg-[var(--md-surface-variant)] transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 p-3 space-y-3 flex flex-col">
        {/* ── New Conversation ── */}
        <button
          onClick={handleNewConversation}
          className="w-full flex items-center gap-2 px-3 py-2.5 text-label-sm text-[var(--md-on-surface)] hover:bg-[var(--md-surface-variant)] rounded-[var(--shape-md)] border border-[var(--md-outline)] transition-colors"
        >
          <MessageSquarePlus className="w-4 h-4 text-[var(--md-tertiary)]" />
          <span>New Conversation</span>
        </button>

        {/* ── Presentation 演示 ── */}
        <button
          onClick={handleReadScript}
          className="w-full flex items-center gap-2 px-3 py-2.5 text-label-sm text-[var(--md-on-surface)] hover:bg-[var(--md-surface-variant)] rounded-[var(--shape-md)] border border-[var(--md-outline)] transition-colors"
        >
          <FileText className="w-4 h-4 text-[var(--md-tertiary)]" />
          <span>Presentation 演示</span>
        </button>

        {/* ── New Talk Show ── */}
        <button
          onClick={handleTalkShow}
          className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 rounded-lg border border-gray-200 transition-colors"
        >
          <Mic className="w-4 h-4 text-gray-400" />
          New Talk Show
        </button>

        {/* ── Settings (collapsible) ── */}
        <div className="border-t border-[var(--md-outline)] pt-3">
          <button
            onClick={() => setSettingsOpen(!settingsOpen)}
            className="w-full flex items-center justify-between gap-2 mb-1 px-1 py-1.5 rounded-[var(--shape-sm)] hover:bg-[var(--md-surface-variant)] transition-colors"
          >
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4 text-[var(--md-on-surface-variant)]" />
              <span className="text-label-sm text-[var(--md-on-surface)]">Settings</span>
            </div>
            {settingsOpen ? <ChevronUp className="w-3.5 h-3.5 text-[var(--md-on-surface-variant)]" /> : <ChevronDown className="w-3.5 h-3.5 text-[var(--md-on-surface-variant)]" />}
          </button>
          {settingsOpen && <CharacterSelector />}

          {/* ── Model (collapsible) ── */}
          <div className="mt-1">
            <button
              onClick={() => setModelOpen(!modelOpen)}
              className="w-full flex items-center justify-between gap-2 px-1 py-1.5 rounded-[var(--shape-sm)] hover:bg-[var(--md-surface-variant)] transition-colors"
            >
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-[var(--md-on-surface-variant)]" />
                <span className="text-label-sm text-[var(--md-on-surface)]">Model</span>
              </div>
              {modelOpen ? <ChevronUp className="w-3.5 h-3.5 text-[var(--md-on-surface-variant)]" /> : <ChevronDown className="w-3.5 h-3.5 text-[var(--md-on-surface-variant)]" />}
            </button>
            {modelOpen && (
              <div className="pt-1">
                {context.models && context.models.length > 0 ? (
                  <div className="space-y-1 max-h-[180px] overflow-y-auto custom-scrollbar pr-1">
                    {context.models.map((m: any) => {
                      const isSelected = context.selectedModel === m.id;
                      return (
                        <label
                          key={m.id}
                          className={`flex items-center gap-2 p-2 rounded-[var(--shape-md)] cursor-pointer transition-all border ${
                            isSelected
                              ? 'bg-white border-[var(--md-outline)] shadow-sm'
                              : 'border-transparent hover:bg-[var(--md-surface-variant)] hover:border-[var(--md-outline)]'
                          } ${!m.available ? 'opacity-40 cursor-not-allowed' : ''}`}
                        >
                          <input
                            type="radio"
                            name="model"
                            value={m.id}
                            checked={isSelected}
                            disabled={!m.available}
                            onChange={() => context.handleModelSelect(m.id)}
                            className="accent-[var(--md-tertiary)] w-3 h-3 flex-shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium text-[var(--md-on-surface)] truncate">{m.name}</div>
                            <div className="text-[10px] text-[var(--md-on-surface-variant)] truncate">{m.provider}</div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-label-xs text-[var(--md-on-surface-variant)] text-center py-3">No models available</div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Spacer to push Recent to bottom ── */}
        <div className="flex-1" />

        {/* ── Recent (collapsible history) at bottom ── */}
        <div className="border-t border-[var(--md-outline)] pt-3">
          <button
            onClick={() => setHistoryOpen(!historyOpen)}
            className="w-full flex items-center justify-between gap-2 px-1 py-1.5 rounded-[var(--shape-sm)] hover:bg-[var(--md-surface-variant)] transition-colors"
          >
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-[var(--md-on-surface-variant)]" />
              <span className="text-label-sm text-[var(--md-on-surface)]">Recent</span>
            </div>
            {historyOpen ? <ChevronUp className="w-3.5 h-3.5 text-[var(--md-on-surface-variant)]" /> : <ChevronDown className="w-3.5 h-3.5 text-[var(--md-on-surface-variant)]" />}
          </button>
          {historyOpen && (
            <div className="pt-1">
              {context.history && context.history.length > 0 ? (
                <div className="space-y-1 max-h-[200px] overflow-y-auto custom-scrollbar pr-1">
                  {context.history.map((item: any) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        context.loadHistoryItem(item);
                        setHistoryOpen(false);
                        onClose();
                      }}
                      className="w-full text-left p-2.5 rounded-[var(--shape-md)] hover:bg-[var(--md-surface-variant)] border border-transparent hover:border-[var(--md-outline)] transition-all"
                    >
                      <div className="text-label-xs text-[var(--md-on-surface-variant)] mb-1">{formatTime(item.timestamp)}</div>
                      <div className="text-xs text-[var(--md-on-surface)] line-clamp-2 leading-relaxed">
                        {item.preview || `(${item.messages?.length || 0} messages)`}
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-label-xs text-[var(--md-on-surface-variant)] text-center py-3">No history yet</div>
              )}
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
