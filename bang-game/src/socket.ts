export const WS_URL = "ws://192.168.0.106:3000";

let ws: WebSocket | null = null;

export function getWS() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    return ws;
  }
  ws = new WebSocket(WS_URL);
  return ws;
}
