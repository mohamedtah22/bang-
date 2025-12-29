// src/network/wsClient.ts
export const WS_URL = "ws://localhost:3000";

export type WSHandlers = {
  onOpen?: () => void;
  onClose?: (ev: any) => void;
  onError?: (ev: any) => void;
  onMessage?: (data: any) => void;
};

export function connectWS(handlers: WSHandlers) {
  const ws = new WebSocket(WS_URL);

  ws.onopen = () => handlers.onOpen?.();

  ws.onclose = (ev: any) => handlers.onClose?.(ev);

  ws.onerror = (ev: any) => handlers.onError?.(ev);

  ws.onmessage = (ev: any) => {
    try {
      const data = JSON.parse(ev.data);
      handlers.onMessage?.(data);
    } catch {
      // ignore non-json
    }
  };

  return ws;
}

export function sendJSON(ws: WebSocket | null, obj: any) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return false;
  ws.send(JSON.stringify(obj));
  return true;
}
