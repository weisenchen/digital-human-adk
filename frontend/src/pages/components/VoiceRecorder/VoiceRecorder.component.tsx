"use client";

import React, { useRef, useState, useCallback } from "react";
import { Mic, MicOff } from "lucide-react";

export interface VoiceRecorderProps {
  onSpeechRecognized: (text: string) => void;
  language: string;
}

/**
 * VoiceRecorder - uses browser's Web Speech API (SpeechRecognition)
 * to transcribe speech to text in real-time, then passes the text
 * to the parent hook (no raw audio sent to the backend).
 */
const VoiceRecorder: React.FC<VoiceRecorderProps> = ({
  onSpeechRecognized,
  language,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const handleRecordToggle = useCallback(async () => {
    if (isRecording) {
      // Stop listening
      recognitionRef.current?.stop();
      setIsRecording(false);
      return;
    }

    // Check browser support
    const SpeechRecognitionAPI =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      alert("Speech recognition is not supported in this browser. Please use Chrome.");
      return;
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.lang = language;
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0][0].transcript;
      if (transcript.trim()) {
        onSpeechRecognized(transcript);
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error("Speech recognition error:", event.error);
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognitionRef.current = recognition;
    setIsRecording(true);
    recognition.start();
  }, [isRecording, onSpeechRecognized, language]);

  return (
    <div>
      <button
        type="button"
        onClick={handleRecordToggle}
        className={`rounded-full px-4 py-2 ${
          isRecording
            ? "bg-red-400 hover:bg-red-500 text-white"
            : "bg-orange-400 hover:bg-orange-500 text-white"
        }`}
      >
        {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        <span className="sr-only">{isRecording ? "Stop Listening" : "Start Listening"}</span>
      </button>
    </div>
  );
};

export default VoiceRecorder;
