"use client";

import React from 'react';
import { MessageCircle, Send } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { useContext } from 'react';
import VoiceAssistantContext from '../../context/VoiceAssistantContext';

import ChatDisplay from '../ChatDisplay/ChatDisplay.component';
import VoiceRecorder from '../VoiceRecorder/VoiceRecorder.component';
import Loading from '../Loading/Loading.component'
import CharacterSelector from '../CharacterSelector/CharacterSelector.component';

export default function ConversationContainer() {
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
  } = context;

  const speechRecognitionLang = selectedLanguage === 'en-GB' ? 'en-US'
    : selectedLanguage === 'cmn-CN' ? 'zh-CN'
    : selectedLanguage === 'Yue-HK' ? 'zh-HK'
    : 'en-US';

  return (
    <div className="bg-white rounded-[var(--shape-md)] shadow-elevation-1 border border-[var(--md-outline)] p-4 flex flex-col h-full">
      <h2 className="text-title-lg text-[var(--md-on-surface)] mb-4 flex items-center gap-2">
        <MessageCircle className="w-5 h-5 text-[var(--md-primary)]" />
        Conversation
      </h2>

      <CharacterSelector />

      <ChatDisplay chatData={chatData} />

      {isWaitingAIOutput && <Loading />}

      <form onSubmit={handleTextSubmit} className="flex items-center gap-2 mt-4">
        <div className="relative flex-1">
          <Input
            type="text"
            placeholder="Type a message..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="w-full text-body-lg bg-[var(--md-surface-variant)] text-[var(--md-on-surface)] placeholder:text-[var(--md-on-surface-variant)]/60 rounded-[var(--shape-full)] px-5 py-2.5 pr-12 border-2 border-[var(--md-outline)] focus:border-[var(--md-primary)] focus:ring-0 transition-colors duration-[var(--motion-sm)] ease-standard"
            aria-label="Message input"
          />
          <Button
            type="submit"
            className="absolute inset-y-1 right-1 w-8 h-8 bg-[var(--md-primary)] text-white rounded-[var(--shape-full)] p-1.5 flex items-center justify-center transition-all duration-[var(--motion-sm)] ease-emphasized state-layer"
            aria-label="Send message"
            variant="ghost"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
        <VoiceRecorder onSpeechRecognized={handleSpeechRecognized} language={speechRecognitionLang} />
      </form>
    </div>
  );
}
