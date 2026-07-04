"use client";

import React, { useContext } from 'react';
import { X, Brains } from 'lucide-react';
import CharacterSelector from '../CharacterSelector/CharacterSelector.component';
import VoiceAssistantContext from '../../context/VoiceAssistantContext';

interface SettingsSidebarProps {
  onClose: () => void;
}

export default function SettingsSidebar({ onClose }: SettingsSidebarProps) {
  const context = useContext(VoiceAssistantContext);

  return (
    <aside className="w-[280px] flex-shrink-0 bg-white border-r border-gray-200 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <span className="text-sm font-medium text-gray-700">Settings</span>
        <button
          onClick={onClose}
          className="p-1 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-5">
        {/* Voice Character Selection */}
        <CharacterSelector />

        {/* Divider */}
        <div className="border-t border-gray-100" />

        {/* Model Selection */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Brains className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Model</span>
          </div>

          {/* Model list */}
          {context.models && context.models.length > 0 ? (
            <div className="space-y-1 max-h-[220px] overflow-y-auto custom-scrollbar pr-1">
              {context.models.map((m: any) => {
                const isSelected = context.selectedModel === m.id;
                return (
                  <label
                    key={m.id}
                    className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-all border ${
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
                      className="accent-gray-900 w-3.5 h-3.5 flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">
                        {m.name}
                      </div>
                      <div className="text-xs text-gray-400 truncate mt-0.5">
                        {m.provider}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          ) : (
            <div className="text-xs text-gray-400 text-center py-3">
              No models available
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
