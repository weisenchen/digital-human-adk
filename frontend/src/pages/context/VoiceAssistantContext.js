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
  voices: [],
  selectedVoice: "",
  selectedGender: "female",
  handleGenderChange: (gender: string) => {},
  handleVoiceSelect: (voice_id: string) => {},
  characterName: "Xiao Wei",
  handleCharacterNameChange: (name: string) => {},
  // UX enhancements
  personality: "playful",
  handlePersonalityChange: (p: string) => {},
  isSpeaking: false,
  toastMessage: null,
  clearChat: () => {},
  hasUsedVoice: false,
});

export default VoiceAssistantContext;
