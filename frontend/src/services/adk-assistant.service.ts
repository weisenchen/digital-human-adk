/**
 * ADK Digital Human - Service Layer
 *
 * Two modes:
 *   sendChatMessage - text chat via POST /chat (fast, no TTS)
 *   sendChatStream  - voice chat via POST /run_sse (streaming + sentence TTS)
 *
 * Both share the same session_id for conversation memory.
 * Voice character selection is passed to /audio/tts for speech synthesis.
 *
 * Stability features:
 *  - SSE stream has a 30-second idle timeout (avoids permanent hang)
 *  - onComplete returns non-partial textPart, NOT doubled text (fixed bug)
 */

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:8000';
const SSE_TIMEOUT_MS = 30_000; // 30s max wait between SSE data events

/** Persistent session so the agent remembers our conversation across messages */
const PERSISTENT_SESSION_ID = 'persistent_chat_session';

/** Voice list type returned by GET /api/voices */
export interface VoiceOption {
  voice_id: string;
  display_name: string;
  localized_name: string;
  locale: string;
  gender: string;
  popular_names: string[];
}

/** Model option type returned by GET /api/models */
export interface ModelOption {
  id: string;
  name: string;
  provider: string;
  backend: string;
  available: boolean;
}

/** A single slide with separate display content and speech script */
export interface SlideData {
  display: string;
  speech: string;
}

/**
 * Text chat - simple POST /chat (non-streaming, text in / text out).
 * Used when the user types and hits Enter.
 *
 * NOTE: Injects character_name into the session via /chat endpoint.
 */
export const sendChatMessage = async (text: string, characterName?: string, personalityPrompt?: string) => {
  const formData = new FormData();
  formData.append('text', text);
  formData.append('session_id', PERSISTENT_SESSION_ID);
  if (characterName) formData.append('character_name', characterName);
  if (personalityPrompt) formData.append('personality', personalityPrompt);
  const res = await fetch(`${BASE_URL}/chat`, { method: 'POST', body: formData });
  if (!res.ok) throw new Error(`Chat request failed: ${res.status}`);
  const data = await res.json();
  return { reply: data.reply as string };
};

/**
 * Inject/update the character name into the session.
 * Must be called before voice chat (sendChatStream) since /run_sse
 * goes directly to ADK's built-in runner without name injection.
 */
export const injectName = async (characterName?: string, personalityPrompt?: string) => {
  if (!characterName) return;
  const formData = new FormData();
  formData.append('session_id', PERSISTENT_SESSION_ID);
  formData.append('character_name', characterName);
  if (personalityPrompt) formData.append('personality', personalityPrompt);
  await fetch(`${BASE_URL}/inject-name`, { method: 'POST', body: formData });
};

/**
 * Fetch voice catalog from backend.
 */
export const fetchVoices = async (): Promise<VoiceOption[]> => {
  const res = await fetch(`${BASE_URL}/api/voices`);
  if (!res.ok) throw new Error(`Failed to fetch voices: ${res.status}`);
  return res.json();
};

/**
 * Fetch available models from backend.
 */
export const fetchModels = async (): Promise<ModelOption[]> => {
  const res = await fetch(`${BASE_URL}/api/models`);
  if (!res.ok) throw new Error(`Failed to fetch models: ${res.status}`);
  return res.json();
};

/**
 * Select a model for a session.
 */
export const selectModel = async (modelId: string): Promise<void> => {
  const formData = new FormData();
  formData.append('model_id', modelId);
  formData.append('session_id', PERSISTENT_SESSION_ID);
  await fetch(`${BASE_URL}/api/select-model`, { method: 'POST', body: formData });
};

/**
 * Talk Show: send a message to the host and get their response.
 * Host's replies are grounded in background materials and follow the interview structure.
 * All content is in English.
 */
