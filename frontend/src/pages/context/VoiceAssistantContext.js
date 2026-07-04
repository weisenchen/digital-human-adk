"use client";

import { createContext } from "react";

const VoiceAssistantContext = createContext({
  handleSpeechRecognized: (t) => {},
  isWaitingAIOutput: false,
  selectedLanguage: "en-US",
  handleLanguageChange: (l) => {},
  chatData: [],
  inputText: "",
  setInputText: (t) => {},
  handleTextSubmit: (e) => {},
  mouthOpen: 0,
  voices: [],
  selectedVoice: "",
  selectedGender: "female",
  handleGenderChange: (g) => {},
  handleVoiceSelect: (v) => {},
  characterName: "Xiao Wei",
  handleCharacterNameChange: (n) => {},
  // UX enhancements
  isSpeaking: false,
  toastMessage: null,
  clearChat: () => {},
  hasUsedVoice: false,
  // Model selection
  models: [],
  selectedModel: "gemini-2.5-flash",
  handleModelSelect: (m) => {},
});

export default VoiceAssistantContext;
