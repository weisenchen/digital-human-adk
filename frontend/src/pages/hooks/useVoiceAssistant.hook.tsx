"use client";

import { sendChatStream, getAIAudioFromText } from "@/pages/services/adk-assistant.service"
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

    // Audio playback queue (refs so they survive re-renders)
    const audioQueueRef = useRef<Blob[]>([]);
    const isPlayingRef = useRef(false);
    const audioContextRef = useRef<AudioContext | null>(null);
    const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);
    const generationRef = useRef(0); // increment on each new input to discard stale TTS

  const handleUserInput = async (input: string) => {
    // Cancel any in-progress playback
    cancelPlayback();
    const gen = ++generationRef.current;

    setChatData((prev) => [...prev, { text: input, isUser: true }]);

    // Add a placeholder AI message for streaming
    setChatData((prev) => [...prev, { text: '', isUser: false }]);
    setIsWaitingAIOutput(true);

    sendChatStream(
      input,
      // onToken: append to the streaming message
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
          // Discard if a newer generation has started (user sent a new message)
          if (generationRef.current !== gen) return;
          audioQueueRef.current.push(blob);
          playNextInQueue();
        } catch (err) {
          console.error("TTS error for sentence:", sentence, err);
        }
      },
      // onComplete: streaming finished
      (fullText) => {
        setIsWaitingAIOutput(false);
        // No additional TTS needed — all sentences were already flushed
      },
      // onError
      (err) => {
        console.error("Stream error:", err);
        setIsWaitingAIOutput(false);
      },
    );
  };

  /** Cancel current playback and clear the queue */
  const cancelPlayback = useCallback(() => {
    // Stop current audio
    if (currentSourceRef.current) {
      try { currentSourceRef.current.stop(); } catch {}
      currentSourceRef.current = null;
    }
    if (audioContextRef.current) {
      try { audioContextRef.current.close(); } catch {}
      audioContextRef.current = null;
    }
    // Clear the queue
    audioQueueRef.current = [];
    isPlayingRef.current = false;
    setMouthOpen(0);
  }, []);

  /** Play the next item in the audio queue */
  const playNextInQueue = useCallback(() => {
    if (isPlayingRef.current || audioQueueRef.current.length === 0) return;
    isPlayingRef.current = true;

    const blob = audioQueueRef.current.shift()!;
    const url = URL.createObjectURL(blob);

    // Use the existing speaking function, then chain to next
    speakFromBlob(url).then(() => {
      isPlayingRef.current = false;
      playNextInQueue();
    });
  }, []);

  /** Play an audio blob and return when done */
  const speakFromBlob = async (audioUrl: string): Promise<void> => {
    return new Promise((resolve) => {
      // Close previous context if still around
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

          // Lip-sync loop
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
          resolve(); // Don't block the queue on error
        });
    });
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText.trim()) {
      handleUserInput(inputText);
      setInputText('');
    }
  };

  /** Called when browser Web Speech API returns a transcript */
  const handleSpeechRecognized = (transcript: string) => {
    if (!transcript.trim()) return;
    handleUserInput(transcript);
  };

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
