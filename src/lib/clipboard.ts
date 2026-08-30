/**
 * Bulletproof clipboard utility that uses the modern Async Clipboard API
 * with a fallback to document.execCommand('copy') for iframes, touch devices,
 * and restricted security contexts.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (text === undefined || text === null) return false;
  const content = typeof text === 'string' ? text : String(text);

  // 1. Try modern navigator.clipboard if available
  if (
    typeof navigator !== 'undefined' &&
    navigator.clipboard &&
    typeof navigator.clipboard.writeText === 'function'
  ) {
    try {
      await navigator.clipboard.writeText(content);
      return true;
    } catch (err) {
      console.warn('[Clipboard] navigator.clipboard.writeText failed, using fallback:', err);
    }
  }

  // 2. Fallback: temporary hidden textarea + document.execCommand('copy')
  if (typeof document !== 'undefined') {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = content;
      // Position offscreen to prevent layout shifts or visual glitches
      textarea.setAttribute('readonly', '');
      textarea.style.position = 'fixed';
      textarea.style.top = '0';
      textarea.style.left = '0';
      textarea.style.width = '2em';
      textarea.style.height = '2em';
      textarea.style.padding = '0';
      textarea.style.border = 'none';
      textarea.style.outline = 'none';
      textarea.style.boxShadow = 'none';
      textarea.style.background = 'transparent';
      textarea.style.opacity = '0';
      textarea.style.zIndex = '-9999';

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
        textarea.focus();
        textarea.select();
      }

      const successful = document.execCommand('copy');
      document.body.removeChild(textarea);
      return successful;
    } catch (fallbackErr) {
      console.error('[Clipboard] execCommand fallback failed:', fallbackErr);
    }
  }

  return false;
}
