"use client";

import React, { useContext, useMemo } from 'react';
import { User, Sparkles, Volume2, Mic } from 'lucide-react';
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
    characterName,
    handleCharacterNameChange,
  } = context;

  const locale = LOCALE_MAP[selectedLanguage] || 'en-US';
  const filteredVoices = useMemo(
    () => voices.filter((v: any) => v.locale === locale && v.gender === selectedGender),
    [voices, locale, selectedGender]
  );

  const currentVoice = (voices as any[]).find((v: any) => v.voice_id === selectedVoice);
  const popularNames = currentVoice?.popular_names || [];

  return (
    <div className="bg-[var(--md-surface-variant)] rounded-[var(--shape-md)] border border-[var(--md-outline)] p-3 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Mic className="w-4 h-4 text-[var(--md-primary)]" />
        <span className="text-title-sm text-[var(--md-on-surface)]">Voice Character</span>
        <span className="text-label-sm text-[var(--md-on-surface-variant)] bg-white px-1.5 py-0.5 rounded-[var(--shape-full)] border border-[var(--md-outline)] ml-auto">
          {LOCALE_LABELS[locale] || locale}
        </span>
      </div>

      {/* Gender Toggle */}
      <div className="flex gap-1 bg-white rounded-[var(--shape-sm)] p-0.5 border border-[var(--md-outline)]">
        <button
          onClick={() => handleGenderChange('female')}
          className={`state-layer flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-[var(--shape-xs)] text-label-md transition-all duration-[var(--motion-sm)] ${
            selectedGender === 'female'
              ? 'bg-[var(--md-primary)] text-white shadow-sm'
              : 'text-[var(--md-on-surface-variant)] hover:text-[var(--md-primary)]'
          }`}
        >
          <span className={selectedGender === 'female' ? '' : 'opacity-40'}>♀</span> Female
        </button>
        <button
          onClick={() => handleGenderChange('male')}
          className={`state-layer flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-[var(--shape-xs)] text-label-md transition-all duration-[var(--motion-sm)] ${
            selectedGender === 'male'
              ? 'bg-[var(--md-primary)] text-white shadow-sm'
              : 'text-[var(--md-on-surface-variant)] hover:text-[var(--md-primary)]'
          }`}
        >
          <span className={selectedGender === 'male' ? '' : 'opacity-40'}>♂</span> Male
        </button>
      </div>

      {/* Character Name */}
      <div className="flex items-center gap-2">
        <User className="w-3.5 h-3.5 text-[var(--md-on-surface-variant)]" />
        <input
          type="text"
          value={characterName}
          onChange={(e) => handleCharacterNameChange(e.target.value)}
          className="flex-1 bg-white text-body-md text-[var(--md-on-surface)] border border-[var(--md-outline)] rounded-[var(--shape-xs)] px-2.5 py-1.5 focus:outline-none focus:border-[var(--md-primary)] transition-colors duration-[var(--motion-sm)]"
          placeholder="Character name"
          maxLength={20}
        />
      </div>

      {/* Voice Selection */}
      {filteredVoices.length > 0 ? (
        <div className="space-y-1 max-h-[180px] overflow-y-auto custom-scrollbar pr-1">
          {filteredVoices.map((v: any) => (
            <label
              key={v.voice_id}
              className={`state-layer flex items-center gap-2.5 p-2 rounded-[var(--shape-sm)] cursor-pointer transition-all duration-[var(--motion-sm)] border ${
                selectedVoice === v.voice_id
                  ? 'bg-white border-[var(--md-primary)] shadow-sm'
                  : 'bg-white border-transparent hover:border-[var(--md-outline-variant)]'
              }`}
            >
              <input
                type="radio"
                name="voice"
                value={v.voice_id}
                checked={selectedVoice === v.voice_id}
                onChange={() => handleVoiceSelect(v.voice_id)}
                className="accent-[var(--md-primary)] w-3.5 h-3.5"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <Volume2 className="w-3 h-3 text-[var(--md-primary)]" />
                  <span className="text-body-md font-medium text-[var(--md-on-surface)] truncate">
                    {v.localized_name}
                  </span>
                  <span className="text-label-sm text-[var(--md-on-surface-variant)] bg-[var(--md-secondary-container)] px-1 py-0.5 rounded ml-auto">
                    {v.gender === 'female' ? '♀' : '♂'}
                  </span>
                </div>
                <div className="text-body-sm text-[var(--md-on-surface-variant)] truncate mt-0.5">
                  {v.display_name} · {v.locale}
                </div>
              </div>
            </label>
          ))}
        </div>
      ) : (
        <div className="text-body-sm text-[var(--md-on-surface-variant)] text-center py-2">
          No voices available for this locale
        </div>
      )}

      {/* Popular Names */}
      {popularNames.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-1.5">
            <Sparkles className="w-3 h-3 text-[var(--md-tertiary)]" />
            <span className="text-label-md text-[var(--md-on-surface-variant)]">Popular names</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {popularNames.slice(0, 6).map((name: string) => (
              <button
                key={name}
                onClick={() => handleCharacterNameChange(name)}
                className={`state-layer text-label-sm px-2 py-0.5 rounded-[var(--shape-full)] border transition-colors duration-[var(--motion-sm)] ${
                  characterName === name
                    ? 'bg-[var(--md-primary)] text-white border-[var(--md-primary)]'
                    : 'bg-white text-[var(--md-on-surface-variant)] border-[var(--md-outline)] hover:border-[var(--md-primary)] hover:text-[var(--md-primary)]'
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
