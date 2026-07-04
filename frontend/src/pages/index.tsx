"use client";

import { useState } from 'react';
import { Menu } from 'lucide-react';
import ConversationContainer from './components/ConversationContainer/ConversationContainer.component';
import SettingsSidebar from './components/SettingsSidebar/SettingsSidebar.component';
import VoiceAssistantProvider from './context/VoiceAssistantProvider';

export default function Home() {
  const [showSidebar, setShowSidebar] = useState(false);

  return (
    <VoiceAssistantProvider>
      <div className="min-h-screen bg-white flex">
        {/* Left sidebar (toggle with hamburger) */}
        {showSidebar && (
          <SettingsSidebar onClose={() => setShowSidebar(false)} />
        )}

        {/* Main content */}
        <main className="flex-1 flex flex-col min-h-0 min-w-0">
          {/* Top bar with hamburger toggle (hidden when sidebar is open) */}
          <div className="flex items-center px-4 py-2 border-b border-gray-100">
            {!showSidebar && (
              <button
                onClick={() => setShowSidebar(true)}
                className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500 transition-colors"
                title="Open settings"
              >
                <Menu className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Chat area */}
          <div className="flex-1 flex flex-col min-h-0 max-w-3xl mx-auto w-full px-4">
            <ConversationContainer />
          </div>
        </main>
      </div>
    </VoiceAssistantProvider>
  );
}
