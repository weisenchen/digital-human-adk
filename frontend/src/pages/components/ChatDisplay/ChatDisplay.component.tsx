"use client";

import React, { useRef, useEffect, useContext, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import VoiceAssistantContext from '../../context/VoiceAssistantContext';

interface ChatMessage {
  text: string;
  isUser: boolean;
}

interface ChatDisplayProps {
  chatData: ChatMessage[];
}

const ChatDisplay: React.FC<ChatDisplayProps> = ({ chatData }) => {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const [userScrolledUp, setUserScrolledUp] = useState(false);
  const context = useContext(VoiceAssistantContext);
  const characterName = context?.characterName || 'Xiao Wei';
  const isSpeaking = context?.isSpeaking || false;
  const aiInitial = characterName.charAt(0).toUpperCase();

  // Check if user has scrolled away from bottom
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const threshold = 60;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setUserScrolledUp(distFromBottom > threshold);
  }, []);

  // Auto-scroll only when user hasn't scrolled up
  useEffect(() => {
    if (!userScrolledUp && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatData, userScrolledUp]);

  // Scroll to bottom when user clicks "New messages"
  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    setUserScrolledUp(false);
  };

  const isStreaming = chatData.length > 0 &&
    !chatData[chatData.length - 1].isUser &&
    chatData[chatData.length - 1].text === '';

  return (
    <div className="flex flex-col flex-grow min-h-0 relative">
      {/* Scrollable chat area */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-grow overflow-y-auto mb-2 pr-1 custom-scrollbar space-y-3"
      >
        <AnimatePresence initial={false}>
          {chatData.map((message, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: [0.2, 0, 0, 1.0] }}
              className={`flex items-start gap-2.5 ${
                message.isUser ? 'justify-end' : 'justify-start'
              }`}
            >
              {/* AI avatar */}
              {!message.isUser && (
                <div className={`w-8 h-8 rounded-[var(--shape-full)] flex items-center justify-center text-xs font-bold flex-shrink-0 shadow-sm tonal-surface ${isSpeaking ? 'ring-2 ring-[var(--md-primary)] ring-offset-1' : ''}`}>
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

              {/* User avatar */}
              {message.isUser && (
                <div className="w-8 h-8 rounded-[var(--shape-full)] flex items-center justify-center text-xs font-bold flex-shrink-0 tonal-surface">
                  U
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>

      {/* Speaking waveform indicator */}
      {isSpeaking && !isStreaming && (
        <div className="flex items-center gap-1.5 px-1 py-1">
          <div className="flex items-end gap-[3px] h-3">
            <motion.div
              className="w-[3px] bg-[var(--md-primary)] rounded-full"
              animate={{ height: [4, 10, 4] }}
              transition={{ duration: 0.4, repeat: Infinity, ease: [0.2,0,0,1.0] }}
            />
            <motion.div
              className="w-[3px] bg-[var(--md-tertiary)] rounded-full"
              animate={{ height: [8, 14, 8] }}
              transition={{ duration: 0.4, repeat: Infinity, delay: 0.1, ease: [0.2,0,0,1.0] }}
            />
            <motion.div
              className="w-[3px] bg-[var(--md-primary)] rounded-full"
              animate={{ height: [4, 10, 4] }}
              transition={{ duration: 0.4, repeat: Infinity, delay: 0.2, ease: [0.2,0,0,1.0] }}
            />
          </div>
          <span className="text-label-sm text-[var(--md-on-surface-variant)]">
            Speaking...
          </span>
        </div>
      )}

      {/* "New messages" floating button */}
      {userScrolledUp && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-[var(--md-primary)] text-white text-label-sm px-4 py-1.5 rounded-[var(--shape-full)] shadow-elevation-3 hover:shadow-elevation-4 transition-all duration-[var(--motion-sm)] z-10"
        >
          ↓ New messages
        </button>
      )}
    </div>
  );
};

export default ChatDisplay;
