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

      <CharacterSelector />

      <ChatDisplay chatData={chatData} />

      {/* Toast notification */}
      {toastMessage && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-[var(--md-primary)] text-white text-body-sm px-4 py-1.5 rounded-[var(--shape-full)] shadow-elevation-3 animate-[md-fade-in_200ms_ease-out] pointer-events-none">
          {toastMessage}
        </div>
      )}

      {isWaitingAIOutput && <Loading />}

      {/* Suggestions for new conversation */}
      {isFirstMessage && (
        <div className="flex-1 flex flex-col items-center justify-center min-h-0 py-4">
          <p className="text-title-md text-[var(--md-on-surface-variant)] mb-3">
            Start a conversation!
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => {
                  // Set the text and submit
                  handleTextSubmit({ preventDefault: () => {} } as React.FormEvent);
                  setInputText(s);
                }}
                className="state-layer px-3 py-1.5 rounded-[var(--shape-full)] text-label-sm text-[var(--md-primary)] bg-[var(--md-primary-container)] hover:opacity-80 transition-opacity"
              >
                {s}
              </button>
            ))}
          </div>
          <p className="text-label-sm text-[var(--md-on-surface-variant)] mt-3">
            or type below ✏️
          </p>
        </div>
      )}

      {/* Input area */}
      <form onSubmit={handleTextSubmit} className="flex items-center gap-2 mt-2 pt-2 border-t border-[var(--md-outline)]">
        <div className="flex-1 relative">
          <Input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Message input"
            className="w-full pr-10"
            disabled={isWaitingAIOutput}
          />
        </div>
        <Button
          type="submit"
          size="icon"
          disabled={isWaitingAIOutput || !inputText.trim()}
          aria-label="Send message"
        >
          <Send className="w-4 h-4" />
        </Button>
        <VoiceRecorder
          lang={speechRecognitionLang}
          onSpeechRecognized={handleSpeechRecognized}
        />
      </form>

      {/* Presentation mode */}
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
