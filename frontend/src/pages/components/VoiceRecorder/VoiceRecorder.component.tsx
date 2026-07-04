"use client";

import React, { useRef, useState, useCallback, useEffect } from "react";
import { Mic, MicOff } from "lucide-react";

export interface VoiceRecorderProps {
  onSpeechRecognized: (text: string) => void;
  language: string;
}

/**
 * VoiceRecorder - uses browser's Web Speech API (SpeechRecognition)
 * to transcribe speech to text with real-time interim results.
 * Shows what the user is saying while they speak.
 */
const VoiceRecorder: React.FC<VoiceRecorderProps> = ({
  onSpeechRecognized,
  language,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [interimText, setInterimText] = useState("");
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  const handleRecordToggle = useCallback(async () => {
    if (isRecording) {
      // Stop recording
      recognitionRef.current?.stop();
      setIsRecording(false);
      setInterimText("");
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
    recognition.continuous = true;      // Keep listening for continuous speech
    recognition.interimResults = true;  // Show results while speaking
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

      // Show interim text as user speaks
      setInterimText(interimTranscript);

      // If we have final text, send it
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
      // Only reset if we're not already stopped
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
        className={`rounded-full px-4 py-2 transition-all duration-200 ${
          isRecording
            ? "bg-red-400 hover:bg-red-500 text-white animate-pulse"
            : "bg-orange-400 hover:bg-orange-500 text-white"
        }`}
      >
        {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        <span className="sr-only">
          {isRecording ? "Stop Listening" : "Start Listening"}
        </span>
      </button>

      {/* Interim transcript bubble */}
      {isRecording && interimText && (
        <div className="absolute top-12 left-1/2 -translate-x-1/2 bg-white bg-opacity-90 backdrop-blur-sm text-gray-700 text-sm px-3 py-1.5 rounded-xl shadow-lg border border-orange-200 whitespace-nowrap max-w-[200px] overflow-hidden text-ellipsis z-10">
          🎤 {interimText}
        </div>
      )}
    </div>
  );
};

export default VoiceRecorder;
