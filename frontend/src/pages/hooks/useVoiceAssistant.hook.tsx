"use client";

import { sendChatMessage, sendChatStream, getAIAudioFromText, fetchVoices, VoiceOption } from "@/pages/services/adk-assistant.service"
import { useRef, useState, useCallback, useEffect } from "react"

interface Message {
    text: string;
    isUser: boolean;
  }

const LANGUAGE_LOCALE_MAP: Record<string, string> = {
  'en-GB': 'en-US',
  'cmn-CN': 'cmn-CN',
  'Yue-HK': 'Yue-HK',
  'en-US': 'en-US',
  'ja-JP': 'ja-JP',
  'ko-KR': 'ko-KR',
  'fr-FR': 'fr-FR',
};

const FALLBACK_VOICES: Record<string, { female: string; male: string }> = {
  'en-US': { female: 'en-US-JennyNeural', male: 'en-US-GuyNeural' },
  'en-GB': { female: 'en-GB-SoniaNeural', male: 'en-GB-RyanNeural' },
  'cmn-CN': { female: 'zh-CN-XiaoxiaoNeural', male: 'zh-CN-YunxiNeural' },
  'Yue-HK': { female: 'zh-HK-HiuGaaiNeural', male: 'zh-HK-WanLungNeural' },
  'ja-JP': { female: 'ja-JP-NanamiNeural', male: 'ja-JP-KeitaNeural' },
  'ko-KR': { female: 'ko-KR-SunHiNeural', male: 'ko-KR-InJoonNeural' },
  'fr-FR': { female: 'fr-FR-DeniseNeural', male: 'fr-FR-HenriNeural' },
};

const PERSONALITY_PROMPTS: Record<string, string> = {
  playful: "Speak playfully with lots of emojis. Be warm, cute, and engaging. Short responses. Use ~ casually.",
  professional: "Be professional, clear, and concise. No emojis. Focus on accuracy and helpful information.",
  concise: "Answer in 1-2 sentences maximum. Direct and to the point. No pleasantries.",
};

export type Personality = 'playful' | 'professional' | 'concise';

