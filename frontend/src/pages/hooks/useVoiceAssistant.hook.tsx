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

const useVoiceAssistant = ()=>{
    const [isWaitingAIOutput,setIsWaitingAIOutput] = useState<boolean>(false)
    const [selectedLanguage, setSelectedLanguage] = useState<string>("en-GB");
    const [chatData, setChatData] = useState<Message[]>([]);
    const [inputText, setInputText] = useState('');
    const [mouthOpen, setMouthOpen] = useState(0);

    // Voice character selection
    const [voices, setVoices] = useState<VoiceOption[]>([]);
    const [selectedVoice, setSelectedVoice] = useState<string>('');    // voice_id
    const [selectedGender, setSelectedGender] = useState<string>('female');
    const [characterName, setCharacterName] = useState<string>('Xiao Wei');

    // Audio playback queue
    const audioQueueRef = useRef<Blob[]>([]);
    const isPlayingRef = useRef(false);
    const audioContextRef = useRef<AudioContext | null>(null);
    const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);
    const generationRef = useRef(0);
    /** Stores the cancel function for the current SSE stream */
    const cancelSSERef = useRef<(() => void) | null>(null);

  // ─────────────────────────────────────────────
  // Load voices from backend on mount
  // ─────────────────────────────────────────────
  useEffect(() => {
    fetchVoices()
      .then(setVoices)
      .catch((err) => console.error('Failed to load voices:', err));
  }, []);

  // Auto-select a voice when language or gender changes
  useEffect(() => {
    const locale = LANGUAGE_LOCALE_MAP[selectedLanguage] || 'en-US';
    // If we have voices from the server, pick the first matching voice for the locale+gender
    const matching = voices.filter(
      (v) => v.locale === locale && v.gender === selectedGender
    );
    if (matching.length > 0) {
      setSelectedVoice(matching[0].voice_id);
      // Also update character name from popular_names
      const names = matching[0].popular_names;
      if (names && names.length > 0) {
        setCharacterName(names[0]);
      }
    } else {
      // Fallback to hardcoded defaults
      const fallback = FALLBACK_VOICES[selectedLanguage] || FALLBACK_VOICES['en-US'];
      setSelectedVoice(fallback[selectedGender as 'female' | 'male'] || fallback.female);
    }
  }, [selectedLanguage, selectedGender, voices]);

  // Derive the active voice_id for TTS calls
  const getActiveVoice = useCallback(() => {
    if (selectedVoice) return selectedVoice;
    const locale = LANGUAGE_LOCALE_MAP[selectedLanguage] || 'en-US';
    const fallback = FALLBACK_VOICES[selectedLanguage] || FALLBACK_VOICES['en-US'];
    return fallback[selectedGender as 'female' | 'male'] || fallback.female;
  }, [selectedVoice, selectedGender, selectedLanguage]);

  // ─────────────────────────────────────────────
  // Path 1: Text chat (POST /chat, non-streaming)
  // ─────────────────────────────────────────────
  const handleTextSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    cancelAll(); // Cancel any ongoing SSE + audio

    const text = inputText;
    setInputText('');

    setChatData((prev) => [...prev, { text, isUser: true }]);
    setIsWaitingAIOutput(true);

    try {
      const { reply } = await sendChatMessage(text);
      setChatData((prev) => [...prev, { text: reply, isUser: false }]);
    } catch (err) {
      console.error("Text chat error:", err);
      setChatData((prev) => [...prev, { text: "(Error getting reply)", isUser: false }]);
    } finally {
      setIsWaitingAIOutput(false);
    }
  };

  // ─────────────────────────────────────────────
  // Path 2: Voice chat (POST /run_sse, streaming)
  // ─────────────────────────────────────────────
  const startVoiceChat = (transcript: string) => {
    cancelAll(); // Cancel previous SSE + audio
    const gen = ++generationRef.current;

    setChatData((prev) => [...prev, { text: transcript, isUser: true }]);
    setChatData((prev) => [...prev, { text: '', isUser: false }]);
    setIsWaitingAIOutput(true);

    const voice = getActiveVoice();

    const cancel = sendChatStream(
      transcript,
      // onToken
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
      // onSentence
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
      // onComplete
      () => {
        setIsWaitingAIOutput(false);
      },
      // onError
      (err) => {
        console.error("Voice chat error:", err);
        setIsWaitingAIOutput(false);
      },
    );

    cancelSSERef.current = cancel;
  };

  const handleSpeechRecognized = (transcript: string) => {
    if (!transcript.trim()) return;
    startVoiceChat(transcript);
  };

  // ─────────────────────────────────────────────
  // Cancel helpers
  // ─────────────────────────────────────────────
  /** Cancel both SSE stream and audio playback */
  const cancelAll = useCallback(() => {
    // Abort SSE request
    if (cancelSSERef.current) {
      cancelSSERef.current();
      cancelSSERef.current = null;
    }
    // Stop audio
    cancelPlayback();
  }, []);

  const cancelPlayback = useCallback(() => {
    if (currentSourceRef.current) {
      try { currentSourceRef.current.stop(); } catch {}
      currentSourceRef.current = null;
    }
    if (audioContextRef.current) {
      try { audioContextRef.current.close(); } catch {}
      audioContextRef.current = null;
    }
    audioQueueRef.current = [];
    isPlayingRef.current = false;
    setMouthOpen(0);
  }, []);

  const playNextInQueue = useCallback(() => {
    if (isPlayingRef.current || audioQueueRef.current.length === 0) return;
    isPlayingRef.current = true;

    const blob = audioQueueRef.current.shift()!;
    const url = URL.createObjectURL(blob);

    speakFromBlob(url).then(() => {
      isPlayingRef.current = false;
      playNextInQueue();
    });
  }, []);

  const speakFromBlob = async (audioUrl: string): Promise<void> => {
    return new Promise((resolve) => {
      if (audioContextRef.current) {
        try { audioContextRef.current.close(); } catch {}
      }

      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;

      fetch(audioUrl)
        .then((res) => res.arrayBuffer())
        .then((audioData) => audioContext.decodeAudioData(audioData))
        .then((audioBuffer) => {
          const source = audioContext.createBufferSource();
          currentSourceRef.current = source;
          const analyser = audioContext.createAnalyser();

          source.buffer = audioBuffer;
          analyser.connect(audioContext.destination);
          source.connect(analyser);

          source.start(0);

          const updateMouth = () => {
            const dataArray = new Uint8Array(analyser.frequencyBinCount);
            analyser.getByteFrequencyData(dataArray);
            const volume = dataArray.reduce((a, b) => a + b) / dataArray.length;
            setMouthOpen(Math.min(1, volume / 50));

            if (audioContext.state !== "closed") {
              requestAnimationFrame(updateMouth);
            }
          };
          updateMouth();

          source.onended = () => {
            URL.revokeObjectURL(audioUrl);
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

  // ─────────────────────────────────────────────
  // Other handlers
  // ─────────────────────────────────────────────
  const handleLanguageChange = (language: string) => {
    setSelectedLanguage(language);
  };

  const handleGenderChange = (gender: string) => {
    setSelectedGender(gender);
  };

  const handleVoiceSelect = (voice_id: string) => {
    setSelectedVoice(voice_id);
    // Update character name from the matching voice
    const match = voices.find((v) => v.voice_id === voice_id);
    if (match && match.popular_names.length > 0) {
      setCharacterName(match.popular_names[0]);
    }
  };

  const handleCharacterNameChange = (name: string) => {
    setCharacterName(name);
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
    // Voice character
    voices,
    selectedVoice,
    selectedGender,
    handleGenderChange,
    handleVoiceSelect,
    characterName,
    handleCharacterNameChange,
  };
};

export default useVoiceAssistant;
