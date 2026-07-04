/**
 * ADK Digital Human - Service Layer
 *
 * Calls simplified /chat endpoint instead of ADK's raw /run API.
 * Speech-to-text is handled by the browser's Web Speech API (frontend only).
 */

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:8000';

/** Send AI response text -> get audio file */
export const getAIAudioFromText = async (text: string, language: string) => {
  const formData = new FormData();
  formData.append('text', text);
  formData.append('language', language);
  const res = await fetch(`${BASE_URL}/audio/tts`, { method: 'POST', body: formData });
  return await res.blob();
};

/** Send user text -> get ADK agent reply */
export const getAIReplyFromText = async (text: string) => {
  const formData = new FormData();
  formData.append('text', text);
  const res = await fetch(`${BASE_URL}/chat`, { method: 'POST', body: formData });
  const data = await res.json();
  return { aiResponseText: data.reply };
};
