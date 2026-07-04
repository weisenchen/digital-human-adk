"use client";

import ConversationContainer from './components/ConversationContainer/ConversationContainer.component';
import VoiceAssistantProvider from './context/VoiceAssistantProvider';

export default function Home() {
  return (
    <VoiceAssistantProvider>
      <div className="min-h-screen bg-white flex flex-col">
        <main className="flex-1 flex flex-col min-h-0 max-w-3xl mx-auto w-full px-4">
          <ConversationContainer />
        </main>
      </div>
    </VoiceAssistantProvider>
  );
}
