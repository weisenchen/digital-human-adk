"use client";

import { createContext } from "react";

const VoiceAssistantContext = createContext({
  handleSpeechRecognized: (transcript: string) => {},
  isWaitingAIOutput: false,
  selectedLanguage: "en-GB",
  handleLanguageChange: (language: string) => {},
  chatData: [],
  inputText: "",
  setInputText: (text: string) => {},
  handleTextSubmit: (e: React.FormEvent) => {},
  mouthOpen: 0,
  // Voice character
  voices: [],
  selectedVoice: "",
  selectedGender: "female",
  handleGenderChange: (gender: string) => {},
  handleVoiceSelect: (voice_id: string) => {},
  characterName: "Xiao Wei",
  handleCharacterNameChange: (name: string) => {},
});

export default VoiceAssistantContext;
