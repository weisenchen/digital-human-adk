"use client";

import React, { useContext, useMemo } from 'react';
import { Mic } from 'lucide-react';
import VoiceAssistantContext from '../../context/VoiceAssistantContext';

const LOCALE_MAP: Record<string, string> = {
  'en-GB': 'en-US',
  'cmn-CN': 'cmn-CN',
  'Yue-HK': 'Yue-HK',
  'en-US': 'en-US',
  'ja-JP': 'ja-JP',
  'ko-KR': 'ko-KR',
  'fr-FR': 'fr-FR',
};

const CharacterSelector: React.FC = () => {
  const context = useContext(VoiceAssistantContext);
  if (!context) return null;

  const {
    voices,
    selectedVoice,
    selectedGender,
    handleGenderChange,
    handleVoiceSelect,
    selectedLanguage,
  } = context;

  const locale = LOCALE_MAP[selectedLanguage] || 'en-US';
  const filteredVoices = useMemo(
    () => voices.filter((v: any) => v.locale === locale && v.gender === selectedGender),
    [voices, locale, selectedGender]
  );

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Mic className="w-4 h-4 text-[var(--md-tertiary)]" />
        <span className="text-label-sm text-[var(--md-on-surface)]">Voice</span>
        <span className="text-[10px] text-[var(--md-on-surface-variant)] bg-[var(--md-surface-variant)] px-1.5 py-0.5 rounded-full ml-auto">
          English
        </span>
      </div>

      {/* Gender Toggle */}
      <div className="flex gap-1 bg-[var(--md-surface-variant)] rounded-[var(--shape-md)] p-0.5 border border-[var(--md-outline)]">
        <button
          onClick={() => handleGenderChange('female')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md text-xs font-medium transition-all ${
            selectedGender === 'female'
              ? 'bg-white text-[var(--md-on-surface)] shadow-sm border border-[var(--md-outline)]'
              : 'text-[var(--md-on-surface-variant)] hover:text-[var(--md-on-surface)]'
          }`}
        >
          <span className="text-sm leading-none">♀</span> Female
        </button>
        <button
          onClick={() => handleGenderChange('male')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md text-xs font-medium transition-all ${
            selectedGender === 'male'
              ? 'bg-white text-[var(--md-on-surface)] shadow-sm border border-[var(--md-outline)]'
              : 'text-[var(--md-on-surface-variant)] hover:text-[var(--md-on-surface)]'
          }`}
        >
          <span className="text-sm leading-none">♂</span> Male
        </button>
      </div>

      {/* Voice List */}
      {filteredVoices.length > 0 ? (
        <div className="space-y-1 max-h-[220px] overflow-y-auto custom-scrollbar pr-1">
          {filteredVoices.map((v: any) => {
            const charName = v.popular_names?.[0] || v.localized_name;
            const isSelected = selectedVoice === v.voice_id;
            return (
              <label
                key={v.voice_id}
                className={`flex items-center gap-2 p-2 rounded-[var(--shape-md)] cursor-pointer transition-all border ${
                  isSelected
                    ? 'bg-white border-[var(--md-outline)] shadow-sm'
                    : 'border-transparent hover:bg-[var(--md-surface-variant)] hover:border-[var(--md-outline)]'
                }`}
              >
                <input
                  type="radio"
                  name="voice"
                  value={v.voice_id}
                  checked={isSelected}
                  onChange={() => handleVoiceSelect(v.voice_id)}
                  className="accent-[var(--md-tertiary)] w-3 h-3 flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-[var(--md-on-surface)] truncate">
                    {charName}
                  </div>
                  <div className="text-[10px] text-[var(--md-on-surface-variant)] truncate mt-0.5">
                    {v.locale}
                  </div>
                </div>
              </label>
            );
          })}
        </div>
      ) : (
        <div className="text-[10px] text-[var(--md-on-surface-variant)] text-center py-3">
          No voices available
        </div>
      )}
    </div>
  );
};

export default CharacterSelector;
