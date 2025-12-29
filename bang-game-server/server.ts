import http from "http";
import WebSocket, { WebSocketServer } from "ws";
import { routeMessage } from "./routes/joinandcreateroutes";

function makeId() {
  return Math.random().toString(36).slice(2, 10);
}

const server = http.createServer((_req, res) => {
  res.writeHead(200);
  res.end("WS server running");
});

const wss = new WebSocketServer({ server });

wss.on("connection", (ws: any) => {
  ws._id = makeId();

  ws.on("message", (raw: WebSocket.RawData) => {
  let msg: any;
  try {
    msg = JSON.parse(raw.toString());
  } catch {
    ws.send(JSON.stringify({ type: "error", message: "Invalid JSON" }));
    return;
  }
  routeMessage(ws, msg);
  console.log(`Received message from ${ws._id}:`, msg);
});
  ws.on("close", () => {
    routeMessage(ws, { type: "leave" });
  });
});

server.listen(3000, "0.0.0.0", () => console.log("WS on 0.0.0.0:3000"));
