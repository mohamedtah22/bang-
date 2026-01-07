// routes/messageRouter.ts

import WebSocket from "ws";

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

  // ✅ الجديد (choices/abilities)
  handleChooseDraw,
  handleChooseJesseTarget,
  handleChoosePedroSource,
  handleSidHeal,
  handleDiscardToLimit,
} from "../controllers/gameengine";

import { wsToRoom } from "../controllers/state";

/** ---------- utils ---------- */

function safeSend(ws: any, obj: any) {
  try {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(obj));
    }
  } catch {}
}

function normalizeCode(code: any) {
  return String(code || "").toUpperCase().trim();
}

/**
 * هل لازم roomCode؟
 * - create/join: لا (لأنه لسا مش داخل روم)
 * - leave: لا (السيرفر بعرف الروم من wsToRoom)
 * - باقي الرسائل: نعم
 */
function mustHaveRoomCode(type: string) {
  return !["create", "join", "leave"].includes(type);
}

/**
 * تأكد إن msg.roomCode يطابق الروم المرتبط بالـ ws
 */
function assertRoomMatches(ws: any, msg: any) {
  const info = wsToRoom.get(ws);
  if (!info) throw new Error("You are not in a room");

  const msgCode = normalizeCode(msg.roomCode);
  if (!msgCode) throw new Error("Missing roomCode");

  if (msgCode !== info.roomCode) {
    throw new Error("roomCode does not match your current room");
  }
}

/** ---------- router ---------- */

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
      /** ================== lobby ================== */

      case "create":
        // msg: { type:"create", name?:string }
        return handleCreate(ws, msg);

      case "join":
        // msg: { type:"join", roomCode:string, name?:string }
        return handleJoin(ws, msg);

      case "leave":
        // msg: { type:"leave" }  (roomCode اختياري)
        return handleLeave(ws);

      case "start":
        // msg: { type:"start", roomCode:string }
        return handleStart(ws);

      /** ================== game engine ================== */

      case "play_card":
        // msg: { type:"play_card", roomCode:string, cardId:string, targetId?:string }
        return handlePlayCard(ws, msg);

      case "respond":
        // msg: { type:"respond", roomCode:string, cardId?:string } (بدون cardId = pass)
        return handleRespond(ws, msg);

      case "end_turn":
        // msg: { type:"end_turn", roomCode:string }
        return handleEndTurn(ws, msg);

      /** ================== ✅ الجديد (choices/abilities) ================== */

      case "choose_draw":
        // Kit Carlson:
        // msg: { type:"choose_draw", roomCode:string, cardIds:string[] }
        return handleChooseDraw(ws, msg);

      case "choose_jesse_target":
        // Jesse Jones:
        // msg: { type:"choose_jesse_target", roomCode:string, targetId?:string }  (بدون targetId = skip)
        return handleChooseJesseTarget(ws, msg);

      case "choose_pedro_source":
        // Pedro Ramirez:
        // msg: { type:"choose_pedro_source", roomCode:string, source:"deck"|"discard" }
        return handleChoosePedroSource(ws, msg);

      case "sid_heal":
        // Sid Ketchum ability:
        // msg: { type:"sid_heal", roomCode:string, cardIds:string[] } (لازم 2)
        return handleSidHeal(ws, msg);

      case "discard_to_limit":
        // end turn hand limit:
        // msg: { type:"discard_to_limit", roomCode:string, cardIds:string[] }
        return handleDiscardToLimit(ws, msg);

      default:
        safeSend(ws, { type: "error", message: "Unknown type" });
        return;
    }
  } catch (e: any) {
    safeSend(ws, { type: "error", message: e?.message || "Server error" });
  }
}
