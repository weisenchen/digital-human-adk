"use client";

import { createContext } from "react";

const VoiceAssistantContext = createContext({
  handleSpeechRecognized: () => {},
  isWaitingAIOutput: false,
  selectedLanguage: "en-GB",
  handleLanguageChange: () => {},
  chatData: [],
  inputText: "",
  setInputText: () => {},
  handleTextSubmit: () => {},
  mouthOpen: 0,
  voices: [],
  selectedVoice: "",
  selectedGender: "female",
  handleGenderChange: () => {},
  handleVoiceSelect: () => {},
  characterName: "Xiao Wei",
  handleCharacterNameChange: () => {},
  // UX enhancements
  personality: "playful",
  handlePersonalityChange: () => {},
  isSpeaking: false,
  toastMessage: null,
  clearChat: () => {},
  hasUsedVoice: false,
});

export default VoiceAssistantContext;
