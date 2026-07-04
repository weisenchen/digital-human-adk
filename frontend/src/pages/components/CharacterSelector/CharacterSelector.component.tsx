"use client";

import React, { useContext, useMemo } from 'react';
import { Mic } from 'lucide-react';
import VoiceAssistantContext from '../../context/VoiceAssistantContext';

const LOCALE_LABELS: Record<string, string> = {
  'en-US': '🇺🇸 English (US)',
  'en-GB': '🇬🇧 English (UK)',
  'cmn-CN': '🇨🇳 普通话',
  'Yue-HK': '🇭🇰 粵語',
  'ja-JP': '🇯🇵 日本語',
  'ko-KR': '🇰🇷 한국어',
  'fr-FR': '🇫🇷 Français',
};

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
        <Mic className="w-4 h-4 text-gray-500" />
        <span className="text-sm font-medium text-gray-700">Voice</span>
        <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full ml-auto">
          {LOCALE_LABELS[locale] || locale}
        </span>
      </div>

      {/* Gender Toggle */}
      <div className="flex gap-1 bg-gray-50 rounded-lg p-0.5 border border-gray-200">
        <button
          onClick={() => handleGenderChange('female')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md text-xs font-medium transition-all ${
            selectedGender === 'female'
              ? 'bg-white text-gray-900 shadow-sm border border-gray-200'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          ♀ Female
        </button>
        <button
          onClick={() => handleGenderChange('male')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md text-xs font-medium transition-all ${
            selectedGender === 'male'
              ? 'bg-white text-gray-900 shadow-sm border border-gray-200'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          ♂ Male
        </button>
      </div>

      {/* Voice List */}
      {filteredVoices.length > 0 ? (
        <div className="space-y-1 max-h-[220px] overflow-y-auto custom-scrollbar pr-1">
          {filteredVoices.map((v: any) => {
            const charName = v.popular_names?.[0] || v.localized_name;
            return (
              <label
                key={v.voice_id}
                className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-all border ${
                  selectedVoice === v.voice_id
                    ? 'bg-white border-gray-300 shadow-sm'
                    : 'border-transparent hover:bg-gray-50 hover:border-gray-200'
                }`}
              >
                <input
                  type="radio"
                  name="voice"
                  value={v.voice_id}
                  checked={selectedVoice === v.voice_id}
                  onChange={() => handleVoiceSelect(v.voice_id)}
                  className="accent-gray-900 w-3.5 h-3.5 flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium text-gray-900 truncate">
                      {charName}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400 truncate mt-0.5">
                    {v.localized_name} · {v.locale}
                  </div>
                </div>
              </label>
            );
          })}
        </div>
      ) : (
        <div className="text-xs text-gray-400 text-center py-3">
          No voices available
        </div>
      )}
    </div>
  );
};

export default CharacterSelector;
