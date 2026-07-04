"use client";

import HeaderContainer from './components/HeaderContainer/HeaderContainer.component';
import ConversationContainer from './components/ConversationContainer/ConversationContainer.component';
import DigitalHumanContainer from './components/DigitalHumanContainer/DigitalHumanContainer.component';
import VoiceAssistantProvider from './context/VoiceAssistantProvider';

export default function Home() {
  return (
    <VoiceAssistantProvider>
      <div className="min-h-screen bg-gradient-to-br from-[var(--md-background)] to-[var(--md-surface-variant)]">
        <HeaderContainer />
        <main className="container mx-auto px-4 py-4 lg:py-6 max-w-7xl">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 h-[calc(100vh-8rem)]">
            <div className="lg:col-span-7 order-1 lg:order-1">
              <DigitalHumanContainer />
            </div>
            <div className="lg:col-span-5 order-2 lg:order-2">
              <ConversationContainer />
            </div>
          </div>
        </main>
      </div>
    </VoiceAssistantProvider>
  );
}
