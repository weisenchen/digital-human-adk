"use client";

import ConversationContainer from './components/ConversationContainer/ConversationContainer.component';
import SettingsSidebar from './components/SettingsSidebar/SettingsSidebar.component';
import VoiceAssistantProvider from './context/VoiceAssistantProvider';

export default function Home() {
  return (
    <VoiceAssistantProvider>
      <div className="min-h-screen bg-white flex">
        {/* Left sidebar (always visible) */}
        <SettingsSidebar />

        {/* Main content */}
        <main className="flex-1 flex flex-col min-h-0 min-w-0">
          <div className="flex-1 flex flex-col min-h-0 max-w-3xl mx-auto w-full px-4">
            <ConversationContainer />
          </div>
        </main>
      </div>
    </VoiceAssistantProvider>
  );
}
