/**
 * Chat conversation export — download as HTML or PDF (via print).
 */

interface ChatMessage {
  text: string;
  isUser: boolean;
}

/**
 * Build a clean, self-contained HTML document from chat data.
 */
function buildChatHTML(
  chatData: ChatMessage[],
  characterName: string,
  language: string,
): string {
  const date = new Date().toLocaleDateString(undefined, {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  const messagesHTML = chatData.length === 0
    ? '<p class="empty">No messages</p>'
    : chatData.map((msg, i) => {
        const side = msg.isUser ? 'user' : 'ai';
        const name = msg.isUser ? 'You' : characterName;
        return `
          <div class="message ${side}">
            <div class="avatar ${side}">${name.charAt(0).toUpperCase()}</div>
            <div class="bubble ${side}">
              <div class="sender">${name}</div>
              <div class="text">${escapeHTML(msg.text)}</div>
            </div>
          </div>`;
      }).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Chat - ${escapeHTML(characterName)}</title>
<style>
  /* ── Reset & Base ─────────────────────────────────── */
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    background: #F7FAFC;
    color: #1A202C;
    padding: 24px 16px;
    max-width: 720px;
    margin: 0 auto;
    line-height: 1.5;
  }

  /* ── Header ──────────────────────────────────────── */
  .header {
    text-align: center;
    padding-bottom: 20px;
    margin-bottom: 24px;
    border-bottom: 1px solid #E2E8F0;
  }
  .header h1 { font-size: 20px; font-weight: 700; color: #1A202C; }
  .header .meta { font-size: 13px; color: #A0AEC0; margin-top: 4px; }
  .header .meta span { margin: 0 8px; }

  /* ── Message Layout ──────────────────────────────── */
  .message {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    margin-bottom: 16px;
  }
  .message.user { flex-direction: row-reverse; }

  /* ── Avatar ──────────────────────────────────────── */
  .avatar {
    width: 32px; height: 32px;
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 13px; font-weight: 700;
    flex-shrink: 0;
  }
  .avatar.user { background: #6B46C1; color: #fff; }
  .avatar.ai   { background: #EDF2F7; color: #4A5568; }

  /* ── Bubble ──────────────────────────────────────── */
  .bubble {
    max-width: 80%;
    padding: 10px 14px;
    border-radius: 16px;
    font-size: 14px;
    line-height: 1.5;
  }
  .bubble.user {
    background: #6B46C1;
    color: #fff;
    border-bottom-right-radius: 6px;
  }
  .bubble.ai {
    background: #EDF2F7;
    color: #1A202C;
    border-bottom-left-radius: 6px;
  }
  .bubble .sender {
    font-size: 11px;
    font-weight: 600;
    margin-bottom: 2px;
    opacity: 0.7;
  }
  .bubble.user .sender { color: rgba(255,255,255,0.8); }
  .bubble.ai .sender   { color: #6B46C1; }

  /* ── Empty state ─────────────────────────────────── */
  .empty {
    text-align: center; color: #A0AEC0; padding: 40px 0;
  }

  /* ── Print styling ───────────────────────────────── */
  @media print {
    body { padding: 0; max-width: none; }
    .message { break-inside: avoid; }
    @page { margin: 1.5cm; }
  }
</style>
</head>
<body>
  <div class="header">
    <h1>💬 ${escapeHTML(characterName)}</h1>
    <div class="meta">
      <span>${chatData.length} messages</span>
      <span>·</span>
      <span>${date}</span>
      <span>·</span>
      <span>${escapeHTML(language)}</span>
    </div>
  </div>
  ${messagesHTML}
</body>
</html>`;
}

/** Minimal HTML escape to prevent XSS in export. */
function escapeHTML(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Download chat as HTML file.
 */
export function downloadHTML(
  chatData: ChatMessage[],
  characterName: string,
  language: string,
): void {
  const html = buildChatHTML(chatData, characterName, language);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `chat-${characterName.replace(/\s+/g, '-')}-${dateStamp()}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Open chat in a new window and trigger the browser's print dialog.
 * User can select "Save as PDF" from print options — zero dependencies.
 */
export function downloadPDF(
  chatData: ChatMessage[],
  characterName: string,
  language: string,
): void {
  const html = buildChatHTML(chatData, characterName, language);
  const win = window.open('', '_blank');
  if (!win) {
    alert('Popup blocked. Please allow popups for PDF export.');
    return;
  }
  win.document.write(html);
  win.document.title = `Chat-${characterName}-${dateStamp()}`;
  win.document.close();
  // Wait for fonts/styles to render, then print
  setTimeout(() => {
    win.focus();
    win.print();
    // Close after print dialog closes (or user can keep it open)
    win.onafterprint = () => win.close();
  }, 600);
}

function dateStamp(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}
function pad(n: number): string { return n < 10 ? '0' + n : String(n); }
