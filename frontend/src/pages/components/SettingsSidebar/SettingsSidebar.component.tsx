"use client";

import React, { useContext } from 'react';
import CharacterSelector from '../CharacterSelector/CharacterSelector.component';
import LanguageSelector from '../LanguageSelector/LanguageSelector.component';
import VoiceAssistantContext from '../../context/VoiceAssistantContext';

export default function SettingsSidebar() {
  const context = useContext(VoiceAssistantContext);
  const selectedLanguage = context?.selectedLanguage || 'en-GB';
  const handleLanguageChange = context?.handleLanguageChange || (() => {});

  return (
    <aside className="w-[280px] flex-shrink-0 bg-white border-r border-gray-200 flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100">
        <span className="text-sm font-medium text-gray-700">Settings</span>
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
