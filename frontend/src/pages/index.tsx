"use client";

import HeaderContainer from './components/HeaderContainer/HeaderContainer.component';
import ConversationContainer from './components/ConversationContainer/ConversationContainer.component';
import DigitalHumanContainer from './components/DigitalHumanContainer/DigitalHumanContainer.component';
import VoiceAssistantProvider from './context/VoiceAssistantProvider';

export default function Home() {
  return (
    <VoiceAssistantProvider>
      <div className="min-h-screen bg-gradient-to-br from-[var(--md-background)] to-[var(--md-surface-variant)] flex flex-col">
        <HeaderContainer />
        <main className="container mx-auto px-3 sm:px-4 py-3 sm:py-4 lg:py-6 max-w-7xl flex-1 flex flex-col min-h-0">
          {/* Mobile: flex column. Desktop: grid */}
          <div className="flex flex-col lg:grid lg:grid-cols-12 gap-3 sm:gap-4 lg:gap-6 flex-1 min-h-0">

            {/* Avatar panel — small on mobile, 7 cols on desktop */}
            <div className="lg:col-span-7 max-lg:h-44 max-sm:h-36 max-lg:flex-shrink-0">
              <DigitalHumanContainer />
            </div>

            {/* Chat panel — fills rest on mobile, 5 cols on desktop */}
            <div className="lg:col-span-5 flex flex-col min-h-0 max-lg:flex-1">
              <ConversationContainer />
            </div>

          </div>
        </main>
      </div>
    </VoiceAssistantProvider>
  );
}
