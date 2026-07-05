"use client";

import React, { useState, useContext } from 'react';
import { X, MessageSquarePlus, FileText, Settings, Brain, Menu, ChevronDown, ChevronUp, History } from 'lucide-react';
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

  return (
    <aside className="w-[280px] flex-shrink-0 bg-white border-r border-gray-200 flex flex-col h-full overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 sticky top-0 bg-white z-10">
        <div className="flex items-center gap-2">
          <Menu className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-medium text-gray-700">Menu</span>
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

        {/* ── Read Script (opens full window) ── */}
        <button
          onClick={handleReadScript}
          className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 rounded-lg border border-gray-200 transition-colors"
        >
          <FileText className="w-4 h-4 text-gray-400" />
          Read Script
        </button>

        {/* ── Recent (collapsible history) ── */}
        <div className="border-t border-gray-100 pt-3">
          <button
            onClick={() => setHistoryOpen(!historyOpen)}
            className="w-full flex items-center justify-between gap-2 mb-1"
          >
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Recent</span>
            </div>
            {historyOpen ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
          </button>

          {historyOpen && (
            <div className="pt-1">
              {context.history && context.history.length > 0 ? (
                <div className="space-y-1 max-h-[260px] overflow-y-auto pr-1">
                  {context.history.map((item: any) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        context.loadHistoryItem(item);
                        setHistoryOpen(false);
                        onClose();
                      }}
                      className="w-full text-left p-2.5 rounded-lg hover:bg-gray-50 border border-transparent hover:border-gray-200 transition-all"
                    >
                      <div className="text-xs text-gray-500 mb-1">{formatTime(item.timestamp)}</div>
                      <div className="text-xs text-gray-800 line-clamp-2 leading-relaxed">
                        {item.preview || `(${item.messages?.length || 0} messages)`}
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-gray-400 text-center py-2">No history yet</div>
              )}
            </div>
          )}
        </div>

        {/* ── Settings (collapsible) ── */}
        <div className="border-t border-gray-100 pt-3">
          <button
            onClick={() => setSettingsOpen(!settingsOpen)}
            className="w-full flex items-center justify-between gap-2 mb-1"
          >
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Settings</span>
            </div>
            {settingsOpen ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
          </button>

          {settingsOpen && (
            <div className="pt-1">
              <CharacterSelector />
            </div>
          )}

          {/* ── Model (collapsible) ── */}
          <div className="mt-3 border-t border-gray-100 pt-3">
            <button
              onClick={() => setModelOpen(!modelOpen)}
              className="w-full flex items-center justify-between gap-2 mb-1"
            >
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-medium text-gray-700">Model</span>
              </div>
              {modelOpen ? <ChevronUp className="w-3.5 h-3.5 text-gray-400" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
            </button>

            {modelOpen && (
              <div className="pt-1">
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
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}
