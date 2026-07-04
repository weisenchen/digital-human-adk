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

  // Listen for global Space key shortcut
  useEffect(() => {
    const handler = () => {
      if (!isRecording) {
        // Only start if not already recording — delegate to toggle
        handleRecordToggle();
      }
    };
    window.addEventListener('toggle-recording', handler);
    return () => window.removeEventListener('toggle-recording', handler);
  }, [isRecording]);

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
      {/* Ripple container */}
      <div className="relative">
        {/* Ripple rings (appear when recording) */}
        {isRecording && (
          <>
            <div className="absolute inset-0 rounded-[var(--shape-full)] animate-ping bg-[var(--md-error)]/20" />
            <div className="absolute -inset-2 rounded-[var(--shape-full)] animate-ping bg-[var(--md-error)]/10" style={{ animationDelay: '0.15s', animationDuration: '1.5s' }} />
            <div className="absolute -inset-4 rounded-[var(--shape-full)] animate-ping bg-[var(--md-error)]/5" style={{ animationDelay: '0.3s', animationDuration: '1.5s' }} />
          </>
        )}

        <button
          type="button"
          onClick={handleRecordToggle}
          className={`state-layer rounded-[var(--shape-full)] p-2.5 transition-all duration-[var(--motion-md)] ease-emphasized shadow-elevation-1 relative z-10 ${
            isRecording
              ? "bg-[var(--md-error)] text-white shadow-elevation-3"
              : "bg-[var(--md-primary)] text-white"
          }`}
          aria-label={isRecording ? "Stop Listening" : "Start Listening"}
        >
          {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </button>
      </div>

      {/* "Listening..." label */}
      {isRecording && (
        <div className="mt-1.5 text-label-sm text-[var(--md-error)] animate-pulse">
          Listening...
        </div>
      )}

      {/* Transcription bubble */}
      {isRecording && interimText && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 bg-white bg-opacity-95 backdrop-blur-sm text-[var(--md-on-surface-variant)] text-body-sm px-3 py-1.5 rounded-[var(--shape-lg)] shadow-elevation-3 border border-[var(--md-outline)] whitespace-nowrap max-w-[200px] overflow-hidden text-ellipsis z-10">
          🎤 {interimText}
        </div>
      )}
    </div>
  );
};

export default VoiceRecorder;
