"use client";

import React, { useRef, useEffect, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ScrollArea } from "@/components/ui/scroll-area";
import VoiceAssistantContext from '../../context/VoiceAssistantContext';

interface ChatMessage {
  text: string;
  isUser: boolean;
}

interface ChatDisplayProps {
  chatData: ChatMessage[];
}

const ChatDisplay: React.FC<ChatDisplayProps> = ({ chatData }) => {
  const chatContainerRef = useRef<HTMLDivElement | null>(null);
  const context = useContext(VoiceAssistantContext);
  const characterName = context?.characterName || 'Xiao Wei';
  const aiInitial = characterName.charAt(0).toUpperCase();

  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatData]);

  return (
    <ScrollArea className="flex-grow mb-4 pr-2 custom-scrollbar">
      <AnimatePresence initial={false}>
        {chatData.map((message, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: [0.2, 0, 0, 1.0] }}
            className={`mb-3 flex items-start gap-2.5 ${
              message.isUser ? 'justify-end' : 'justify-start'
            }`}
          >
            {/* AI avatar (tonal surface with initial) */}
            {!message.isUser && (
              <div className="w-8 h-8 rounded-[var(--shape-full)] flex items-center justify-center text-xs font-bold flex-shrink-0 shadow-sm tonal-surface">
                {aiInitial}
              </div>
            )}

            {/* Message bubble */}
            <div
              className={`max-w-[85%] px-4 py-2.5 leading-relaxed text-sm md:text-base ${
                message.isUser
                  ? 'bg-[var(--md-bubble-user)] text-[var(--md-on-surface)] rounded-[var(--shape-lg)] rounded-br-[var(--shape-sm)]'
                  : 'bg-[var(--md-bubble-ai)] text-[var(--md-on-surface)] rounded-[var(--shape-lg)] rounded-bl-[var(--shape-sm)]'
              } ${
                index === chatData.length - 1 && !message.isUser && message.text === ''
                  ? 'streaming-cursor'
                  : ''
              }`}
            >
              <p className="text-sm md:text-base">
                {message.text || (index === chatData.length - 1 && !message.isUser ? '' : message.text)}
              </p>
            </div>

            {/* User avatar (tonal surface with initial) */}
            {message.isUser && (
              <div className="w-8 h-8 rounded-[var(--shape-full)] flex items-center justify-center text-xs font-bold flex-shrink-0 tonal-surface">
                U
              </div>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
      <div ref={chatContainerRef} />
    </ScrollArea>
  );
};

export default ChatDisplay;
