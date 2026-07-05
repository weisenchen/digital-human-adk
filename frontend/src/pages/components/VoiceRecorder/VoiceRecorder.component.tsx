"use client";

import React, { useRef, useState, useCallback, useEffect } from "react";
import { Mic } from "lucide-react";

export interface VoiceRecorderProps {
  onSpeechRecognized: (text: string) => void;
  onInterimText?: (text: string) => void;
  language: string;
  toggleMode?: boolean;
}

const VoiceRecorder: React.FC<VoiceRecorderProps> = ({
  onSpeechRecognized,
  onInterimText,
  language,
  toggleMode = false,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  // @ts-ignore - SpeechRecognition is a browser API not in TS types
  const recognitionRef = useRef<any>(null);
  const finalRef = useRef<string>("");
  const pressedRef = useRef(false);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  const startRecording = useCallback(() => {
    if (pressedRef.current) return; // already pressed
    pressedRef.current = true;
    finalRef.current = "";

    const SpeechRecognitionAPI =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionAPI) {
      alert("Speech recognition is not supported in this browser. Please use Chrome.");
      pressedRef.current = false;
      return;
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.lang = language;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      let interimTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalRef.current += result[0].transcript;
        } else {
          interimTranscript += result[0].transcript;
        }
      }

      // Show interim + accumulated final in input box
      const displayText = finalRef.current + interimTranscript;
      if (onInterimText && displayText) {
        onInterimText(displayText);
      }
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      pressedRef.current = false;
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognitionRef.current = recognition;
    setIsRecording(true);
    recognition.start();
  }, [language, onInterimText]);

  const stopRecording = useCallback(() => {
    if (!pressedRef.current) return;
    pressedRef.current = false;

    try {
      recognitionRef.current?.stop();
    } catch {}

    setIsRecording(false);

    // Submit final text
    const final = finalRef.current.trim();
    finalRef.current = "";
    if (final) {
      onSpeechRecognized(final);
    }
  }, [onSpeechRecognized]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    if (toggleMode) {
      if (isRecording) {
        stopRecording();
      } else {
        startRecording();
      }
      return;
    }
    startRecording();
  }, [startRecording, stopRecording, toggleMode, isRecording]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    if (toggleMode) return; // toggle mode uses click, not pointer up
    stopRecording();
  }, [stopRecording, toggleMode]);

  const handlePointerLeave = useCallback((e: React.PointerEvent) => {
    // Only cancel if button is pressed (pointer is held and moved away)
    if (pressedRef.current) {
      // Cancel — don't submit
      pressedRef.current = false;
      try { recognitionRef.current?.stop(); } catch {}
      setIsRecording(false);
      finalRef.current = "";
      if (onInterimText) onInterimText("");
    }
  }, [onInterimText]);

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
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerLeave}
          onContextMenu={(e) => e.preventDefault()}
          className={`state-layer rounded-[var(--shape-full)] p-2.5 transition-all duration-[var(--motion-md)] ease-emphasized shadow-elevation-1 relative z-10 select-none touch-none ${
            isRecording
              ? "bg-[var(--md-error)] text-white shadow-elevation-3"
              : "bg-[var(--md-primary)] text-white"
          }`}
          aria-label={isRecording ? (toggleMode ? 'Tap to stop' : 'Release to send') : (toggleMode ? 'Tap to speak' : 'Hold to record')}
        >
          <Mic className="w-5 h-5" />
        </button>
      </div>

      {/* "Hold to record" / release label */}
      {isRecording && (
        <div className="mt-1.5 text-label-sm text-[var(--md-error)] animate-pulse whitespace-nowrap">
          {toggleMode ? 'Tap to stop' : 'Release to send'}
        </div>
      )}
    </div>
  );
};

export default VoiceRecorder;
