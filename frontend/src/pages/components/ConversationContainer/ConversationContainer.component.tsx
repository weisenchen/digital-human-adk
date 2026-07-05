"use client";

import React, { useState, useContext } from 'react';
import { Send, Sparkles, MessageSquare, Mic, FileText } from 'lucide-react';
import { Input } from "@/components/ui/input";

import VoiceAssistantContext from '../../context/VoiceAssistantContext';

import ChatDisplay from '../ChatDisplay/ChatDisplay.component';
import VoiceRecorder from '../VoiceRecorder/VoiceRecorder.component';
import Loading from '../Loading/Loading.component'
import PresentationMode from '../PresentationMode/PresentationMode.component';
import DigitalHumanContainer from '../DigitalHumanContainer/DigitalHumanContainer.component';

const SUGGESTIONS = [
  { label: 'Tell me a story', icon: Sparkles },
  { label: 'Explain quantum physics', icon: MessageSquare },
  { label: 'Write a poem', icon: FileText },
  { label: 'Practice Chinese', icon: MessageSquare },
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

  // Listen for menu-triggered events from top bar
  React.useEffect(() => {
    const onNewConv = () => {
      if (clearChat) clearChat();
    };
    const onPresentation = () => setShowPresentation(true);
    window.addEventListener('new-conversation', onNewConv);
    window.addEventListener('open-presentation', onPresentation);
    return () => {
      window.removeEventListener('new-conversation', onNewConv);
      window.removeEventListener('open-presentation', onPresentation);
    };
  }, [clearChat]);

  const speechRecognitionLang = selectedLanguage === 'en-GB' ? 'en-US'
    : selectedLanguage === 'cmn-CN' ? 'zh-CN'
    : selectedLanguage === 'Yue-HK' ? 'zh-HK'
    : 'en-US';

  const handleSuggestionClick = (text: string) => {
    setInputText(text);
  };

  return (
    <div className="flex flex-col h-full relative">
      {/* Toast notification */}
      {toastMessage && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-[var(--md-on-surface)] text-white text-body-sm px-4 py-1.5 rounded-[var(--shape-full)] shadow-elevation-3 animate-[md-fade-in_200ms_ease-out] pointer-events-none">
          {toastMessage}
        </div>
      )}

      {isWaitingAIOutput && <Loading />}

      {/* ── First message: centered welcome ── */}
      {isFirstMessage ? (
        <div className="flex-1 flex flex-col items-center justify-center min-h-0 px-6 py-8">
          {/* Avatar circle */}
          <div className="w-24 h-24 rounded-full overflow-hidden mb-5 border-2 border-[var(--md-outline)] shadow-elevation-2 lg:hidden">
            <DigitalHumanContainer compact />
          </div>
          <h1 className="text-[1.75rem] font-[family-name:var(--font-serif)] text-[var(--md-on-surface)] mb-1">
            {characterName || 'Xiao Wei'}
          </h1>
          <p className="text-body-md text-[var(--md-on-surface-variant)] mb-8 text-center max-w-sm">
            Your warm companion. Ask me anything — I&apos;m here to help.
          </p>

          {/* Suggestion chips */}
          <div className="flex flex-wrap justify-center gap-2 mb-8 max-w-md">
            {SUGGESTIONS.map((s) => (
              <button
                key={s.label}
                onClick={() => handleSuggestionClick(s.label)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-[var(--shape-full)] border border-[var(--md-outline)] bg-white text-label-sm text-[var(--md-on-surface-variant)] hover:border-[var(--md-tertiary)] hover:text-[var(--md-tertiary)] hover:bg-[var(--md-tertiary-container)] transition-all duration-[var(--motion-md)]"
              >
                <s.icon className="w-3.5 h-3.5" />
                {s.label}
              </button>
            ))}
          </div>
        </div>
      ) : (
        /* ── Conversation mode ── */
        <div className="flex-1 flex flex-col min-h-0">
          {/* Compact header */}
          <div className="flex items-center py-3 px-4 border-b border-[var(--md-outline)]/40 mb-2">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0 border border-[var(--md-outline)]">
                <DigitalHumanContainer compact />
              </div>
              <div>
                <span className="text-label-sm text-[var(--md-on-surface)] font-medium block leading-tight">
                  {characterName}
                </span>
                <span className="text-label-xs text-[var(--md-on-surface-variant)]/60">
                  {selectedVoice ? 'Voice active' : 'Digital companion'}
                </span>
              </div>
            </div>
          </div>

          {/* Chat messages */}
          <ChatDisplay chatData={chatData} />
        </div>
      )}

      {/* ── Input area ── */}
      <form onSubmit={handleTextSubmit} className="px-4 pb-4 pt-2">
        <div className="flex items-center gap-2 border border-[var(--md-outline)] rounded-[var(--shape-xl)] px-4 py-2.5 bg-white focus-within:border-[var(--md-tertiary)] focus-within:shadow-[0_0_0_3px_var(--md-tertiary-container)] transition-all duration-[var(--motion-md)]">
          <Input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Message Xiao Wei..."
            className="border-0 p-0 shadow-none focus-visible:ring-0 text-body-md bg-transparent"
            disabled={isWaitingAIOutput}
          />
          <VoiceRecorder
            language={speechRecognitionLang}
            onSpeechRecognized={handleSpeechRecognized}
            onInterimText={(text) => setInputText(text)}
          />
          <button
            type="submit"
            disabled={isWaitingAIOutput || !inputText.trim()}
            className="state-layer p-2.5 rounded-[var(--shape-full)] text-white bg-[var(--md-tertiary)] disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[var(--md-tertiary)]/90 transition-all duration-[var(--motion-sm)] shadow-elevation-1"
            aria-label="Send message"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>

      {/* Presentation mode overlay */}
      {showPresentation && (
        <PresentationMode
          characterName={characterName || 'Xiao Wei'}
          voiceId={selectedVoice}
          language={selectedLanguage}
          onClose={() => setShowPresentation(false)}
        />
      )}
    </div>
  );
}
