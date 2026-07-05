"use client";

import { useState } from 'react';
import { BookOpen } from 'lucide-react';
import ConversationContainer from './components/ConversationContainer/ConversationContainer.component';
import CyborgSidebar from './components/CyborgSidebar/CyborgSidebar.component';
import PresentationMode from './components/PresentationMode/PresentationMode.component';
import VoiceAssistantProvider from './context/VoiceAssistantProvider';
import { SlideData } from '@/services/adk-assistant.service';

export default function Home() {
  const [showCyborg, setShowCyborg] = useState(false);

  // Presentation overlay state (triggered from CyborgSidebar AI Generate)
  const [presentationSlides, setPresentationSlides] = useState<SlideData[] | null>(null);
  const [presentationMinutes, setPresentationMinutes] = useState(10);
  const [showPresentation, setShowPresentation] = useState(false);

  const handleOpenPresentation = (slides: SlideData[], totalMinutes: number) => {
    setPresentationSlides(slides);
    setPresentationMinutes(totalMinutes);
    setShowPresentation(true);
  };

  return (
    <VoiceAssistantProvider>
      <div className="min-h-screen bg-white flex">
        {/* Cyborg sidebar */}
        {showCyborg && (
          <CyborgSidebar
            onClose={() => setShowCyborg(false)}
            onOpenPresentation={handleOpenPresentation}
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
                title="Open Cyborg"
              >
                <BookOpen className="w-5 h-5" />
                <span className="hidden sm:inline">Cyborg</span>
              </button>
            )}
          </div>

          {/* Chat area */}
          <div className="flex-1 flex flex-col min-h-0 max-w-3xl mx-auto w-full px-4">
            <ConversationContainer />
          </div>
        </main>

        {/* Presentation overlay (full-screen) */}
        {showPresentation && presentationSlides && (
          <PresentationMode
            characterName="Xiao Wei"
            voiceId=""
            language="en"
            onClose={() => setShowPresentation(false)}
          />
        )}
      </div>
    </VoiceAssistantProvider>
  );
}
