/**
 * ADK Digital Human - Service Layer
 *
 * Calls simplified /chat endpoint instead of ADK's raw /run API.
 */

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:8000';

/** Upload user audio → get transcribed text */
export const getTextFromAudio = async (audioBlob: Blob, language: string) => {
  const formData = new FormData();
  formData.append('file', audioBlob, 'audio.mp3');
  formData.append('language', language);
  const res = await fetch(`${BASE_URL}/audio/stt`, { method: 'POST', body: formData });
  const data = await res.json();
  return { userQuery: data.text };
};

/** Send AI response text → get audio file */
export const getAIAudioFromText = async (text: string, language: string) => {
  const formData = new FormData();
  formData.append('text', text);
  formData.append('language', language);
  const res = await fetch(`${BASE_URL}/audio/tts`, { method: 'POST', body: formData });
  return await res.blob();
};

/** Send user text → get ADK agent reply */
export const getAIReplyFromText = async (text: string) => {
  const formData = new FormData();
  formData.append('text', text);
  const res = await fetch(`${BASE_URL}/chat`, { method: 'POST', body: formData });
  const data = await res.json();
  return { aiResponseText: data.reply };
};
