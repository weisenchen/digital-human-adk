"use client";

import { useState, useEffect } from 'react';
import { Menu } from 'lucide-react';
import ConversationContainer from './components/ConversationContainer/ConversationContainer.component';
import DigitalHumanContainer from './components/DigitalHumanContainer/DigitalHumanContainer.component';
import CyborgSidebar from './components/CyborgSidebar/CyborgSidebar.component';
import VoiceAssistantProvider from './context/VoiceAssistantProvider';
import TalkShowSetup from './components/TalkShow/TalkShowSetup.component';
import TalkShowMode from './components/TalkShow/TalkShowMode.component';

interface TalkShowConfig {
  topic: string;
  guestName: string;
  hostName: string;
  background: string;
  questions: string;
}

export default function Home() {
  const [showCyborg, setShowCyborg] = useState(false);
  const [showTalkShowSetup, setShowTalkShowSetup] = useState(false);
  const [talkShowConfig, setTalkShowConfig] = useState<TalkShowConfig | null>(null);

  // Listen for open-talk-show event from sidebar
  useEffect(() => {
    const handler = () => setShowTalkShowSetup(true);
    window.addEventListener('open-talk-show', handler);
    return () => window.removeEventListener('open-talk-show', handler);
  }, []);

  return (
    <VoiceAssistantProvider>
      <div className="h-screen flex flex-col bg-[var(--md-background)]">
        {/* ===== Top Bar ===== */}
        <header className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-[var(--md-outline)] bg-white/80 backdrop-blur-md shrink-0 z-20">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowCyborg(true)}
              className="state-layer p-2 rounded-[var(--shape-full)] text-[var(--md-on-surface-variant)] hover:bg-[var(--md-surface-variant)] transition-colors"
              title="Open Sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="text-title-sm text-[var(--md-on-surface)] font-[family-name:var(--font-serif)] text-lg hidden sm:inline">
              Xiao Wei
            </span>
          </div>
        </header>

        {/* ===== Main Content ===== */}
        {!talkShowConfig ? (
          <div className="flex-1 flex min-h-0">
            {/* Cyborg sidebar */}
            {showCyborg && (
              <CyborgSidebar
                onClose={() => setShowCyborg(false)}
              />
            )}

            {/* Left: Avatar panel (hidden on mobile) */}
            <div className="hidden lg:flex lg:w-[55%] xl:w-[60%] flex-col items-center justify-center p-8 bg-gradient-to-b from-white to-[var(--md-surface-variant)] border-r border-[var(--md-outline)]">
              <div className="w-full max-w-lg aspect-[3/4] relative">
                <DigitalHumanContainer />
              </div>
            </div>

            {/* Right: Chat panel */}
            <div className="flex-1 flex flex-col min-w-0 bg-white">
              <ConversationContainer />
            </div>
          </div>
        ) : (
          <TalkShowMode
            topic={talkShowConfig.topic}
            guestName={talkShowConfig.guestName}
            hostName={talkShowConfig.hostName}
            background={talkShowConfig.background}
            questions={talkShowConfig.questions}
            onEnd={() => setTalkShowConfig(null)}
          />
        )}
      </div>

      {/* Talk Show Setup modal */}
      {showTalkShowSetup && (
        <TalkShowSetup
          defaultHostName=""
          onStart={(config) => {
            setTalkShowConfig(config);
            setShowTalkShowSetup(false);
            setShowCyborg(false);
          }}
          onClose={() => setShowTalkShowSetup(false)}
        />
      )}
    </VoiceAssistantProvider>
  );
}
