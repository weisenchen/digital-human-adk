"use client";

import { useState } from 'react';
import { Menu, MessageSquarePlus, BookOpen, Sparkles } from 'lucide-react';
import ConversationContainer from './components/ConversationContainer/ConversationContainer.component';
import SettingsSidebar from './components/SettingsSidebar/SettingsSidebar.component';
import VoiceAssistantProvider from './context/VoiceAssistantProvider';

export default function Home() {
  const [showSidebar, setShowSidebar] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const handleNewConversation = () => {
    setShowMenu(false);
    // Trigger clear via context — the button dispatches a custom event
    window.dispatchEvent(new CustomEvent('new-conversation'));
  };

  const handleReadScript = () => {
    setShowMenu(false);
    window.dispatchEvent(new CustomEvent('open-presentation'));
  };

  const handleOpenSettings = () => {
    setShowMenu(false);
    setShowSidebar(true);
  };

  return (
    <VoiceAssistantProvider>
      <div className="min-h-screen bg-white flex">
        {/* Left sidebar (settings) */}
        {showSidebar && (
          <SettingsSidebar onClose={() => setShowSidebar(false)} />
        )}

        {/* Main content */}
        <main className="flex-1 flex flex-col min-h-0 min-w-0">
          {/* Top bar with hamburger menu */}
          <div className="flex items-center px-4 py-2 border-b border-gray-100 relative">
            {!showSidebar && (
              <>
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500 transition-colors"
                  title="Menu"
                >
                  <Menu className="w-5 h-5" />
                </button>

                {/* Dropdown menu */}
                {showMenu && (
                  <>
                    {/* Backdrop to close on outside click */}
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setShowMenu(false)}
                    />
                    <div className="absolute top-full left-2 mt-1 w-56 bg-white rounded-xl shadow-elevation-3 border border-gray-100 py-1.5 z-20">
                      <button
                        onClick={handleNewConversation}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        <MessageSquarePlus className="w-4 h-4 text-gray-400" />
                        New Conversation
                      </button>
                      <button
                        onClick={handleReadScript}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        <BookOpen className="w-4 h-4 text-gray-400" />
                        Read Script
                      </button>
                      <div className="border-t border-gray-100 my-1" />
                      <button
                        onClick={handleOpenSettings}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        <Sparkles className="w-4 h-4 text-gray-400" />
                        Settings
                      </button>
                    </div>
                  </>
                )}
              </>
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
