"use client";

import { useState, useEffect } from 'react';
import { Menu } from 'lucide-react';
import ConversationContainer from './components/ConversationContainer/ConversationContainer.component';
import DigitalHumanContainer from './components/DigitalHumanContainer/DigitalHumanContainer.component';
import CyborgSidebar from './components/CyborgSidebar/CyborgSidebar.component';
import VoiceAssistantProvider from './context/VoiceAssistantProvider';
import TalkShowSetup from './components/TalkShow/TalkShowSetup.component';
import TalkShowMode from './components/TalkShow/TalkShowMode.component';
import MeetingSetup from './components/MeetingMode/MeetingSetup.component';
import MeetingMode from './components/MeetingMode/MeetingMode.component';
import type { MeetingConfig } from './components/MeetingMode/MeetingSetup.component';

interface TalkShowConfig {
  topic: string;
  guestName: string;
  hostName: string;
  background: string;
  questions: string;
  personality: string;
  durationMinutes: number;
}

export default function Home() {
  const [showCyborg, setShowCyborg] = useState(false);
  const [showTalkShowSetup, setShowTalkShowSetup] = useState(false);
  const [talkShowConfig, setTalkShowConfig] = useState<TalkShowConfig | null>(null);
  const [showMeetingSetup, setShowMeetingSetup] = useState(false);
  const [meetingConfig, setMeetingConfig] = useState<MeetingConfig | null>(null);

  // Listen for open-talk-show event from sidebar
  useEffect(() => {
    const handler = () => setShowTalkShowSetup(true);
    window.addEventListener('open-talk-show', handler);
    return () => window.removeEventListener('open-talk-show', handler);
  }, []);

  // Listen for open-meeting event from sidebar
  useEffect(() => {
    const handler = () => setShowMeetingSetup(true);
    window.addEventListener('open-meeting', handler);
    return () => window.removeEventListener('open-meeting', handler);
  }, []);

  return (
    <VoiceAssistantProvider>
      <div className="h-screen flex flex-col bg-[var(--md-background)]">
        {/* ===== Top Bar ===== */}
        <TopBar showCyborg={showCyborg} onToggleCyborg={() => setShowCyborg(prev => !prev)} />

        {/* ===== Main Content ===== */}
        {meetingConfig ? (
          <MeetingMode
            config={meetingConfig}
            onEnd={() => setMeetingConfig(null)}
          />
        ) : !talkShowConfig ? (
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
            personality={talkShowConfig.personality}
            durationMinutes={talkShowConfig.durationMinutes}
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

      {/* Meeting Setup modal */}
      {showMeetingSetup && (
        <MeetingSetup
          onStart={(config) => {
            setMeetingConfig(config);
            setShowMeetingSetup(false);
            setShowCyborg(false);
          }}
          onClose={() => setShowMeetingSetup(false)}
        />
      )}
    </VoiceAssistantProvider>
  );
}

function TopBar({ showCyborg, onToggleCyborg }: { showCyborg: boolean; onToggleCyborg: () => void }) {
  return (
    <header className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-[var(--md-outline)] bg-white/80 backdrop-blur-md shrink-0 z-20">
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleCyborg}
          className="state-layer p-2 rounded-[var(--shape-full)] text-[var(--md-on-surface-variant)] hover:bg-[var(--md-surface-variant)] transition-colors"
          title="Open Sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>
        <img src="/logo.svg" alt="NOVA" className="h-6 w-auto hidden sm:block" />
      </div>
    </header>
  );
}
