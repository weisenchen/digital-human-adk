/**
 * Chat content export — download AI-generated content as HTML or PDF.
 *
 * This is NOT for exporting the conversation log.
 * It's for downloading individual AI-generated artifacts
 * (articles, posts, code, poems, etc.) as standalone documents.
 */

/** Estimate whether AI message text is "downloadable content" */
export function isDownloadableContent(text: string): boolean {
  if (!text || text.length < 80) return false;
  // Long text, code blocks, headers, or multiple paragraphs = downloadable
  const hasCodeBlock = /```[\s\S]*```/.test(text);
  const hasHeaders  = /^#{1,3}\s/m.test(text);
  const longEnough  = text.length > 200;
  const multiPara   = (text.match(/\n\n/g) || []).length >= 2;
  return hasCodeBlock || hasHeaders || longEnough || multiPara;
}

/** Guess a title from the first line or first meaningful line of content */
function guessTitle(text: string): string {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  for (const line of lines) {
    const clean = line.replace(/^#{1,3}\s+/, '').replace(/[*_`]/g, '').trim();
    if (clean.length > 5 && clean.length < 100) return clean;
  }
  return 'Generated Content';
}

/** Detect a document type label based on content patterns */
function detectType(text: string): string {
  if (/```[\s\S]*```/.test(text)) return 'Code';
  if (/^#\s/m.test(text))        return 'Article';
  if (/(recipe|cook|ingredient)/i.test(text)) return 'Recipe';
  if (/(story|tale|once upon)/i.test(text))   return 'Story';
  if (/(poem|verse|rhyme)/i.test(text))       return 'Poem';
  if (/(blog|post|article)/i.test(text))      return 'Blog Post';
  if (/(essay|report|analysis)/i.test(text))  return 'Essay';
  return 'Document';
}

/**
 * Build a clean, self-contained HTML document for a single piece of content.
 */
function buildContentHTML(text: string, characterName: string): string {
  const title = guessTitle(text);
  const type  = detectType(text);
  const date  = new Date().toLocaleDateString(undefined, {
    year: 'numeric', month: 'long', day: 'numeric',
  });

  // Convert markdown-like syntax to basic HTML
  const bodyHTML = text
    .split('\n\n')
    .map(block => {
      block = block.trim();
      // Code block
      if (block.startsWith('```') && block.endsWith('```')) {
        const code = block.slice(3, -3).replace(/^[a-z]*\n/, ''); // strip lang tag
        return `<pre><code>${escapeHTML(code)}</code></pre>`;
      }
      // Headers
      if (block.startsWith('### '))  return `<h3>${escapeHTML(block.slice(4))}</h3>`;
      if (block.startsWith('## '))   return `<h2>${escapeHTML(block.slice(3))}</h2>`;
      if (block.startsWith('# '))    return `<h1>${escapeHTML(block.slice(2))}</h1>`;
      // Regular paragraph (with inline formatting)
      const para = escapeHTML(block)
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/\*([^*]+)\*/g, '<em>$1</em>');
      return `<p>${para}</p>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHTML(title)}</title>
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Georgia', 'Times New Roman', serif;
    color: #1A202C;
    background: #FAFAFA;
    padding: 48px 24px;
    max-width: 720px;
    margin: 0 auto;
    line-height: 1.8;
    font-size: 16px;
  }
  .meta {
    text-align: center;
    margin-bottom: 40px;
    padding-bottom: 24px;
    border-bottom: 2px solid #E2E8F0;
  }
  .meta h1 { font-size: 28px; font-weight: 700; color: #1A202C; margin-bottom: 4px; }
  .meta .sub {
    font-size: 13px;
    color: #A0AEC0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  }
  .meta .sub span { margin: 0 8px; }
  h1, h2, h3 {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    margin-top: 28px; margin-bottom: 12px;
    font-weight: 600;
    line-height: 1.3;
  }
  h1 { font-size: 24px; }
  h2 { font-size: 20px; }
  h3 { font-size: 17px; }
  p { margin-bottom: 16px; }
  code {
    font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
    font-size: 14px;
    background: #EDF2F7;
    padding: 2px 6px;
    border-radius: 4px;
  }
  pre {
    background: #1A202C;
    color: #E2E8F0;
    padding: 16px;
    border-radius: 8px;
    overflow-x: auto;
    margin: 16px 0;
  }
  pre code { background: none; padding: 0; color: inherit; font-size: 13px; }
  strong { font-weight: 600; }
  em { font-style: italic; }
  .footer {
    text-align: center;
    margin-top: 48px;
    padding-top: 16px;
    border-top: 1px solid #E2E8F0;
    font-size: 12px;
    color: #A0AEC0;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  }
  @media print {
    body { padding: 0; max-width: none; }
    @page { margin: 2cm; }
  }
</style>
</head>
<body>
  <div class="meta">
    <h1>${escapeHTML(title)}</h1>
    <div class="sub">
      <span>${escapeHTML(type)}</span>
      <span>·</span>
      <span>Generated by ${escapeHTML(characterName)}</span>
      <span>·</span>
      <span>${date}</span>
    </div>
  </div>
  ${bodyHTML}
  <div class="footer">
    Generated by ${escapeHTML(characterName)} · ${date}
  </div>
</body>
</html>`;
}

function escapeHTML(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function dateStamp(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}
function pad(n: number): string { return n < 10 ? '0' + n : String(n); }

/** Slugify a string for use in filenames */
function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}

/**
 * Download a single AI-generated content piece as HTML.
 */
export function downloadContentHTML(text: string, characterName: string): void {
  const html = buildContentHTML(text, characterName);
  const title = slug(guessTitle(text));
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${title || 'content'}-${dateStamp()}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Download a single AI-generated content piece as PDF (via browser print).
 */
export function downloadContentPDF(text: string, characterName: string): void {
  const html = buildContentHTML(text, characterName);
  const title = slug(guessTitle(text));
  const win = window.open('', '_blank');
  if (!win) {
    alert('Popup blocked. Please allow popups for PDF export.');
    return;
  }
  win.document.write(html);
  win.document.title = title || 'content';
  win.document.close();
  setTimeout(() => {
    win.focus();
    win.print();
    win.onafterprint = () => win.close();
  }, 600);
}
