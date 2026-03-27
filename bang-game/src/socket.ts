export const WS_URL = "wss://bang-game-server.onrender.com";let ws: WebSocket | null = null;

export function getWS() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    return ws;
  }
  ws = new WebSocket(WS_URL);
  return ws;
}
