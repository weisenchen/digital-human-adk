"use client";

import React, { useRef, useState, useCallback, useEffect } from "react";
import { Mic, MicOff } from "lucide-react";

export interface VoiceRecorderProps {
  onSpeechRecognized: (text: string) => void;
  language: string;
}

const VoiceRecorder: React.FC<VoiceRecorderProps> = ({
  onSpeechRecognized,
  language,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [interimText, setInterimText] = useState("");
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  const handleRecordToggle = useCallback(async () => {
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      setInterimText("");
      return;
    }

    const SpeechRecognitionAPI =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      alert("Speech recognition is not supported in this browser. Please use Chrome.");
      return;
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.lang = language;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = "";
      let interimTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interimTranscript += result[0].transcript;
        }
      }

      setInterimText(interimTranscript);

      if (finalTranscript.trim()) {
        onSpeechRecognized(finalTranscript.trim());
      }
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error("Speech recognition error:", event.error);
      setIsRecording(false);
      setInterimText("");
    };

    recognition.onend = () => {
      setIsRecording(false);
      setInterimText("");
    };

    recognitionRef.current = recognition;
    setIsRecording(true);
    setInterimText("");
    recognition.start();
  }, [isRecording, onSpeechRecognized, language]);

  return (
    <div className="relative flex flex-col items-center">
      <button
        type="button"
        onClick={handleRecordToggle}
        className={`rounded-full p-2.5 transition-all duration-200 shadow-sm ${
          isRecording
            ? "bg-[#E53E3E] hover:bg-red-600 text-white animate-pulse shadow-md"
            : "bg-[#6B46C1] hover:bg-[#667EEA] text-white"
        }`}
        aria-label={isRecording ? "Stop Listening" : "Start Listening"}
      >
        {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
      </button>

      {isRecording && interimText && (
        <div className="absolute top-12 left-1/2 -translate-x-1/2 bg-white bg-opacity-95 backdrop-blur-sm text-[#4A5568] text-xs px-3 py-1.5 rounded-xl shadow-elevated border border-[#E2E8F0] whitespace-nowrap max-w-[180px] overflow-hidden text-ellipsis z-10">
          🎤 {interimText}
        </div>
      )}
    </div>
  );
};

export default VoiceRecorder;
