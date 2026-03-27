import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  ImageBackground,
  Alert,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  Share,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { usePlayer } from "../contexts/playercontext";
import { WS_URL } from "./createroomscreen";
import WoodButton from "./game/WoodButton";
import { useAmbientMusic } from "./game/useAmbientMusic";
import { useUiSounds } from "./game/useUiSounds";
import LobbyChatPanel from "./game/LobbyChatPanel";

type Phase = "idle" | "joining" | "joined";

type FeedItem = {
  id: string;
  text: string;
  kind: "join" | "leave" | "info";
};

export default function JoinRoomScreen() {
  const navigation = useNavigation<any>();

  useAmbientMusic("lobby");
  const { playJoin, playLeave } = useUiSounds();

  const {
    name,
    ws,
    wsStatus,
    connectWS,
    clientSessionId,
    sendWS,
    leaveRoom,
    resetAll,
    roomCode,
    lobbyPlayers,
    setRoomCode,
    hostId,
    lobbyPlayerId,
  } = usePlayer();

  const [phase, setPhase] = useState<Phase>("idle");
  const [inputCode, setInputCode] = useState("");
  const [joinedCode, setJoinedCode] = useState("");
  const joinSentRef = useRef(false);

  const maxPlayers = 7;
  const playersCount = lobbyPlayers.length;
  const canStart = playersCount >= 4;
  const isHost = !!lobbyPlayerId && !!hostId && lobbyPlayerId === hostId;

  const shownCode = useMemo(() => roomCode || joinedCode || ".....", [roomCode, joinedCode]);
  const showLobby = phase === "joined" || (!!roomCode && playersCount > 0);

  const hostName = useMemo(() => {
    return lobbyPlayers.find((p) => String(p.id) === String(hostId))?.name ?? "";
  }, [lobbyPlayers, hostId]);

  const [feed, setFeed] = useState<FeedItem[]>([{ id: "info0", text: "Waiting room…", kind: "info" }]);
  const prevIdsRef = useRef<Set<string>>(new Set());
  const prevHostRef = useRef("");
  const feedListRef = useRef<FlatList<FeedItem>>(null);
  const leavingRef = useRef(false);

  const handleBack = () => {
    if (leavingRef.current) return;
    leavingRef.current = true;

    leaveRoom();
    setTimeout(() => {
      resetAll();
      navigation.goBack();
      leavingRef.current = false;
    }, 140);
  };

  const handleShareRoom = async () => {
    if (!shownCode || shownCode === ".....") {
      Alert.alert("No room yet", "Join a room first.");
      return;
    }

    try {
      await Share.share({
        title: "BANG! room invite",
        message:
          `🤠 Join my BANG! room\n` +
          `Room code: ${shownCode}\n` +
          `Open the game, choose Join Room, then enter this code.`,
      });
    } catch {
      Alert.alert("Share failed", "Could not open the share menu.");
    }
  };

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

    joinSentRef.current = false;
    setJoinedCode(code);
    setPhase("joining");

    if (wsStatus !== "open") {
      connectWS(WS_URL);
    }
  };

  const handleStart = () => {
    if (!showLobby || !shownCode || shownCode === ".....") {
      Alert.alert("No room", "Join a room first.");
      return;
    }
    if (!isHost) {
      Alert.alert("Host only", "Only the current host can start the game.");
      return;
    }
    if (!canStart) {
      Alert.alert("Not enough players", "Need at least 4 players to start.");
      return;
    }
    if (wsStatus !== "open") {
      Alert.alert("Not connected", "WebSocket is not open yet.");
      return;
    }

    sendWS({ type: "start", roomCode: shownCode });
  };

  useEffect(() => {
    if (phase !== "joining") return;
    if (wsStatus !== "open") return;
    if (!joinedCode) return;
    if (joinSentRef.current) return;

    if (lobbyPlayerId && roomCode && roomCode === joinedCode) {
      return;
    }

    joinSentRef.current = true;
    sendWS({ type: "join", roomCode: joinedCode, name: name.trim(), clientSessionId });
  }, [phase, wsStatus, joinedCode, name, sendWS, lobbyPlayerId, roomCode, clientSessionId]);

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
        joinSentRef.current = false;
        setPhase("idle");
        Alert.alert("Join failed", msg.message ?? "Room not found");
        return;
      }

      if (msg.type === "joined" || msg.type === "reconnected") {
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
      }
    };

    ws.addEventListener("message", onMsg);
    return () => ws.removeEventListener("message", onMsg);
  }, [ws, joinedCode, navigation, setRoomCode]);

  useEffect(() => {
    if (!showLobby) return;

    const prev = prevIdsRef.current;
    const now = new Set(lobbyPlayers.map((p: any) => String(p.id)));

    const added = lobbyPlayers.filter((p: any) => !prev.has(String(p.id)));
    const removedIds = [...prev].filter((id) => !now.has(id));

    if (added.length === 0 && removedIds.length === 0) return;

    const newItems: FeedItem[] = [];

    for (const p of added) {
      newItems.push({
        id: `${Date.now()}_join_${p.id}`,
        text: `${p.name ?? "Player"} joined`,
        kind: "join",
      });
    }

    for (const id of removedIds) {
      newItems.push({
        id: `${Date.now()}_leave_${id}`,
        text: "Someone left",
        kind: "leave",
      });
    }

    prevIdsRef.current = now;
    if (added.length > 0) playJoin();
    if (removedIds.length > 0) playLeave();
    setFeed((old) => [...old, ...newItems]);
  }, [lobbyPlayers, showLobby, playJoin, playLeave]);

  useEffect(() => {
    if (!showLobby) {
      prevHostRef.current = hostId;
      return;
    }

    if (!hostId) return;
    if (prevHostRef.current && prevHostRef.current !== hostId) {
      const nextHostName = lobbyPlayers.find((p) => String(p.id) === String(hostId))?.name ?? "A player";
      setFeed((old) => [
        ...old,
        {
          id: `${Date.now()}_host_${hostId}`,
          text: `${nextHostName} is now the host`,
          kind: "info",
        },
      ]);
    }
    prevHostRef.current = hostId;
  }, [hostId, lobbyPlayers, showLobby]);

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
        <WoodButton title="Back" onPress={handleBack} style={styles.topBtn} />

        {showLobby && (
          <View style={styles.codeBadge}>
            <Text style={styles.codeLabel}>ROOM</Text>
            <Text style={styles.codeText}>{shownCode}</Text>
            <Text style={[styles.codeLabel, { marginTop: 6 }]}>PLAYERS</Text>
            <Text style={styles.playersTopText}>{playersCount}/{maxPlayers}</Text>
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

            <WoodButton
              title={phase === "joining" ? "Joining..." : "Join"}
              onPress={handleJoin}
              disabled={phase === "joining"}
              style={styles.singleBtn}
            />
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
            <Text style={styles.muted}>
              {isHost
                ? "You are the host now. You can share the room and start the game."
                : hostName
                ? `${hostName} will decide when to start.`
                : "Waiting for host to start…"}
            </Text>

            <View style={styles.playersBox}>
              <Text style={styles.sectionTitle}>Players</Text>
              {lobbyPlayers.length === 0 ? (
                <Text style={styles.smallMuted}>No players yet…</Text>
              ) : (
                lobbyPlayers.map((p: any, i: number) => {
                  const rowIsHost = String(p.id) === String(hostId);
                  const rowIsMe = String(p.id) === String(lobbyPlayerId);
                  return (
                    <View key={p.id ?? String(i)} style={styles.playerRow}>
                      <Text style={styles.playerLine}>
                        {rowIsMe ? "• You" : `• ${p.name ?? "Unknown"}`}
                      </Text>
                      {rowIsHost ? <Text style={styles.hostTag}>HOST</Text> : null}
                    </View>
                  );
                })
              )}
            </View>

            <View style={styles.actionsRow}>
              <WoodButton title="Share Room" onPress={handleShareRoom} style={styles.actionBtn} />
              <WoodButton
                title={isHost ? "Start" : "Host Starts"}
                onPress={handleStart}
                disabled={!isHost || !canStart || wsStatus !== "open"}
                style={styles.actionBtn}
              />
            </View>

            {!isHost && (
              <Text style={styles.hostHint}>
                If the host leaves the lobby, the next player becomes host automatically.
              </Text>
            )}

            <View style={styles.chatBox}>
              <Text style={styles.sectionTitle}>Lobby Feed</Text>

              <FlatList
                ref={feedListRef}
                data={feed}
                keyExtractor={(x) => x.id}
                showsVerticalScrollIndicator={false}
                style={{ maxHeight: 160, marginTop: 8 }}
                renderItem={({ item }) => (
                  <View
                    style={[
                      styles.msgBubble,
                      item.kind === "join" && styles.msgJoin,
                      item.kind === "leave" && styles.msgLeave,
                      item.kind === "info" && styles.msgInfo,
                    ]}
                  >
                    <Text style={styles.msgText}>{item.text}</Text>
                  </View>
                )}
                onContentSizeChange={() =>
                  feedListRef.current?.scrollToEnd({ animated: true })
                }
              />
            </View>
          </>
        )}
      </View>

      {showLobby ? <LobbyChatPanel /> : null}
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.35)" },
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
  topBtn: { width: 118, height: 44 },
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
  codeLabel: { color: "rgba(255,255,255,0.75)", fontSize: 12, fontWeight: "800" },
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
  title: { color: "white", fontSize: 26, fontWeight: "900", marginBottom: 10 },
  input: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    backgroundColor: "rgba(0,0,0,0.20)",
    color: "white",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontWeight: "800",
    letterSpacing: 1,
  },
  singleBtn: { marginTop: 14, height: 48 },
  muted: { color: "rgba(255,255,255,0.75)", fontWeight: "700", marginTop: 10, lineHeight: 20 },
  smallMuted: { color: "rgba(255,255,255,0.65)", fontWeight: "700", marginTop: 6 },
  playersBox: {
    marginTop: 14,
    padding: 14,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.24)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  sectionTitle: { color: "#fff4d6", fontSize: 18, fontWeight: "900" },
  playerRow: {
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.06)",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  playerLine: { color: "white", fontWeight: "800", fontSize: 16 },
  hostTag: {
    color: "#fff4d6",
    fontWeight: "900",
    fontSize: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: "rgba(110,45,10,0.85)",
    overflow: "hidden",
  },
  actionsRow: { flexDirection: "row", gap: 12, marginTop: 16 },
  actionBtn: { flex: 1, height: 48 },
  hostHint: {
    marginTop: 10,
    color: "rgba(255,255,255,0.7)",
    textAlign: "center",
    fontWeight: "700",
  },
  chatBox: {
    marginTop: 16,
    borderRadius: 18,
    padding: 12,
    backgroundColor: "rgba(0,0,0,0.24)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  msgBubble: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    marginBottom: 8,
  },
  msgJoin: { backgroundColor: "rgba(58, 126, 52, 0.35)" },
  msgLeave: { backgroundColor: "rgba(140, 48, 48, 0.32)" },
  msgInfo: { backgroundColor: "rgba(120, 88, 20, 0.32)" },
  msgText: { color: "white", fontWeight: "700" },
});