import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";

import { usePlayer } from "../../contexts/playercontext";
import WoodButton from "./WoodButton";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function ChatOverlay({ open, onClose }: Props) {
  const { chats, roomCode, me, sendWS } = usePlayer();
  const [text, setText] = useState("");
  const listRef = useRef<FlatList<any> | null>(null);
  const { width, height } = useWindowDimensions();

  const data = useMemo(() => (Array.isArray(chats) ? chats : []), [chats]);
  const myId = String((me as any)?.id ?? "");
  const panelWidth = Math.min(width - 20, 460);
  const panelHeight = Math.min(height * 0.62, 500);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => listRef.current?.scrollToEnd?.({ animated: true }), 70);
    return () => clearTimeout(t);
  }, [open, data.length]);

  if (!open) return null;

  const sendChat = () => {
    const clean = String(text ?? "").replace(/\s+/g, " ").trim();
    if (!clean || !roomCode) return;
    sendWS({ type: "chat_message", roomCode, text: clean });
    setText("");
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={s.wrap}
      pointerEvents="box-none"
    >
      <View style={[s.panel, { width: panelWidth, height: panelHeight }]}> 
        <View style={s.header}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={s.kicker}>ROOM CHAT</Text>
            <Text style={s.title}>Messages in {roomCode || "Room"}</Text>
          </View>
          <WoodButton title="Close" onPress={onClose} style={s.closeBtn} />
        </View>

        <FlatList
          ref={listRef as any}
          data={data}
          keyExtractor={(item) => String(item?.id ?? Math.random())}
          contentContainerStyle={s.listContent}
          renderItem={({ item }) => {
            const mine = String(item?.playerId ?? "") === myId;
            return (
              <View style={[s.msgRow, mine ? s.msgRowMine : null]}>
                <View style={[s.msgBubble, mine ? s.msgBubbleMine : null]}>
                  <Text style={s.msgName}>{mine ? "You" : String(item?.name ?? "Player")}</Text>
                  <Text style={s.msgText}>{String(item?.text ?? "")}</Text>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={<Text style={s.empty}>No messages yet.</Text>}
          onContentSizeChange={() => listRef.current?.scrollToEnd?.({ animated: true })}
        />

        <View style={s.inputRow}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Write a message..."
            placeholderTextColor="rgba(255,255,255,0.45)"
            style={s.input}
            multiline
            maxLength={180}
          />
          <WoodButton title="Send" onPress={sendChat} disabled={!String(text).trim()} style={s.sendBtn} />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 10,
    right: 10,
    top: 86,
    zIndex: 1790,
    alignItems: "center",
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
    minWidth: 84,
    height: 34,
  },
  listContent: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
    gap: 8,
    flexGrow: 1,
  },
  msgRow: {
    flexDirection: "row",
    justifyContent: "flex-start",
  },
  msgRowMine: {
    justifyContent: "flex-end",
  },
  msgBubble: {
    maxWidth: "84%",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 9,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  msgBubbleMine: {
    backgroundColor: "rgba(117,72,30,0.95)",
    borderColor: "rgba(255,214,138,0.20)",
  },
  msgName: {
    color: "#F3CC86",
    fontSize: 11,
    fontWeight: "900",
    marginBottom: 4,
  },
  msgText: {
    color: "white",
    fontSize: 14,
    lineHeight: 19,
    fontWeight: "700",
  },
  empty: {
    color: "rgba(255,255,255,0.62)",
    textAlign: "center",
    paddingVertical: 22,
    fontWeight: "700",
  },
  inputRow: {
    padding: 10,
    gap: 8,
    flexDirection: "row",
    alignItems: "flex-end",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.07)",
    backgroundColor: "rgba(0,0,0,0.12)",
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 110,
    color: "white",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  sendBtn: {
    minWidth: 84,
    height: 42,
  },
});
