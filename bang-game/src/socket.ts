export const WS_URL = "ws://10.14.3.212:3000";

let ws: WebSocket | null = null;

export function getWS() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    return ws;
  }
  ws = new WebSocket(WS_URL);
  return ws;
}
