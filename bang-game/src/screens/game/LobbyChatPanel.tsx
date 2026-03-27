import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";

import { usePlayer } from "../../contexts/playercontext";
import WoodButton from "../game/WoodButton";
import { useUiSounds } from "../game/useUiSounds";

export default function LobbyChatPanel() {
  const { chats, roomCode, me, sendWS, wsStatus } = usePlayer();
  const { playChat } = useUiSounds();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [seenIds, setSeenIds] = useState<Set<string>>(new Set());
  const listRef = useRef<FlatList<any> | null>(null);
  const { width, height } = useWindowDimensions();

  const myId = String((me as any)?.id ?? "");
  const data = useMemo(() => (Array.isArray(chats) ? chats : []), [chats]);
  const unreadCount = useMemo(() => data.filter((item: any) => String(item?.playerId ?? "") !== myId && !seenIds.has(String(item?.id ?? ""))).length, [data, myId, seenIds]);
  const panelWidth = Math.min(width - 22, 460);
  const panelHeight = Math.min(height * 0.58, 500);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => listRef.current?.scrollToEnd?.({ animated: true }), 60);
    return () => clearTimeout(t);
  }, [open, data.length]);

  useEffect(() => {
    if (!open) return;
    setSeenIds(new Set(data.map((item: any) => String(item?.id ?? ""))));
  }, [open, data]);

  const prevLenRef = useRef(data.length);
  useEffect(() => {
    const prevLen = prevLenRef.current;
    if (data.length > prevLen) {
      const incoming = data.slice(prevLen).filter((item: any) => String(item?.playerId ?? "") !== myId);
      if (incoming.length > 0) {
        playChat();
      }
    }
    prevLenRef.current = data.length;
  }, [data, myId, playChat]);

  const sendChat = () => {
    const clean = String(text ?? "").replace(/\s+/g, " ").trim();
    if (!clean || !roomCode || wsStatus !== "open") return;
    sendWS({ type: "chat_message", roomCode, text: clean });
    setText("");
  };

  return (
    <>
      <View pointerEvents="box-none" style={s.fabWrap}>
        <WoodButton
          title={open ? "CLOSE" : "CHAT"}
          onPress={() => setOpen((v) => !v)}
          style={s.fabBtn}
        />
        {!open && unreadCount > 0 ? (
          <View style={s.badge}>
            <Text style={s.badgeText}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
          </View>
        ) : null}
      </View>

      {open ? (
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={s.overlayWrap}
          pointerEvents="box-none"
        >
          <Pressable style={s.backdrop} onPress={() => setOpen(false)} />

          <View style={[s.panel, { width: panelWidth, height: panelHeight }]}> 
            <View style={s.header}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.kicker}>LOBBY CHAT</Text>
                <Text style={s.title}>Messages in {roomCode || "Room"}</Text>
              </View>
              <WoodButton title="Close" onPress={() => setOpen(false)} style={s.closeBtn} />
            </View>

            <FlatList
              ref={listRef as any}
              data={data}
              keyExtractor={(item) => String(item?.id ?? Math.random())}
              style={s.list}
              contentContainerStyle={s.listContent}
              renderItem={({ item }) => {
                const mine = String(item?.playerId ?? "") === myId;
                return (
                  <View style={[s.row, mine ? s.rowMine : null]}>
                    <View style={[s.bubble, mine ? s.bubbleMine : null]}>
                      <Text style={s.name}>{mine ? "You" : String(item?.name ?? "Player")}</Text>
                      <Text style={s.msg}>{String(item?.text ?? "")}</Text>
                    </View>
                  </View>
                );
              }}
              ListEmptyComponent={<Text style={s.empty}>No messages yet.</Text>}
              showsVerticalScrollIndicator={false}
              onContentSizeChange={() => listRef.current?.scrollToEnd?.({ animated: true })}
            />

            <View style={s.inputRow}>
              <TextInput
                value={text}
                onChangeText={setText}
                placeholder={roomCode ? "Write a message..." : "Wait for room..."}
                placeholderTextColor="rgba(255,255,255,0.45)"
                style={s.input}
                multiline
                maxLength={180}
                editable={!!roomCode && wsStatus === "open"}
              />
              <WoodButton
                title="Send"
                onPress={sendChat}
                disabled={!String(text).trim() || !roomCode || wsStatus !== "open"}
                style={s.sendBtn}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      ) : null}
    </>
  );
}

const s = StyleSheet.create({
  fabWrap: {
    position: "absolute",
    right: 16,
    bottom: 22,
    zIndex: 1200,
  },
  fabBtn: {
    width: 126,
    height: 48,
  },
  badge: {
    position: "absolute",
    right: -8,
    top: -6,
    minWidth: 24,
    height: 24,
    paddingHorizontal: 6,
    borderRadius: 12,
    backgroundColor: "#c92a2a",
    borderWidth: 2,
    borderColor: "#ffe7b0",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.28,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },
  badgeText: {
    color: "white",
    fontWeight: "900",
    fontSize: 11,
  },
  overlayWrap: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1300,
    alignItems: "center",
    justifyContent: "center",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.52)",
  },
  panel: {
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: "rgba(34,21,11,0.98)",
    borderWidth: 1,
    borderColor: "rgba(255,215,145,0.28)",
    shadowColor: "#000",
    shadowOpacity: 0.32,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 10,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255,255,255,0.04)",
    gap: 12,
  },
  kicker: {
    color: "#D9B36E",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1,
  },
  title: {
    color: "#FFF3D7",
    fontSize: 18,
    fontWeight: "900",
    marginTop: 2,
  },
  closeBtn: {
    width: 110,
    height: 42,
  },
  list: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.14)",
  },
  listContent: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  row: {
    alignItems: "flex-start",
  },
  rowMine: {
    alignItems: "flex-end",
  },
  bubble: {
    maxWidth: "86%",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.07)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
  },
  bubbleMine: {
    backgroundColor: "rgba(110,45,10,0.82)",
    borderColor: "rgba(255,220,150,0.24)",
  },
  name: {
    color: "#fff4d6",
    fontWeight: "900",
    marginBottom: 4,
    fontSize: 12,
  },
  msg: {
    color: "white",
    fontWeight: "700",
    lineHeight: 18,
  },
  empty: {
    color: "rgba(255,255,255,0.62)",
    fontWeight: "700",
    textAlign: "center",
    marginTop: 10,
  },
  inputRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-end",
    padding: 12,
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 92,
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "white",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    textAlignVertical: "top",
    fontWeight: "700",
  },
  sendBtn: {
    width: 108,
    height: 46,
  },
});
