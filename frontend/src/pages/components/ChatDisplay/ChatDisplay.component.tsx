"use client";

import React, { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ScrollArea } from "@/components/ui/scroll-area";

interface ChatMessage {
  text: string;
  isUser: boolean;
}

interface ChatDisplayProps {
  chatData: ChatMessage[];
}

const ChatDisplay: React.FC<ChatDisplayProps> = ({ chatData }) => {
  const chatContainerRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Scroll whenever new messages are added
  useEffect(() => {
    scrollToBottom();
  }, [chatData]);

  // Check if the last AI message is still streaming (empty text placeholder)
  const isStreaming = chatData.length > 0 &&
    !chatData[chatData.length - 1].isUser &&
    chatData[chatData.length - 1].text === '';

  return (
    <ScrollArea className="flex-grow mb-4 pr-2 custom-scrollbar">
      <AnimatePresence initial={false}>
        {chatData.map((message, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className={`mb-3 flex items-start gap-2.5 ${
              message.isUser ? 'justify-end' : 'justify-start'
            }`}
          >
            {/* Xiao Wei avatar (AI messages only) */}
            {!message.isUser && (
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#6B46C1] to-[#667EEA] flex items-center justify-center text-white text-xs font-bold flex-shrink-0 shadow-sm">
                XW
              </div>
            )}

            {/* Message bubble */}
            <div
              className={`max-w-[85%] px-4 py-2.5 leading-relaxed ${
                message.isUser
                  ? 'bg-[#EDF2F7] text-[#1A202C] rounded-2xl rounded-br-md'
                  : 'bg-[#EBF4FF] text-[#1A202C] rounded-2xl rounded-bl-md'
              } ${
                // Show streaming cursor on the last AI message if it's empty (still loading)
                index === chatData.length - 1 && !message.isUser && message.text === ''
                  ? 'streaming-cursor'
                  : ''
              }`}
            >
              <p className="text-sm md:text-base">
                {message.text || (index === chatData.length - 1 && !message.isUser ? '' : message.text)}
              </p>
            </div>

            {/* User avatar placeholder */}
            {message.isUser && (
              <div className="w-8 h-8 rounded-full bg-[#A0AEC0] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
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
