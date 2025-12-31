export function isValidSender(sender: chrome.runtime.MessageSender): boolean {
  if (sender.id !== chrome.runtime.id) {
    return false;
  }

  if (!sender.url) {
    return true;
  }

  try {
    const url = new URL(sender.url);
    if (url.protocol === 'chrome-extension:') {
      return true;
    }
    if (url.protocol === 'https:' && url.hostname.endsWith('logicmonitor.com')) {
      return true;
    }
  } catch {
    return false;
  }

  return false;
}
