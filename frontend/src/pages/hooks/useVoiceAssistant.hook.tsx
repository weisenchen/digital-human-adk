"use client";

import { sendChatMessage, sendChatStream, getAIAudioFromText } from "@/pages/services/adk-assistant.service"
import { useRef, useState, useCallback } from "react"

interface Message {
    text: string;
    isUser: boolean;
  }

const useVoiceAssistant = ()=>{
    const [isWaitingAIOutput,setIsWaitingAIOutput] = useState<boolean>(false)
    const [lastAIReplyURL,setLastAIReplyURL] = useState<string|undefined>(undefined)
    const [selectedLanguage, setSelectedLanguage] = useState<string>("en-GB");
    const [chatData, setChatData] = useState<Message[]>([]);
    const [inputText, setInputText] = useState('');
    const [mouthOpen, setMouthOpen] = useState(0);

    // Audio playback queue
    const audioQueueRef = useRef<Blob[]>([]);
    const isPlayingRef = useRef(false);
    const audioContextRef = useRef<AudioContext | null>(null);
    const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);
    const generationRef = useRef(0); // increment on each new input to discard stale TTS

  // ─────────────────────────────────────────────
  // Path 1: Text chat (POST /chat, non-streaming)
  // ─────────────────────────────────────────────
  const handleTextSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

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
  const startVoiceChat = async (transcript: string) => {
    // Cancel any in-progress audio playback
    cancelPlayback();
    const gen = ++generationRef.current;

    setChatData((prev) => [...prev, { text: transcript, isUser: true }]);

    // Placeholder for streaming text
    setChatData((prev) => [...prev, { text: '', isUser: false }]);
    setIsWaitingAIOutput(true);

    sendChatStream(
      transcript,
      // onToken: update the streaming message in chat
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
      // onSentence: enqueue TTS for each completed sentence
      async (sentence) => {
        try {
          const blob = await getAIAudioFromText(sentence, selectedLanguage);
          if (generationRef.current !== gen) return;
          audioQueueRef.current.push(blob);
          playNextInQueue();
        } catch (err) {
          console.error("TTS error for sentence:", sentence, err);
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
  };

  /** Called when browser Web Speech API returns a transcript */
  const handleSpeechRecognized = (transcript: string) => {
    if (!transcript.trim()) return;
    startVoiceChat(transcript);
  };

  // ─────────────────────────────────────────────
  // Audio playback (shared)
  // ─────────────────────────────────────────────
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
  const handleOnAudioPlayEnd = () => {
    setLastAIReplyURL(undefined);
  };

  const handleLanguageChange = (language: string) => {
    setSelectedLanguage(language);
  };

  return {
    handleSpeechRecognized,
    isWaitingAIOutput,
    lastAIReplyURL,
    handleOnAudioPlayEnd,
    selectedLanguage,
    handleLanguageChange,
    chatData,
    inputText,
    setInputText,
    handleTextSubmit,
    mouthOpen,
  };
};

export default useVoiceAssistant;