export const sendTalkShowMessage = async (params: {
  topic: string;
  guestName: string;
  hostName: string;
  background: string;
  questions: string;
  personality?: string;
  message: string;
  history: Array<{role: string; content: string}>;
  language?: string;
  durationMinutes?: number;
}): Promise<{reply: string; soundEffect: string | null}> => {
  const formData = new FormData();
  formData.append('topic', params.topic);
  formData.append('guest_name', params.guestName);
  formData.append('host_name', params.hostName);
  formData.append('background', params.background);
  formData.append('questions', params.questions);
  formData.append('personality', params.personality || 'professional-humorous');
  formData.append('message', params.message);
  formData.append('history_json', JSON.stringify(params.history));
  formData.append('language', params.language || 'en');
  formData.append('duration_minutes', String(params.durationMinutes ?? 10));
  const res = await fetch(`${BASE_URL}/api/talk-show/ask`, { method: 'POST', body: formData });
  if (!res.ok) throw new Error(`Talk show request failed: ${res.status}`);
  const data = await res.json();
  return { reply: data.reply as string, soundEffect: data.sound_effect as string | null };
};

/** Generate 3 suggested responses for the guest during talk show */
export const getTalkShowSuggestions = async (params: {
  topic: string;
  guestName: string;
  hostName: string;
  background: string;
  history: { role: string; content: string }[];
  language?: string;
}): Promise<string[]> => {
  const formData = new FormData();
  formData.append('topic', params.topic);
  formData.append('guest_name', params.guestName);
  formData.append('host_name', params.hostName);
  formData.append('background', params.background);
  formData.append('history_json', JSON.stringify(params.history));
  formData.append('language', params.language || 'en');
  const res = await fetch(`${BASE_URL}/api/talk-show/suggest`, { method: 'POST', body: formData });
  if (!res.ok) return [];
  const data = await res.json();
  return data.suggestions || [];
};

export const getAIAudioFromText = async (text: string, language: string, voice?: string) => {
  const formData = new FormData();
  formData.append('text', text);
  formData.append('language', language);
  if (voice) formData.append('voice', voice);
  const res = await fetch(`${BASE_URL}/audio/tts`, { method: 'POST', body: formData });
  if (!res.ok) throw new Error(`TTS request failed: ${res.status}`);
  return await res.blob();
};

/**
 * AI-powered slide generation from a raw script.
 * Sends the script to the ADK agent which summarizes/rewrites it into slides.
 * Each slide has display content (shown on screen) and speech text (read aloud).
 */
export const generateSlides = async (script: string, language: string, numSlides: number = 5): Promise<SlideData[]> => {
  const formData = new FormData();
  formData.append('script', script);
  formData.append('language', language);
  formData.append('num_slides', String(numSlides));
  const res = await fetch(`${BASE_URL}/generate-slides`, { method: 'POST', body: formData });
  if (!res.ok) throw new Error(`Slide generation failed: ${res.status}`);
  const data = await res.json();
  return data.slides as SlideData[];
};

/**
 * Voice chat - streaming via POST /chat/stream.
 * Used when the user speaks into the microphone.
 *
 * Returns a cancel function to abort the request.
 *
 * @param text - User input text (from browser speech recognition)
 * @param onToken - Called with each text chunk as it streams in
 * @param onSentence - Called with each complete sentence for TTS
 * @param onComplete - Called when streaming finishes with the full response text
 * @param onError - Called on error
 * @param characterName - Character name for session injection
 * @param personalityPrompt - Personality system prompt
 * @returns cancel - Call to abort the SSE request
 */
