"use client";

import { useState, useContext, useEffect } from 'react';
import { Menu } from 'lucide-react';
import ConversationContainer from './components/ConversationContainer/ConversationContainer.component';
import CyborgSidebar from './components/CyborgSidebar/CyborgSidebar.component';
import PresentationMode from './components/PresentationMode/PresentationMode.component';
import VoiceAssistantProvider from './context/VoiceAssistantProvider';
import VoiceAssistantContext from './context/VoiceAssistantContext';

/** Wraps PresentationMode with context values for voiceId + language */
function PresentationWrapper({ onClose }: { onClose: () => void }) {
  const ctx = useContext(VoiceAssistantContext);
  return (
    <PresentationMode
      characterName={ctx?.characterName || 'Xiao Wei'}
      voiceId={ctx?.selectedVoice || ''}
      language={ctx?.selectedLanguage || 'en'}
      onClose={onClose}
    />
  );
}

export default function Home() {
  const [showCyborg, setShowCyborg] = useState(false);
  const [showPresentation, setShowPresentation] = useState(false);

  useEffect(() => {
    const handler = () => setShowPresentation(true);
    window.addEventListener('open-presentation', handler);
    return () => window.removeEventListener('open-presentation', handler);
  }, []);

  return (
    <VoiceAssistantProvider>
      <div className="min-h-screen bg-white flex">
        {/* Cyborg sidebar */}
        {showCyborg && (
          <CyborgSidebar
            onClose={() => setShowCyborg(false)}
          />
        )}

        {/* Main content */}
        <main className="flex-1 flex flex-col min-h-0 min-w-0">
          {/* Top bar */}
          <div className="flex items-center px-4 py-2 border-b border-gray-100 relative">
            {!showCyborg && (
              <button
                onClick={() => setShowCyborg(true)}
                className="flex items-center gap-1.5 p-1.5 rounded-md hover:bg-gray-100 text-gray-500 transition-colors text-sm"
                title="Open Sidebar"
              >
                <Menu className="w-5 h-5" />
                <span className="hidden sm:inline">Sidebar</span>
              </button>
            )}
          </div>

          {/* Chat area */}
          <div className="flex-1 flex flex-col min-h-0 max-w-3xl mx-auto w-full px-4">
            <ConversationContainer />
          </div>
        </main>

        {/* Presentation overlay (full-screen) */}
        {showPresentation && (
          <PresentationWrapper
            onClose={() => setShowPresentation(false)}
          />
        )}
      </div>
    </VoiceAssistantProvider>
  );
}
