/**
 * ADK Digital Human - Service Layer
 *
 * Uses ADK's /run_sse endpoint for streaming responses.
 * Speech-to-text is handled by the browser's Web Speech API (frontend only).
 */

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:8000';

let sessionCounter = 0;

/** Send AI response text -> get audio file (full sentence) */
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
 * Automatically detects sentence boundaries and calls onSentence for
 * streaming text-to-speech.
 *
 * @param text - User input text
 * @param onToken - Called with each text chunk as it streams in
 * @param onSentence - Called with each complete sentence for TTS
 * @param onComplete - Called when streaming finishes (all sentences flushed)
 * @param onError - Called on error
 */
export const sendChatStream = (
  text: string,
  onToken: (chunk: string) => void,
  onSentence: (sentence: string) => void,
  onComplete: (fullText: string) => void,
  onError?: (error: unknown) => void,
) => {
  const sessionId = `web_${++sessionCounter}`;
  let accumulatedText = '';
  let fullResponse = '';

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
              // Partial events: incremental token delta
              accumulatedText += textPart;
              onToken(textPart);
              fullResponse += textPart;

              // Detect sentence boundaries
              flushSentences();
            } else {
              // Non-partial event: flush everything remaining
              const remaining = accumulatedText.trim();
              if (remaining) {
                onSentence(remaining);
              }
              onComplete(fullResponse + textPart);
              accumulatedText = '';
              fullResponse = '';
            }
          } catch {
            // Skip malformed JSON lines
          }
        }
      }

      // Flush any remaining text (stream ended without a terminal event)
      const remaining = accumulatedText.trim();
      if (remaining) {
        onSentence(remaining);
        onComplete(fullResponse);
        accumulatedText = '';
        fullResponse = '';
      }
    })
    .catch((err) => {
      console.error('SSE stream error:', err);
      onError?.(err);
    });

  /** Extract complete sentences from accumulatedText and call onSentence */
  function flushSentences() {
    // Split on . ! ? or newline (keeping the delimiter)
    const boundaryRegex = /[.!?\n]/;
    let match: RegExpExecArray | null;

    while ((match = boundaryRegex.exec(accumulatedText)) !== null) {
      const endIdx = match.index + 1; // include the delimiter
      const sentence = accumulatedText.slice(0, endIdx).trim();
      if (sentence) {
        onSentence(sentence);
      }
      accumulatedText = accumulatedText.slice(endIdx);
    }
  }
};
