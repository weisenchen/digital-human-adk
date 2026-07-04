"use client";

import { sendChatStream, getAIAudioFromText } from "@/pages/services/adk-assistant.service"
import {useState} from "react"

interface Message {
    text: string;
    isUser: boolean;
  }

const useVoiceAssistant = ()=>{
    const [isWaitingAIOutput,setIsWaitingAIOutput] = useState<boolean>(false)
    const [lastAIReplyURL,setLastAIReplyURL] = useState<string|undefined>(undefined)
    const [selectedLanguage, setSelectedLanguage] = useState<string>("en-GB"); //default language 
    const [chatData, setChatData] = useState<Message[]>([]);
    const [inputText, setInputText] = useState('');
    const [mouthOpen, setMouthOpen] = useState(0);

  const handleUserInput = async (input: string) => {
    setChatData((prev) => [...prev, { text: input, isUser: true }]);

    // Add a placeholder AI message for streaming
    setChatData((prev) => [...prev, { text: '', isUser: false }]);
    setIsWaitingAIOutput(true);

    let fullResponse = '';

    sendChatStream(
      input,
      // onToken: append to the last AI message in chat
      (chunk) => {
        fullResponse += chunk;
        setChatData((prev) => {
          const updated = [...prev];
          const lastIdx = updated.length - 1;
          if (lastIdx >= 0 && !updated[lastIdx].isUser) {
            updated[lastIdx] = { text: updated[lastIdx].text + chunk, isUser: false };
          }
          return updated;
        });
      },
      // onComplete: stream finished, trigger TTS
      async (fullText) => {
        setIsWaitingAIOutput(false);
        if (!fullText.trim()) return;

        // Generate TTS audio for the full response
        try {
          const aiAudioResult = await getAIAudioFromText(fullText, selectedLanguage);
          if (aiAudioResult) {
            const url = URL.createObjectURL(aiAudioResult);
            speaking(url);
          }
        } catch (aiAudioError) {
          console.error("Error generating AI audio:", aiAudioError);
        }
      },
      // onError
      (err) => {
        console.error("Stream error:", err);
        setIsWaitingAIOutput(false);
      },
    );
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText.trim()) {
      handleUserInput(inputText);
      setInputText('');
    }
  };

    /**
     * Called when the browser's Web Speech API returns a recognized transcript.
     * The text is sent to the backend /run_sse endpoint (no raw audio to the server).
     */
    const handleSpeechRecognized = async (transcript: string) => {
      if (!transcript.trim()) return;
      handleUserInput(transcript);
    };

    const speaking = async (Audiourl: string) => {
      let audioContext = new (window.AudioContext);
      const response = await fetch(Audiourl);
      const audioData = await response.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(audioData);
  
      const source = audioContext.createBufferSource();
      const analyser = audioContext.createAnalyser();
  
      source.buffer = audioBuffer;
      analyser.connect(audioContext.destination);
      source.connect(analyser);
  
      source.start(0);
  
      const updateMouth = () => {
        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(dataArray);
  
        const volume = dataArray.reduce((a, b) => a + b) / dataArray.length;
        const mouthOpen = Math.min(1, volume / 50); // normalize to [0, 1]
  
        setMouthOpen(mouthOpen); 
  
        if (audioContext.state !== "closed") {
          requestAnimationFrame(updateMouth);
        }
      };
  
      updateMouth();
    };

    const handleOnAudioPlayEnd = ()=>{
        setLastAIReplyURL(undefined)
    }

    const handleLanguageChange = (language:string) => {
        setSelectedLanguage(language);
    };

    return{
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
    }
}


export default useVoiceAssistant;
