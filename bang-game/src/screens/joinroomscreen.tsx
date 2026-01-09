import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  TextInput,
  ImageBackground,
  Alert,
  StyleSheet,
  ActivityIndicator,
  FlatList,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { usePlayer } from "../contexts/playercontext";

export const WS_URL = "ws://10.10.1.98:3000";

type Phase = "idle" | "joining" | "joined";

type FeedItem = {
  id: string;
  text: string;
  kind: "join" | "leave" | "info";
};

export default function JoinRoomScreen() {
  const navigation = useNavigation<any>();

  const {
    name,
    ws,
    wsStatus,
    connectWS,
    sendWS,
    roomCode,
    lobbyPlayers,
    setRoomCode,
  } = usePlayer();

  const [phase, setPhase] = useState<Phase>("idle");
  const [inputCode, setInputCode] = useState("");
  const [joinedCode, setJoinedCode] = useState("");

  const maxPlayers = 7;
  const playersCount = lobbyPlayers.length;

  const goHome = () => navigation.navigate("Home");

  const handleJoin = () => {
    const code = inputCode.trim().toUpperCase();

    if (code.length < 4) {
      Alert.alert("Wrong code", "Enter a valid room code.");
      return;
    }
    if (!name || name.trim().length < 2) {
      Alert.alert("Name missing", "Go to Profile and set your name first.");
      return;
    }

    connectWS(WS_URL);

    setJoinedCode(code);
    setPhase("joining");

    if (wsStatus === "open") {
      sendWS({ type: "join", roomCode: code, name: name.trim() });
    }
  };

  useEffect(() => {
    if (phase !== "joining") return;
    if (wsStatus !== "open") return;
    if (!joinedCode) return;

    sendWS({
      type: "join",
      roomCode: joinedCode,
      name: name.trim(),
    });
  }, [phase, wsStatus, joinedCode, name, sendWS]);

  useEffect(() => {
    if (!ws) return;

    const onMsg = (e: any) => {
      let msg: any;
      try {
        msg = JSON.parse(e.data);
      } catch {
        return;
      }

      if (msg.type === "error") {
        setPhase("idle");
        Alert.alert("Join failed", msg.message ?? "Room not found");
        return;
      }

      if (msg.type === "joined") {
        const code = typeof msg.roomCode === "string" ? msg.roomCode : joinedCode;
        if (code) {
          setJoinedCode(code);
          setRoomCode(code);
        }
        setPhase("joined");
        return;
      }

      if (msg.type === "room_update") {
        const code = typeof msg.roomCode === "string" ? msg.roomCode : joinedCode;
        if (code) {
          setJoinedCode(code);
          setRoomCode(code);
        }
        setPhase("joined");
        return;
      }

      if (msg.type === "started") {
        const code = typeof msg.roomCode === "string" ? msg.roomCode : joinedCode;
        if (code) setRoomCode(code);
        navigation.navigate("GameScreen");
        return;
      }
    };

    ws.addEventListener("message", onMsg);
    return () => {
      ws.removeEventListener("message", onMsg);
    };
  }, [ws, joinedCode, navigation, setRoomCode]);

  const showLobby = phase === "joined" || (!!roomCode && playersCount > 0);

  const shownCode = useMemo(() => {
    return roomCode || joinedCode || ".....";
  }, [roomCode, joinedCode]);

  const [feed, setFeed] = useState<FeedItem[]>([
    { id: "info0", text: "Waiting room…", kind: "info" },
  ]);
  const prevIdsRef = useRef<Set<string>>(new Set());
  const feedListRef = useRef<FlatList<FeedItem>>(null);

  useEffect(() => {
    if (!showLobby) return;

    const prev = prevIdsRef.current;
    const now = new Set(lobbyPlayers.map((p: any) => String(p.id)));

    const added: any[] = lobbyPlayers.filter((p: any) => !prev.has(String(p.id)));
    const removedIds: string[] = [...prev].filter((id) => !now.has(id));

    if (added.length === 0 && removedIds.length === 0) return;

    const newItems: FeedItem[] = [];

    for (const p of added) {
      newItems.push({
        id: `${Date.now()}_join_${p.id}`,
        text: ` ${p.name ?? "Player"} joined`,
        kind: "join",
      });
    }

        for (const id of removedIds) {
      newItems.push({
        id: `${Date.now()}_leave_${id}`,
        text: ` Someone left`,
        kind: "leave",
      });
    }

    prevIdsRef.current = now;
    setFeed((old) => [...old, ...newItems]);
  }, [lobbyPlayers, showLobby]);

  useEffect(() => {
    if (!showLobby) return;
    const t = setTimeout(() => {
      feedListRef.current?.scrollToEnd({ animated: true });
    }, 50);
    return () => clearTimeout(t);
  }, [feed, showLobby]);

  return (
    <ImageBackground
      source={require("../../assets/homescreen3.png")}
      style={{ flex: 1 }}
      resizeMode="cover"
    >
      <View style={styles.overlay} />

      <View style={styles.topBar}>
        <Pressable onPress={goHome} style={styles.backBtn}>
          <Text style={styles.backText}>← Back to Home</Text>
        </Pressable>

        {showLobby && (
          <View style={styles.codeBadge}>
            <Text style={styles.codeLabel}>ROOM</Text>
            <Text style={styles.codeText}>{shownCode}</Text>

            <Text style={[styles.codeLabel, { marginTop: 6 }]}>PLAYERS</Text>
            <Text style={styles.playersTopText}>
              {playersCount}/{maxPlayers}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>{showLobby ? "Waiting Room" : "Join Room"}</Text>

        {!showLobby && (
          <>
            <TextInput
              placeholder="Enter room code"
              placeholderTextColor="rgba(255,255,255,0.6)"
              value={inputCode}
              onChangeText={setInputCode}
              autoCapitalize="characters"
              style={styles.input}
            />

            <Pressable
              onPress={handleJoin}
              disabled={phase === "joining"}
              style={[styles.btn, phase === "joining" && { opacity: 0.6 }]}
            >
              <Text style={styles.btnText}>
                {phase === "joining" ? "Joining..." : "Join"}
              </Text>
            </Pressable>
          </>
        )}

        {phase === "joining" && (
          <View style={{ marginTop: 14, alignItems: "center" }}>
            <ActivityIndicator />
            <Text style={styles.muted}>
              {wsStatus === "open" ? "Joining…" : "Connecting…"}
            </Text>
          </View>
        )}

        {showLobby && (
          <>
            <Text style={styles.muted}>Waiting for host to start…</Text>

            <View style={styles.playersBox}>
              <Text style={styles.sectionTitle}>Players</Text>
              {lobbyPlayers.length === 0 ? (
                <Text style={styles.smallMuted}>No players yet…</Text>
              ) : (
                lobbyPlayers.map((p: any, i: number) => (
                  <Text key={p.id ?? String(i)} style={styles.playerLine}>
                    • {p.name ?? "Unknown"}
                  </Text>
                ))
              )}
            </View>

            <View style={styles.chatBox}>
              <Text style={styles.sectionTitle}>Lobby Feed</Text>

              <FlatList
                ref={feedListRef}
                data={feed}
                keyExtractor={(x) => x.id}
                showsVerticalScrollIndicator={false}
                style={{ maxHeight: 220, marginTop: 8 }}
                renderItem={({ item }) => (
                  <View
                    style={[
                      styles.msgBubble,
                      item.kind === "join" && styles.msgJoin,
                      item.kind === "leave" && styles.msgLeave,
                    ]}
                  >
                    <Text style={styles.msgText}>{item.text}</Text>
                  </View>
                )}
                onContentSizeChange={() => feedListRef.current?.scrollToEnd({ animated: true })}
              />
            </View>
          </>
        )}
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  topBar: {
    position: "absolute",
    top: 52,
    left: 16,
    right: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    zIndex: 10,
  },
  backBtn: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  backText: { color: "white", fontWeight: "900" },
  codeBadge: {
    minWidth: 160,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    alignItems: "flex-end",
  },
  codeLabel: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 12,
    fontWeight: "800",
  },
  codeText: { color: "white", fontSize: 22, fontWeight: "900" },
  playersTopText: { color: "white", fontSize: 16, fontWeight: "900" },
  card: {
    marginTop: 160,
    marginHorizontal: 16,
    borderRadius: 22,
    padding: 16,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },
  title: {
    color: "white",
    fontSize: 26,
    fontWeight: "900",
    marginBottom: 10,
  },
  muted: {
    color: "rgba(255,255,255,0.75)",
    fontWeight: "700",
    marginTop: 10,
  },
  smallMuted: {
    color: "rgba(255,255,255,0.65)",
    fontWeight: "700",
    marginTop: 6,
  },
  input: {
    height: 50,
    borderColor: "rgba(255,255,255,0.35)",
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 12,
    color: "white",
    fontSize: 18,
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  btn: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.35)",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  btnText: { color: "white", fontSize: 18, fontWeight: "900" },

  sectionTitle: {
    color: "rgba(255,255,255,0.9)",
    fontWeight: "900",
    marginTop: 8,
    fontSize: 14,
  },

  playersBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.25)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  playerLine: {
    color: "white",
    fontWeight: "800",
    marginTop: 6,
  },

  chatBox: {
    marginTop: 12,
    padding: 12,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.25)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.14)",
  },
  msgBubble: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    marginBottom: 8,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
  },
  msgJoin: {
    borderColor: "rgba(0, 200, 255, 0.35)",
    backgroundColor: "rgba(0, 200, 255, 0.10)",
  },
  msgLeave: {
    borderColor: "rgba(255, 80, 80, 0.35)",
    backgroundColor: "rgba(255, 80, 80, 0.10)",
  },
  msgText: {
    color: "white",
    fontWeight: "800",
  },
});
