"use client";

import LanguageSelector from '../LanguageSelector/LanguageSelector.component';
import { useContext } from 'react';
import VoiceAssistantContext from '../../context/VoiceAssistantContext';
import { GraduationCap } from 'lucide-react'; 

const HeaderContainer = () => {
    const {selectedLanguage, handleLanguageChange,} = useContext(VoiceAssistantContext);
    
    return (
      <header className="bg-white bg-opacity-90 backdrop-blur-sm border-b border-[#E2E8F0]">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between max-w-7xl">
          <div className="flex items-center">
            <span className="flex items-center text-xl lg:text-2xl font-bold text-[#1A202C]">
              <GraduationCap className="w-7 h-7 lg:w-8 h-8 mr-2 text-[#6B46C1]" />
              Xiao Wei
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
