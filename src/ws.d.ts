declare module 'ws' {
  import { EventEmitter } from 'node:events';
  class WebSocket extends EventEmitter {
    constructor(url: string, options?: object);
    onopen: ((ev: unknown) => void) | null;
    onclose: ((ev: unknown) => void) | null;
    onmessage: ((ev: { data: string }) => void) | null;
    onerror: ((ev: unknown) => void) | null;
    readyState: number;
    send(data: string): void;
    close(): void;
  }
  export = WebSocket;
}
