"use client";

import React, { useState, useContext, useRef, useEffect } from 'react';
import { MessageCircle, Send, Trash2, Sparkles, Bot, FileText } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import VoiceAssistantContext from '../../context/VoiceAssistantContext';

import ChatDisplay from '../ChatDisplay/ChatDisplay.component';
import VoiceRecorder from '../VoiceRecorder/VoiceRecorder.component';
import Loading from '../Loading/Loading.component'
import CharacterSelector from '../CharacterSelector/CharacterSelector.component';
import PresentationMode from '../PresentationMode/PresentationMode.component';

const SUGGESTIONS = [
  'Hello! 👋',
  'Tell me a joke 😄',
  'What can you do? ✨',
  'Introduce yourself 🌟',
];

const PERSONALITIES = [
  { id: 'playful', label: 'Playful', icon: '✨' },
  { id: 'professional', label: 'Professional', icon: '💼' },
  { id: 'concise', label: 'Concise', icon: '⚡' },
];

export default function ConversationContainer() {
  const [showPresentation, setShowPresentation] = useState(false);

  const context = useContext(VoiceAssistantContext);
  if (!context) {
    throw new Error('VoiceAssistantContext is undefined.');
  }

  const {
    inputText,
    chatData,
    handleTextSubmit,
    setInputText,
    handleSpeechRecognized,
    isWaitingAIOutput,
    selectedLanguage,
    personality,
    handlePersonalityChange,
    toastMessage,
    clearChat,
    characterName,
    selectedVoice,
  } = context;

  const isFirstMessage = chatData.length === 0;

  const speechRecognitionLang = selectedLanguage === 'en-GB' ? 'en-US'
    : selectedLanguage === 'cmn-CN' ? 'zh-CN'
    : selectedLanguage === 'Yue-HK' ? 'zh-HK'
    : 'en-US';

  return (
    <div className="bg-white rounded-[var(--shape-md)] shadow-elevation-1 border border-[var(--md-outline)] p-4 flex flex-col h-full relative">
      {/* Header row: title + actions */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-title-lg text-[var(--md-on-surface)] flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-[var(--md-primary)]" />
          Chat
        </h2>
        <div className="flex items-center gap-1">
          {/* Read Script / Presentation */}
          <button
            onClick={() => setShowPresentation(true)}
            className="state-layer rounded-[var(--shape-full)] p-1.5 text-[var(--md-on-surface-variant)] hover:text-[var(--md-primary)] transition-colors duration-[var(--motion-sm)]"
            aria-label="Read a script in presentation mode"
            title="Read Script"
          >
            <FileText className="w-4 h-4" />
          </button>
          {/* Clear chat */}
          {chatData.length > 0 && (
            <button
              onClick={clearChat}
              className="state-layer rounded-[var(--shape-full)] p-1.5 text-[var(--md-on-surface-variant)] hover:text-[var(--md-error)] transition-colors duration-[var(--motion-sm)]"
              aria-label="Clear conversation"
              title="New conversation"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Personality toggle */}
      <div className="flex gap-1 mb-2">
        {PERSONALITIES.map((p) => (
          <button
            key={p.id}
            onClick={() => handlePersonalityChange(p.id as any)}
            className={`state-layer flex items-center gap-1 px-2.5 py-1 rounded-[var(--shape-full)] text-label-sm border transition-all duration-[var(--motion-sm)] ${
              personality === p.id
                ? 'bg-[var(--md-primary-container)] text-[var(--md-on-primary-container)] border-[var(--md-primary)]'
                : 'bg-white text-[var(--md-on-surface-variant)] border-[var(--md-outline)] hover:border-[var(--md-primary)]'
            }`}
          >
            <span>{p.icon}</span>
            <span>{p.label}</span>
          </button>
        ))}
      </div>

      <CharacterSelector />

      <ChatDisplay chatData={chatData} />

      {/* Toast notification */}
      {toastMessage && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-[var(--md-primary)] text-white text-body-sm px-4 py-1.5 rounded-[var(--shape-full)] shadow-elevation-3 animate-[md-fade-in_200ms_ease-out] pointer-events-none">
          {toastMessage}
        </div>
      )}

      {/* Welcome message for empty state */}
      {isFirstMessage && !isWaitingAIOutput && (
        <div className="flex flex-col items-center py-4 text-center animate-[md-fade-in_300ms_ease-out]">
          <Bot className="w-10 h-10 text-[var(--md-primary)] mb-2 opacity-60" />
          <p className="text-body-md text-[var(--md-on-surface-variant)] mb-3">
            Start a conversation!
          </p>
          <div className="flex flex-wrap gap-2 justify-center max-w-xs">
            {SUGGESTIONS.map((s, i) => (
              <button
                key={i}
                onClick={() => {
                  setInputText(s);
                }}
                className="text-label-sm bg-[var(--md-primary-container)] text-[var(--md-on-primary-container)] px-3 py-1.5 rounded-[var(--shape-full)] border border-[var(--md-primary)]/20 hover:bg-[var(--md-primary)] hover:text-white transition-all duration-[var(--motion-sm)] state-layer"
              >
                {s}
              </button>
            ))}
          </div>
          <p className="text-label-sm text-[var(--md-on-surface-variant)]/50 mt-3">
            or type below ✏️
          </p>
        </div>
      )}

      {isWaitingAIOutput && <Loading />}

      <form onSubmit={handleTextSubmit} className="flex items-center gap-2 mt-auto">
        <div className="relative flex-1">
          <Input
            type="text"
            placeholder="Type a message..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="w-full text-body-lg bg-[var(--md-surface-variant)] text-[var(--md-on-surface)] placeholder:text-[var(--md-on-surface-variant)]/60 rounded-[var(--shape-full)] px-5 py-2.5 pr-12 border-2 border-[var(--md-outline)] focus:border-[var(--md-primary)] focus:ring-0 transition-colors duration-[var(--motion-sm)]"
            aria-label="Message input"
          />
          <Button
            type="submit"
            className="absolute inset-y-1 right-1 w-8 h-8 bg-[var(--md-primary)] text-white rounded-[var(--shape-full)] p-1.5 flex items-center justify-center transition-all duration-[var(--motion-sm)] state-layer"
            aria-label="Send message"
            variant="ghost"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        <VoiceRecorder onSpeechRecognized={handleSpeechRecognized} language={speechRecognitionLang} />
      </form>

      {/* Presentation Mode Overlay */}
      {showPresentation && (
        <PresentationMode
          characterName={characterName || 'Xiao Wei'}
          voiceId={selectedVoice}
          language={selectedLanguage}
          onClose={() => setShowPresentation(false)}
        />
      )}

      {/* Keyboard shortcut hint */}
      <div className="flex justify-center mt-1.5 gap-3">
        <span className="text-label-sm text-[var(--md-on-surface-variant)]/40">
          <kbd className="bg-[var(--md-surface-variant)] px-1 rounded text-[10px] border border-[var(--md-outline)]">Space</kbd> voice
        </span>
        <span className="text-label-sm text-[var(--md-on-surface-variant)]/40">
          <kbd className="bg-[var(--md-surface-variant)] px-1 rounded text-[10px] border border-[var(--md-outline)]">Esc</kbd> cancel
        </span>
      </div>
    </div>
  );
}
