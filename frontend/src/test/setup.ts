import '@testing-library/jest-dom';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Cleanup after each test case
afterEach(() => {
  cleanup();
});

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

// Mock ResizeObserver
(globalThis as typeof globalThis & { ResizeObserver: typeof ResizeObserver }).ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Mock IntersectionObserver
(globalThis as typeof globalThis & { IntersectionObserver: typeof IntersectionObserver }).IntersectionObserver = class IntersectionObserver {
  root = null;
  rootMargin = '';
  thresholds = [];

  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
};

// XMLHttpRequest mock configuration
interface XHRMockConfig {
  status: number;
  responseText: string;
  shouldFail?: boolean;
  shouldAbort?: boolean;
  progressEvents?: number[];
}

let xhrMockConfig: XHRMockConfig = {
  status: 200,
  responseText: '{"success": true}',
  shouldFail: false,
  shouldAbort: false,
  progressEvents: [0.25, 0.5, 0.75, 1.0],
};

// Helper functions to configure XHR mock behavior
export const mockXHRResponse = (status: number, responseText: string) => {
  xhrMockConfig.status = status;
  xhrMockConfig.responseText = responseText;
  xhrMockConfig.shouldFail = false;
  xhrMockConfig.shouldAbort = false;
};

export const mockXHRError = () => {
  xhrMockConfig.shouldFail = true;
  xhrMockConfig.shouldAbort = false;
};

export const mockXHRAbort = () => {
  xhrMockConfig.shouldAbort = true;
  xhrMockConfig.shouldFail = false;
};

export const mockXHRProgress = (progressPoints: number[]) => {
  xhrMockConfig.progressEvents = progressPoints;
};

export const resetXHRMock = () => {
  xhrMockConfig = {
    status: 200,
    responseText: '{"success": true}',
    shouldFail: false,
    shouldAbort: false,
    progressEvents: [0.25, 0.5, 0.75, 1.0],
  };
};

// Mock XMLHttpRequest
class MockXMLHttpRequest {
  public readyState = 0;
  public status = 0;
  public statusText = '';
  public responseText = '';
  public responseType = '';
  public response: unknown = null;
  public upload: {
    addEventListener: (event: string, handler: (e: unknown) => void) => void;
    removeEventListener: (event: string, handler: (e: unknown) => void) => void;
    dispatchEvent: (event: Event) => boolean;
  };

  private url = '';
  private method = '';
  private requestHeaders: Record<string, string> = {};
  private eventListeners: Record<string, ((e: unknown) => void)[]> = {};
  private uploadEventListeners: Record<string, ((e: unknown) => void)[]> = {};
  private isAborted = false;

  constructor() {
    this.upload = {
      addEventListener: (event: string, handler: (e: unknown) => void) => {
        if (!this.uploadEventListeners[event]) {
          this.uploadEventListeners[event] = [];
        }
        this.uploadEventListeners[event].push(handler);
      },
      removeEventListener: (event: string, handler: (e: unknown) => void) => {
        if (this.uploadEventListeners[event]) {
          this.uploadEventListeners[event] = this.uploadEventListeners[event].filter(h => h !== handler);
        }
      },
      dispatchEvent: (event: Event) => {
        const handlers = this.uploadEventListeners[event.type] || [];
        handlers.forEach(handler => handler(event));
        return true;
      },
    };
  }

  open(method: string, url: string): void {
    this.method = method;
    this.url = url;
    this.readyState = 1;
  }

  setRequestHeader(name: string, value: string): void {
    this.requestHeaders[name] = value;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  send(_body?: Document | XMLHttpRequestBodyInit | null): void {
    this.readyState = 2;

    // Simulate async behavior
    setTimeout(() => {
      if (this.isAborted) return;

      // Simulate upload progress events
      const progressPoints = xhrMockConfig.progressEvents || [0.25, 0.5, 0.75, 1.0];
      let progressIndex = 0;

      const simulateProgress = () => {
        if (this.isAborted || progressIndex >= progressPoints.length) {
          // After all progress events, handle completion
          setTimeout(() => this.handleCompletion(), 50);
          return;
        }

        const progress = progressPoints[progressIndex];
        const loaded = Math.floor(1000000 * progress);
        const total = 1000000;

        const progressEvent = {
          type: 'progress',
          loaded,
          total,
          lengthComputable: true,
        };

        // Dispatch to upload.addEventListener handlers
        const handlers = this.uploadEventListeners['progress'] || [];
        handlers.forEach(handler => handler(progressEvent));

        progressIndex++;
        setTimeout(simulateProgress, 50);
      };

      simulateProgress();
    }, 10);
  }

  private handleCompletion(): void {
    if (this.isAborted) return;

    if (xhrMockConfig.shouldAbort) {
      this.abort();
      return;
    }

    if (xhrMockConfig.shouldFail) {
      this.readyState = 4;
      this.status = 0;
      this.statusText = 'Network Error';
      this.dispatchEvent({ type: 'error' });
      return;
    }

    // Success case
    this.readyState = 4;
    this.status = xhrMockConfig.status;
    this.responseText = xhrMockConfig.responseText;
    this.response = xhrMockConfig.responseText;
    this.statusText = this.status >= 200 && this.status < 300 ? 'OK' : 'Error';

    this.dispatchEvent({ type: 'load' });
  }

  abort(): void {
    this.isAborted = true;
    this.readyState = 4;
    this.status = 0;
    this.statusText = 'Aborted';
    this.dispatchEvent({ type: 'abort' });
  }

  addEventListener(event: string, handler: (e: unknown) => void): void {
    if (!this.eventListeners[event]) {
      this.eventListeners[event] = [];
    }
    this.eventListeners[event].push(handler);
  }

  removeEventListener(event: string, handler: (e: unknown) => void): void {
    if (this.eventListeners[event]) {
      this.eventListeners[event] = this.eventListeners[event].filter(h => h !== handler);
    }
  }

  private dispatchEvent(event: { type: string }): void {
    const handlers = this.eventListeners[event.type] || [];
    handlers.forEach(handler => handler(event));

    // Also call onload, onerror, onabort if defined
    if (event.type === 'load' && (this as Record<string, unknown>).onload) {
      ((this as Record<string, unknown>).onload as (e: unknown) => void)(event);
    }
    if (event.type === 'error' && (this as Record<string, unknown>).onerror) {
      ((this as Record<string, unknown>).onerror as (e: unknown) => void)(event);
    }
    if (event.type === 'abort' && (this as Record<string, unknown>).onabort) {
      ((this as Record<string, unknown>).onabort as (e: unknown) => void)(event);
    }
  }

  getAllResponseHeaders(): string {
    return 'content-type: application/json\r\n';
  }

  getResponseHeader(name: string): string | null {
    if (name.toLowerCase() === 'content-type') {
      return 'application/json';
    }
    return null;
  }
}

// Assign mock to global
(globalThis as typeof globalThis & { XMLHttpRequest: typeof XMLHttpRequest }).XMLHttpRequest = MockXMLHttpRequest as unknown as typeof XMLHttpRequest;
