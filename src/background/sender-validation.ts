import { isLmDomain } from '@/shared/domains';

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
    if (url.protocol === 'https:' && isLmDomain(url.hostname)) {
      return true;
    }
  } catch {
    return false;
  }

  return false;
}
