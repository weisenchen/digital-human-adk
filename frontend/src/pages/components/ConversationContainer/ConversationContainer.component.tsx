"use client";

import React, { useState, useContext } from 'react';
import { Send } from 'lucide-react';
import { Input } from "@/components/ui/input";

import VoiceAssistantContext from '../../context/VoiceAssistantContext';

import ChatDisplay from '../ChatDisplay/ChatDisplay.component';
import VoiceRecorder from '../VoiceRecorder/VoiceRecorder.component';
import Loading from '../Loading/Loading.component'
import PresentationMode from '../PresentationMode/PresentationMode.component';
import DigitalHumanContainer from '../DigitalHumanContainer/DigitalHumanContainer.component';

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

  return (
    <div className="flex flex-col h-full relative">
      {/* Toast notification */}
      {toastMessage && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-[var(--md-primary)] text-white text-body-sm px-4 py-1.5 rounded-[var(--shape-full)] shadow-elevation-3 animate-[md-fade-in_200ms_ease-out] pointer-events-none">
          {toastMessage}
        </div>
      )}

      {isWaitingAIOutput && <Loading />}

      {/* ── First message: centered welcome ── */}
      {isFirstMessage ? (
        <div className="flex-1 flex flex-col items-center justify-center min-h-0 py-8">
          {/* Avatar circle */}
          <div className="w-20 h-20 rounded-full overflow-hidden mb-4 border-2 border-[var(--md-outline)] shadow-elevation-1">
            <DigitalHumanContainer compact />
          </div>
          <h1 className="text-title-lg text-[var(--md-on-surface)] font-medium">
            {characterName}
          </h1>
        </div>
      ) : (
        /* ── Conversation mode ── */
        <div className="flex-1 flex flex-col min-h-0">
          {/* Compact header */}
          <div className="flex items-center py-3 px-1 border-b border-[var(--md-outline)]/30 mb-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0 border border-[var(--md-outline)]">
                <DigitalHumanContainer compact />
              </div>
              <span className="text-label-sm text-[var(--md-on-surface)] font-medium">
                {characterName}
              </span>
            </div>
          </div>

          {/* Chat messages */}
          <ChatDisplay chatData={chatData} />
        </div>
      )}

      {/* ── Input area (Gemini-style) ── */}
      <form onSubmit={handleTextSubmit} className="mt-2 mb-4">
        <div className="flex items-center gap-2 border border-[var(--md-outline)] rounded-[var(--shape-lg)] px-4 py-2 bg-white focus-within:border-[var(--md-primary)] focus-within:shadow-[0_0_0_2px_var(--md-primary-container)] transition-all">
          <Input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Enter a prompt here"
            className="border-0 p-0 shadow-none focus-visible:ring-0 text-body-md bg-transparent"
            disabled={isWaitingAIOutput}
          />
          <VoiceRecorder
            language={speechRecognitionLang}
            onSpeechRecognized={handleSpeechRecognized}
          />
          <button
            type="submit"
            disabled={isWaitingAIOutput || !inputText.trim()}
            className="state-layer p-2 rounded-[var(--shape-full)] text-white bg-[var(--md-primary)] disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
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