export const sendChatStream = (
  text: string,
  onToken: (chunk: string) => void,
  onSentence: (sentence: string) => void,
  onComplete: (fullText: string) => void,
  onError?: (error: unknown) => void,
  characterName?: string,
  personalityPrompt?: string,
): (() => void) => {
  const abortController = new AbortController();
  let accumulatedText = '';
  let fullResponse = '';
  let timedOut = false;

  const formData = new FormData();
  formData.append('text', text);
  formData.append('session_id', PERSISTENT_SESSION_ID);
  if (characterName) formData.append('character_name', characterName);
  if (personalityPrompt) formData.append('personality', personalityPrompt);

  // Timeout: if no SSE data arrives within SSE_TIMEOUT_MS, abort
  const timeoutId = setTimeout(() => {
    timedOut = true;
    abortController.abort();
    onError?.(new Error(`SSE request timed out after ${SSE_TIMEOUT_MS / 1000}s`));
  }, SSE_TIMEOUT_MS);

  fetch(`${BASE_URL}/chat/stream`, {
    method: 'POST',
    body: formData,
    signal: abortController.signal,
  })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`SSE request failed: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body stream');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        // Reset timeout on any data received
        if (!done) {
          clearTimeout(timeoutId);
          setTimeout(() => {
            if (!timedOut) {
              timedOut = true;
              abortController.abort();
              onError?.(new Error(`SSE request timed out after ${SSE_TIMEOUT_MS / 1000}s`));
            }
          }, SSE_TIMEOUT_MS);
        }

        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE lines: "data: {...}\n\n"
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(line.slice(6));
            const author = event.author || '';
            const isPartial = event.partial === true;

            if (author === 'user') continue;

            const textPart =
              event.content?.parts?.[0]?.text ||
              event.content?.text ||
              '';

            if (!textPart) continue;

            if (isPartial) {
              // Partial: individual token — accumulate and check for sentences
              accumulatedText += textPart;
              onToken(textPart);
              fullResponse += textPart;
              flushSentences();
            } else {
              // Non-partial: contains the COMPLETE response text.
              // Flush any remaining partial text as a sentence, then complete.
              const remaining = accumulatedText.trim();
              if (remaining) {
                onSentence(remaining);
              }
              // textPart IS the complete text (not a delta) — use it directly
              onComplete(textPart);
              accumulatedText = '';
              fullResponse = '';
            }
          } catch {
            // Skip malformed JSON lines
          }
        }
      }

      // Flush any remaining text if stream ended without non-partial event
      const remaining = accumulatedText.trim();
      if (remaining) {
        onSentence(remaining);
        onComplete(fullResponse);
        accumulatedText = '';
        fullResponse = '';
      }
    })
    .catch((err) => {
      // Ignore abort errors (user cancelled OR timeout)
      if (err instanceof DOMException && err.name === 'AbortError') {
        if (!timedOut) return; // user cancelled — silent
        return;                 // timeout — error already sent via onError
      }
      console.error('SSE stream error:', err);
      onError?.(err);
    })
    .finally(() => {
      clearTimeout(timeoutId);
    });

  /**
   * Detect sentence boundaries for both English and Chinese.
   * Splits on: . ! ? newline 。！？
   * When a boundary is found, the completed sentence is sent to TTS.
   */
  function flushSentences() {
    const boundaryRegex = /[.!?\n。！？]/;
    let match: RegExpExecArray | null;

    while ((match = boundaryRegex.exec(accumulatedText)) !== null) {
      const endIdx = match.index + 1;
      const sentence = accumulatedText.slice(0, endIdx).trim();
      if (sentence) {
        onSentence(sentence);
      }
      accumulatedText = accumulatedText.slice(endIdx);
    }
  }

  // Return cancel function
  return () => {
    clearTimeout(timeoutId);
    abortController.abort();
  };
};

/** Send a message to the Meeting Host */
export const sendMeetingMessage = async (params: {
  title: string;
  agenda: { id: string; title: string; durationMinutes: number }[];
  participants: { id: string; name: string; role: string }[];
  background: string;
  message: string;
  history: Array<{role: string; content: string}>;
  language?: string;
}): Promise<{reply: string}> => {
  const formData = new FormData();
  formData.append('title', params.title);
  formData.append('agenda_json', JSON.stringify(params.agenda));
  formData.append('participants_json', JSON.stringify(params.participants));
  formData.append('background', params.background);
  formData.append('message', params.message);
  formData.append('history_json', JSON.stringify(params.history));
  formData.append('language', params.language || 'en');
  const res = await fetch(`${BASE_URL}/api/meeting/ask`, { method: 'POST', body: formData });
  if (!res.ok) throw new Error(`Meeting request failed: ${res.status}`);
  const data = await res.json();
  return { reply: data.reply as string };
};
