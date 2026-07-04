/**
 * ADK Digital Human - Service Layer
 *
 * Uses ADK's /run_sse endpoint for streaming responses.
 * Speech-to-text is handled by the browser's Web Speech API (frontend only).
 */

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:8000';

let sessionCounter = 0;

/** Send AI response text -> get audio file (non-streaming, full sentence) */
export const getAIAudioFromText = async (text: string, language: string) => {
  const formData = new FormData();
  formData.append('text', text);
  formData.append('language', language);
  const res = await fetch(`${BASE_URL}/audio/tts`, { method: 'POST', body: formData });
  return await res.blob();
};

/**
 * Send user text -> get AI reply via SSE streaming.
 *
 * Calls ADK's /run_sse endpoint and yields text tokens as they arrive.
 *
 * @param text - User input text
 * @param onToken - Called with each text chunk as it streams in (partial=true)
 * @param onComplete - Called with the full response text when streaming finishes
 * @param onError - Called on error
 */
export const sendChatStream = (
  text: string,
  onToken: (chunk: string) => void,
  onComplete: (fullText: string) => void,
  onError?: (error: unknown) => void,
) => {
  const sessionId = `web_${++sessionCounter}`;
  let accumulatedText = '';

  const body = JSON.stringify({
    app_name: 'digital_human',
    user_id: 'default_user',
    session_id: sessionId,
    new_message: {
      role: 'user',
      parts: [{ text }],
    },
    streaming: true,
  });

  fetch(`${BASE_URL}/run_sse`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
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
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE lines: "data: {...}\n\n"
        const lines = buffer.split('\n');
        // Keep last incomplete chunk in buffer
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event = JSON.parse(line.slice(6));
            const author = event.author || '';
            const isPartial = event.partial === true;

            // Only process non-user, text content
            if (author === 'user') continue;

            const textPart =
              event.content?.parts?.[0]?.text ||
              event.content?.text ||
              '';

            if (!textPart) continue;

            if (isPartial) {
              // Partial events: incremental token delta
              accumulatedText += textPart;
              onToken(textPart);
            } else {
              // Non-partial event: complete final text
              onComplete(textPart);
              accumulatedText = '';
            }
          } catch {
            // Skip malformed JSON lines silently
          }
        }
      }

      // Flush remaining buffer
      if (accumulatedText) {
        onComplete(accumulatedText);
      }
    })
    .catch((err) => {
      console.error('SSE stream error:', err);
      onError?.(err);
    });
};
