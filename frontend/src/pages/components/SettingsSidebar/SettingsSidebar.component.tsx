"use client";

import React, { useContext } from 'react';
import { X } from 'lucide-react';
import CharacterSelector from '../CharacterSelector/CharacterSelector.component';
import LanguageSelector from '../LanguageSelector/LanguageSelector.component';
import VoiceAssistantContext from '../../context/VoiceAssistantContext';

interface SettingsSidebarProps {
  onClose: () => void;
}

export default function SettingsSidebar({ onClose }: SettingsSidebarProps) {
  const context = useContext(VoiceAssistantContext);
  const characterName = context?.characterName || '';
  const selectedLanguage = context?.selectedLanguage || 'en-GB';
  const handleLanguageChange = context?.handleLanguageChange || (() => {});

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
      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        <CharacterSelector />
        <LanguageSelector
          selectedLanguage={selectedLanguage}
          onLanguageChange={handleLanguageChange}
        />
      </div>
    </aside>
  );
}
