/**
 * Generic message listener manager for Chrome extension messaging.
 * Provides safe lifecycle management to prevent memory leaks.
 * 
 * @template TMessage - The message type structure
 * @template TId - The identifier type (usually string)
 */
export class MessageListenerManager<
  TMessage = unknown,
  TId = string
> {
  private listener: ((message: TMessage) => boolean) | null = null;
  private currentId: TId | null = null;

  /**
   * Starts listening for messages.
   * Automatically cleans up any existing listener first.
   * 
   * @param id - Unique identifier for this listener session
   * @param handler - Message handler function that receives messages
   *                  Return true to signal that listening should stop
   */
  start(id: TId, handler: (message: TMessage) => void | boolean): void {
    // Always clean up first to prevent leaks
    this.cleanup();
    
    this.currentId = id;
    this.listener = (message: TMessage) => {
      const shouldStop = handler(message);
      if (shouldStop === true) {
        this.cleanup();
      }
      return false; // Don't block other listeners
    };

    chrome.runtime.onMessage.addListener(this.listener);
  }

  /**
   * Cleans up the current listener. Safe to call multiple times.
   */
  cleanup(): void {
    if (this.listener) {
      chrome.runtime.onMessage.removeListener(this.listener);
      this.listener = null;
    }
    this.currentId = null;
  }

  /**
   * Gets the current session ID, if any.
   */
  getCurrentId(): TId | null {
    return this.currentId;
  }

  /**
   * Checks if there's an active listener.
   */
  isActive(): boolean {
    return this.listener !== null;
  }
}

/**
 * Creates a message listener manager that filters by message type and ID.
 * Common pattern for progress-style messages.
 * 
 * @param messageType - The message.type to filter for
 * @param getMessageId - Function to extract the ID from a message
 */
export function createFilteredListenerManager<TPayload>(
  messageType: string,
  getMessageId: (message: { type: string; payload?: unknown }) => string | undefined
) {
  const manager = new MessageListenerManager<{ type: string; payload?: TPayload }>();
  
  return {
    start(id: string, onMatch: (payload: TPayload) => void): void {
      manager.start(id, (message) => {
        if (message.type === messageType && getMessageId(message) === id) {
          onMatch(message.payload as TPayload);
        }
      });
    },
    cleanup: () => manager.cleanup(),
    getCurrentId: () => manager.getCurrentId(),
    isActive: () => manager.isActive(),
  };
}

