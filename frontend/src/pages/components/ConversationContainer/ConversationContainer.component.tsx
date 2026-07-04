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
    <div className="bg-white rounded-xl shadow-card border border-[#E2E8F0] p-4 flex flex-col h-full">
      <h2 className="text-xl font-bold text-[#1A202C] mb-4 flex items-center gap-2">
        <MessageCircle className="w-5 h-5 text-[#6B46C1]" />
        Conversation
      </h2>

      <ChatDisplay chatData={chatData} />

      {isWaitingAIOutput && <Loading />}

      <form onSubmit={handleTextSubmit} className="flex items-center gap-2 mt-4">
        <div className="relative flex-1">
          <Input
            type="text"
            placeholder="Type a message..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="w-full text-base bg-[#F7FAFC] text-[#1A202C] placeholder-[#A0AEC0] rounded-full px-5 py-2.5 pr-12 border-2 border-[#E2E8F0] focus:border-[#6B46C1] focus:ring-0 transition-colors"
            aria-label="Message input"
          />
          <Button
            type="submit"
            className="absolute inset-y-1 right-1 w-8 h-8 bg-[#6B46C1] hover:bg-[#667EEA] text-white rounded-full p-1.5 flex items-center justify-center transition-colors"
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
