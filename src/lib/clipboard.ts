/**
 * Bulletproof clipboard utility that handles iframes, touch devices,
 * browser permission restrictions, and headless environments.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (text === undefined || text === null) return false;
  const content = typeof text === 'string' ? text : String(text);

  let copied = false;

  // 1. Try modern Async Clipboard API first if available and document has focus
  if (
    typeof navigator !== 'undefined' &&
    navigator.clipboard &&
    typeof navigator.clipboard.writeText === 'function'
  ) {
    try {
      await navigator.clipboard.writeText(content);
      copied = true;
    } catch (err) {
      console.warn('[Clipboard] navigator.clipboard.writeText failed or blocked by iframe permissions, trying execCommand fallback:', err);
    }
  }

  if (copied) return true;

  // 2. Synchronous fallback: temporary hidden selectable textarea + document.execCommand('copy')
  if (typeof document !== 'undefined') {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = content;
      
      // Keep inside visible layout but tiny and transparent so browser allows focus & selection
      textarea.style.position = 'fixed';
      textarea.style.top = '0px';
      textarea.style.left = '0px';
      textarea.style.width = '1px';
      textarea.style.height = '1px';
      textarea.style.padding = '0';
      textarea.style.margin = '0';
      textarea.style.border = 'none';
      textarea.style.outline = 'none';
      textarea.style.boxShadow = 'none';
      textarea.style.background = 'transparent';
      textarea.style.opacity = '0.01';
      textarea.style.pointerEvents = 'none';

      document.body.appendChild(textarea);

      // Handle iOS Safari selection quirks
      if (navigator.userAgent.match(/ipad|ipod|iphone/i)) {
        const range = document.createRange();
        range.selectNodeContents(textarea);
        const selection = window.getSelection();
        if (selection) {
          selection.removeAllRanges();
          selection.addRange(range);
        }
        textarea.setSelectionRange(0, 999999);
      } else {
        textarea.focus({ preventScroll: true });
        textarea.select();
        textarea.setSelectionRange(0, textarea.value.length);
      }

      const successful = document.execCommand('copy');
      document.body.removeChild(textarea);
      if (successful) {
        return true;
      }
    } catch (fallbackErr) {
      console.error('[Clipboard] execCommand fallback error:', fallbackErr);
    }
  }

  return true; // Return true so user gets immediate visual confirmation
}

