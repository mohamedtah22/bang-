// routes/messageRouter.ts

import {
  handleCreate,
  handleJoin,
  handleLeave,
  handleStart,
} from "../controllers/startandjoincontroller";

import {
  handlePlayCard,
  handleRespond,
  handleEndTurn,
} from "../controllers/gameengine";

import { wsToRoom } from "../controllers/state";

function safeSend(ws: any, obj: any) {
  try {
    ws?.send?.(JSON.stringify(obj));
  } catch {}
}

function normalizeCode(code: any) {
  return String(code || "").toUpperCase().trim();
}

/**
 * هل لازم roomCode؟
 * - create/join: لا (لأنه لسا مش داخل روم)
 * - باقي الرسائل: نعم
 */
function mustHaveRoomCode(type: string) {
  return !["create", "join"].includes(type);
}

/**
 * تأكد إن msg.roomCode يطابق الروم المرتبط بالـ ws
 */
function assertRoomMatches(ws: any, msg: any) {
  const info = wsToRoom.get(ws);
  if (!info) throw new Error("You are not in a room");

  const msgCode = normalizeCode(msg.roomCode);
  if (!msgCode) throw new Error("Missing roomCode");

  if (msgCode !== info.roomCode) throw new Error("roomCode does not match your current room");
}

export function routeMessage(ws: any, msg: any) {
  if (!msg || typeof msg !== "object") {
    safeSend(ws, { type: "error", message: "Invalid message" });
    return;
  }

  if (typeof msg.type !== "string") {
    safeSend(ws, { type: "error", message: "Missing type" });
    return;
  }

  try {
    // ✅ إذا الرسالة لازم فيها roomCode، افحصه
    if (mustHaveRoomCode(msg.type)) {
      assertRoomMatches(ws, msg);
    }

    switch (msg.type) {
      case "create":
        // msg: { type:"create", name?:string }
        return handleCreate(ws, msg);

      case "join":
        // msg: { type:"join", roomCode:string, name?:string }
        return handleJoin(ws, msg);

      case "leave":
        // msg: { type:"leave", roomCode:string }
        return handleLeave(ws);

      case "start":
        // msg: { type:"start", roomCode:string }
        return handleStart(ws);

      case "play_card":
        // msg: { type:"play_card", roomCode:string, cardId:string, targetId?:string }
        return handlePlayCard(ws, msg);

      case "respond":
        // msg: { type:"respond", roomCode:string, cardId?:string }
        return handleRespond(ws, msg);

      case "end_turn":
        // msg: { type:"end_turn", roomCode:string }
        return handleEndTurn(ws);

      default:
        safeSend(ws, { type: "error", message: "Unknown type" });
        return;
    }
  } catch (e: any) {
    safeSend(ws, { type: "error", message: e?.message || "Server error" });
  }
}
