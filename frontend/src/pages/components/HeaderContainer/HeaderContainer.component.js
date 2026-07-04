"use client";

import LanguageSelector from '../LanguageSelector/LanguageSelector.component';
import { useContext } from 'react';
import VoiceAssistantContext from '../../context/VoiceAssistantContext';
import { Sparkles } from 'lucide-react'; 

const HeaderContainer = () => {
    const {selectedLanguage, handleLanguageChange, characterName} = useContext(VoiceAssistantContext);
    
    return (
      <header className="bg-white bg-opacity-95 backdrop-blur-sm border-b border-[var(--md-outline)] surface-elevation-1">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between max-w-7xl">
          <div className="flex items-center">
            <span className="flex items-center text-xl lg:text-2xl font-bold text-[var(--md-on-surface)]">
              <Sparkles className="w-6 h-6 lg:w-7 lg:h-7 mr-2 text-[var(--md-primary)]" />
              {characterName || 'Xiao Wei'}
            </span>
          </div>
          <LanguageSelector
            selectedLanguage={selectedLanguage}
            onLanguageChange={handleLanguageChange}
         />
        </div>
      </header>
    );
  }

export default HeaderContainer;