const useVoiceAssistant = ()=>{
    const [isWaitingAIOutput,setIsWaitingAIOutput] = useState<boolean>(false)
    const [selectedLanguage, setSelectedLanguage] = useState<string>("en-GB");
    const [chatData, setChatData] = useState<Message[]>([]);
    const [inputText, setInputText] = useState('');
    const [mouthOpen, setMouthOpen] = useState(0);

    // Voice character selection
    const [voices, setVoices] = useState<VoiceOption[]>([]);
    const [selectedVoice, setSelectedVoice] = useState<string>('');
    const [selectedGender, setSelectedGender] = useState<string>('female');
    const [characterName, setCharacterName] = useState<string>('Xiao Wei');

    // UX enhancements
    const [personality, setPersonality] = useState<Personality>('playful');
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const [hasUsedVoice, setHasUsedVoice] = useState(false);

    // Audio playback
    const audioContextRef = useRef<AudioContext | null>(null);
    const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const rafIdRef = useRef<number | null>(null);
    const audioQueueRef = useRef<Blob[]>([]);
    const isPlayingRef = useRef(false);
    const generationRef = useRef(0);
    const cancelSSERef = useRef<(() => void) | null>(null);

    const getAudioContext = useCallback((): AudioContext => {
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.connect(audioContextRef.current.destination);
      }
      return audioContextRef.current;
    }, []);

  // Voice loading
  useEffect(() => {
    fetchVoices()
      .then(setVoices)
      .catch((err) => console.error('Failed to load voices:', err));
  }, []);

  // Auto-select voice
  useEffect(() => {
    const locale = LANGUAGE_LOCALE_MAP[selectedLanguage] || 'en-US';
    const matching = voices.filter(
      (v) => v.locale === locale && v.gender === selectedGender
    );
    if (matching.length > 0) {
      setSelectedVoice(matching[0].voice_id);
      const names = matching[0].popular_names;
      if (names && names.length > 0) {
        setCharacterName(names[0]);
      }
    } else {
      const fallback = FALLBACK_VOICES[selectedLanguage] || FALLBACK_VOICES['en-US'];
      setSelectedVoice(fallback[selectedGender as 'female' | 'male'] || fallback.female);
    }
  }, [selectedLanguage, selectedGender, voices]);

  const getActiveVoice = useCallback(() => {
    if (selectedVoice) return selectedVoice;
    const locale = LANGUAGE_LOCALE_MAP[selectedLanguage] || 'en-US';
    const fallback = FALLBACK_VOICES[selectedLanguage] || FALLBACK_VOICES['en-US'];
    return fallback[selectedGender as 'female' | 'male'] || fallback.female;
  }, [selectedVoice, selectedGender, selectedLanguage]);

  // Toast auto-dismiss
  useEffect(() => {
    if (toastMessage) {
      const t = setTimeout(() => setToastMessage(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toastMessage]);

  // ── Personality system prompt ─────────────────────────
  const getPersonalityPrompt = useCallback((): string => {
    return PERSONALITY_PROMPTS[personality] || PERSONALITY_PROMPTS.playful;
  }, [personality]);

  // ── Clear chat ────────────────────────────────────────
  const clearChat = useCallback(() => {
    cancelAll();
    setChatData([]);
    setToastMessage('Conversation cleared');
  }, []);

  // ── Path 1: Text chat ─────────────────────────────────
  const handleTextSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    cancelAll();

    const text = inputText;
    setInputText('');

    setChatData((prev) => [...prev, { text, isUser: true }]);
    setIsWaitingAIOutput(true);

    try {
      const { reply } = await sendChatMessage(text, characterName, getPersonalityPrompt());
      setChatData((prev) => [...prev, { text: reply, isUser: false }]);
    } catch (err) {
      console.error("Text chat error:", err);
      setChatData((prev) => [...prev, { text: "(Error getting reply)", isUser: false }]);
      setToastMessage("Connection error. Please try again.");
    } finally {
      setIsWaitingAIOutput(false);
    }
  };

  // ── Path 2: Voice chat ────────────────────────────────
  const startVoiceChat = (transcript: string) => {
    if (!transcript.trim()) return;

    cancelAll();
    const gen = ++generationRef.current;

    setChatData((prev) => [...prev, { text: transcript, isUser: true }]);
    setChatData((prev) => [...prev, { text: '', isUser: false }]);
    setIsWaitingAIOutput(true);

    const voice = getActiveVoice();

    const cancel = sendChatStream(
      transcript,
      (chunk) => {
        setChatData((prev) => {
          const updated = [...prev];
          const lastIdx = updated.length - 1;
          if (lastIdx >= 0 && !updated[lastIdx].isUser) {
            updated[lastIdx] = { text: updated[lastIdx].text + chunk, isUser: false };
          }
          return updated;
        });
      },
      async (sentence) => {
        try {
          const blob = await getAIAudioFromText(sentence, selectedLanguage, voice);
          if (generationRef.current !== gen) return;
          audioQueueRef.current.push(blob);
          playNextInQueue();
        } catch (err) {
          console.error("TTS error:", err);
        }
      },
      () => {
        setIsWaitingAIOutput(false);
      },
      (err) => {
        console.error("Voice chat error:", err);
        setIsWaitingAIOutput(false);
        setToastMessage("Voice chat error. Try typing instead.");
      },
    );

    cancelSSERef.current = cancel;
  };

  const handleSpeechRecognized = (transcript: string) => {
    if (!transcript.trim()) return;
    setHasUsedVoice(true);
    startVoiceChat(transcript);
  };

  // ── Cancel helpers ────────────────────────────────────
  const cancelAll = useCallback(() => {
    if (cancelSSERef.current) {
      cancelSSERef.current();
      cancelSSERef.current = null;
    }
    cancelPlayback();
  }, []);

  const cancelPlayback = useCallback(() => {
    if (currentSourceRef.current) {
      try { currentSourceRef.current.stop(); } catch {}
      currentSourceRef.current = null;
    }
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    audioQueueRef.current = [];
    isPlayingRef.current = false;
    setIsSpeaking(false);
    setMouthOpen(0);
  }, []);

  const playNextInQueue = useCallback(() => {
    if (isPlayingRef.current || audioQueueRef.current.length === 0) return;
    isPlayingRef.current = true;
    setIsSpeaking(true);

    const blob = audioQueueRef.current.shift();
    if (!blob) {
      isPlayingRef.current = false;
      setIsSpeaking(false);
      return;
    }

    const url = URL.createObjectURL(blob);

    speakFromBlob(url).then(() => {
      isPlayingRef.current = false;
      if (audioQueueRef.current.length === 0) {
        setIsSpeaking(false);
      }
      playNextInQueue();
    });
  }, []);

  const speakFromBlob = async (audioUrl: string): Promise<void> => {
    return new Promise((resolve) => {
      const audioContext = getAudioContext();

      if (currentSourceRef.current) {
        try { currentSourceRef.current.stop(); } catch {}
        currentSourceRef.current = null;
      }
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }

      fetch(audioUrl)
        .then((res) => res.arrayBuffer())
        .then((audioData) => audioContext.decodeAudioData(audioData))
        .then((audioBuffer) => {
          const source = audioContext.createBufferSource();
          currentSourceRef.current = source;

          const analyser = analyserRef.current!;
          source.buffer = audioBuffer;
          source.connect(analyser);

          source.start(0);

          const updateMouth = () => {
            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            analyser.getByteFrequencyData(dataArray);
            const volume = dataArray.reduce((a, b) => a + b) / dataArray.length;
            setMouthOpen(Math.min(1, volume / 50));

            if (audioContext.state !== "closed") {
              rafIdRef.current = requestAnimationFrame(updateMouth);
            }
          };
          updateMouth();

          source.onended = () => {
            URL.revokeObjectURL(audioUrl);
            rafIdRef.current = null;
            setMouthOpen(0);
            resolve();
          };
        })
        .catch((err) => {
          console.error("speakFromBlob error:", err);
          setMouthOpen(0);
          resolve();
        });
    });
  };

  // Cleanup AudioContext on unmount
  useEffect(() => {
    return () => {
      cancelPlayback();
      if (audioContextRef.current) {
        try { audioContextRef.current.close(); } catch {}
        audioContextRef.current = null;
        analyserRef.current = null;
      }
    };
  }, [cancelPlayback]);

  // ── Keyboard shortcuts (global) ───────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't intercept if user is typing
      const active = document.activeElement;
      const isInput = active?.tagName === 'INPUT' || active?.tagName === 'TEXTAREA' || (active as HTMLElement)?.isContentEditable;

      // Escape: cancel streaming / speaking
      if (e.key === 'Escape' && !isInput) {
        cancelAll();
        if (isWaitingAIOutput) setIsWaitingAIOutput(false);
        return;
      }

      // Space: toggle recording (only when NOT typing in an input)
      if (e.key === ' ' && !isInput && !isWaitingAIOutput) {
        e.preventDefault();
        // Dispatch to VoiceRecorder — this is handled by the VoiceRecorder's own listener
        window.dispatchEvent(new CustomEvent('toggle-recording'));
        return;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [cancelAll, isWaitingAIOutput]);

  // ── Other handlers ────────────────────────────────────
  const handleLanguageChange = (language: string) => {
    setSelectedLanguage(language);
  };

  const handleGenderChange = (gender: string) => {
    setSelectedGender(gender);
  };

  const handleVoiceSelect = (voice_id: string) => {
    setSelectedVoice(voice_id);
    const match = voices.find((v) => v.voice_id === voice_id);
    if (match && match.popular_names.length > 0) {
      setCharacterName(match.popular_names[0]);
    }
  };

  const handleCharacterNameChange = (name: string) => {
    setCharacterName(name);
  };

  const handlePersonalityChange = (p: Personality) => {
    setPersonality(p);
    setToastMessage(`Switched to ${p} mode ✨`);
  };

  return {
    handleSpeechRecognized,
    isWaitingAIOutput,
    selectedLanguage,
    handleLanguageChange,
    chatData,
    inputText,
    setInputText,
    handleTextSubmit,
    mouthOpen,
    voices,
    selectedVoice,
    selectedGender,
    handleGenderChange,
    handleVoiceSelect,
    characterName,
    handleCharacterNameChange,
    // UX additions
    personality,
    handlePersonalityChange,
    isSpeaking,
    toastMessage,
    clearChat,
    hasUsedVoice,
  };
};

export default useVoiceAssistant;
