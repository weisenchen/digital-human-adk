"use client";

import React, { useContext, useMemo } from 'react';
import { User, Sparkles, Volume2, Mic } from 'lucide-react';
import VoiceAssistantContext from '../../context/VoiceAssistantContext';

/** Map language codes to flags/labels for display */
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
    characterName,
    handleCharacterNameChange,
  } = context;

  // Filter voices for the current locale and gender
  const locale = LOCALE_MAP[selectedLanguage] || 'en-US';
  const filteredVoices = useMemo(
    () => voices.filter((v: any) => v.locale === locale && v.gender === selectedGender),
    [voices, locale, selectedGender]
  );

  const currentVoice = voices.find((v: any) => v.voice_id === selectedVoice);
  const popularNames = currentVoice?.popular_names || [];

  return (
    <div className="bg-[#F7FAFC] rounded-xl border border-[#E2E8F0] p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Mic className="w-4 h-4 text-[#6B46C1]" />
        <span className="text-sm font-semibold text-[#1A202C]">Voice Character</span>
        <span className="text-[10px] text-[#A0AEC0] bg-white px-1.5 py-0.5 rounded-full border border-[#E2E8F0] ml-auto">
          {LOCALE_LABELS[locale] || locale}
        </span>
      </div>

      {/* Gender Toggle */}
      <div className="flex gap-1 bg-white rounded-lg p-0.5 border border-[#E2E8F0]">
        <button
          onClick={() => handleGenderChange('female')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md text-xs font-medium transition-all ${
            selectedGender === 'female'
              ? 'bg-[#6B46C1] text-white shadow-sm'
              : 'text-[#4A5568] hover:text-[#6B46C1]'
          }`}
        >
          <span className={selectedGender === 'female' ? '' : 'opacity-50'}>♀</span> Female
        </button>
        <button
          onClick={() => handleGenderChange('male')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md text-xs font-medium transition-all ${
            selectedGender === 'male'
              ? 'bg-[#6B46C1] text-white shadow-sm'
              : 'text-[#4A5568] hover:text-[#6B46C1]'
          }`}
        >
          <span className={selectedGender === 'male' ? '' : 'opacity-50'}>♂</span> Male
        </button>
      </div>

      {/* Character Name */}
      <div className="flex items-center gap-2">
        <User className="w-3.5 h-3.5 text-[#A0AEC0]" />
        <input
          type="text"
          value={characterName}
          onChange={(e) => handleCharacterNameChange(e.target.value)}
          className="flex-1 bg-white text-sm text-[#1A202C] border border-[#E2E8F0] rounded-md px-2.5 py-1.5 focus:outline-none focus:border-[#6B46C1] transition-colors"
          placeholder="Character name"
          maxLength={20}
        />
      </div>

      {/* Voice Selection - radio card list */}
      {filteredVoices.length > 0 ? (
        <div className="space-y-1 max-h-[200px] overflow-y-auto custom-scrollbar pr-1">
          {filteredVoices.map((v: any) => (
            <label
              key={v.voice_id}
              className={`flex items-center gap-2.5 p-2 rounded-lg cursor-pointer transition-all border ${
                selectedVoice === v.voice_id
                  ? 'bg-white border-[#6B46C1] shadow-sm'
                  : 'bg-white border-transparent hover:border-[#CBD5E0]'
              }`}
            >
              <input
                type="radio"
                name="voice"
                value={v.voice_id}
                checked={selectedVoice === v.voice_id}
                onChange={() => handleVoiceSelect(v.voice_id)}
                className="accent-[#6B46C1] w-3.5 h-3.5"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <Volume2 className="w-3 h-3 text-[#6B46C1]" />
                  <span className="text-sm font-medium text-[#1A202C] truncate">
                    {v.localized_name}
                  </span>
                  <span className="text-[10px] text-[#A0AEC0] bg-[#EDF2F7] px-1 py-0.5 rounded ml-auto">
                    {v.gender === 'female' ? '♀' : '♂'}
                  </span>
                </div>
                <div className="text-xs text-[#A0AEC0] truncate mt-0.5">
                  {v.display_name} · {v.locale}
                </div>
              </div>
            </label>
          ))}
        </div>
      ) : (
        <div className="text-xs text-[#A0AEC0] text-center py-2">
          No voices available for this locale
        </div>
      )}

      {/* Popular Names Suggestion */}
      {popularNames.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <Sparkles className="w-3 h-3 text-[#667EEA]" />
            <span className="text-[11px] text-[#4A5568] font-medium">Popular names</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {popularNames.slice(0, 6).map((name: string) => (
              <button
                key={name}
                onClick={() => handleCharacterNameChange(name)}
                className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                  characterName === name
                    ? 'bg-[#6B46C1] text-white border-[#6B46C1]'
                    : 'bg-white text-[#4A5568] border-[#E2E8F0] hover:border-[#6B46C1] hover:text-[#6B46C1]'
                }`}
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CharacterSelector;
