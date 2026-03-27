import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  Alert,
  StyleSheet,
  ImageBackground,
  Share,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { usePlayer } from "../contexts/playercontext";
import WoodButton from "./game/WoodButton";
import { useAmbientMusic } from "./game/useAmbientMusic";
import { useUiSounds } from "./game/useUiSounds";
import LobbyChatPanel from "./game/LobbyChatPanel";

export const WS_URL = "wss://bang-game-server.onrender.com";
 export default function CreateRoomScreen() {
  const navigation = useNavigation<any>();

  useAmbientMusic("lobby");
  const { playJoin, playLeave } = useUiSounds();


  const {
    name,
    roomCode,
    setRoomCode,
    lobbyPlayerId,
    setLobbyPlayerId,
    hostId,
    setHostId,
    lobbyPlayers,
    setLobbyPlayers,
    setPlayers,
    setMe,
    turnPlayerId,
    setTurnPlayerId,
    ws,
    wsStatus,
    connectWS,
    clientSessionId,
    sendWS,
    leaveRoom,
    resetAll,
  } = usePlayer();

  const sentCreateRef = useRef(false);
  const startingRef = useRef(false);
  const leavingRef = useRef(false);
  const prevIdsRef = useRef<Set<string>>(new Set());

  const [maxPlayers] = useState(7);
  const [loading, setLoading] = useState(true);
  const [serverStarted, setServerStarted] = useState(false);

  const playersCount = lobbyPlayers.length;
  const canStart = useMemo(() => playersCount >= 4, [playersCount]);
  const isHost = !!lobbyPlayerId && !!hostId && lobbyPlayerId === hostId;

  const hostName = useMemo(() => {
    return lobbyPlayers.find((p) => String(p.id) === String(hostId))?.name ?? "";
  }, [lobbyPlayers, hostId]);

  useEffect(() => {
    sentCreateRef.current = false;
    startingRef.current = false;
    setServerStarted(false);

    setRoomCode("");
    setLobbyPlayerId("");
    setHostId("");
    setLobbyPlayers([]);
    setPlayers([]);
    setMe(null);
    setTurnPlayerId(null);
    setLoading(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    connectWS(WS_URL);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (wsStatus !== "open") return;
    if (sentCreateRef.current) return;

    if (!name.trim()) {
      Alert.alert("Name missing", "Go to Profile and set your name first.");
      return;
    }

    sentCreateRef.current = true;
    setLoading(true);
    sendWS({ type: "create", name: name.trim(), clientSessionId });
  }, [wsStatus, name, sendWS]);

  useEffect(() => {
    if (roomCode) setLoading(false);
  }, [roomCode]);

  useEffect(() => {
    const now = new Set(lobbyPlayers.map((p: any) => String(p.id)));
    const prev = prevIdsRef.current;

    const added = lobbyPlayers.filter((p: any) => !prev.has(String(p.id)));
    const removed = [...prev].filter((id) => !now.has(id));

    if (roomCode) {
      if (added.length > 0) playJoin();
      if (removed.length > 0) playLeave();
    }

    prevIdsRef.current = now;
  }, [lobbyPlayers, roomCode, playJoin, playLeave]);

  useEffect(() => {
    if (!ws) return;

    const onMsg = (e: any) => {
      let msg: any;
      try {
        msg = JSON.parse(e.data);
      } catch {
        return;
      }

      if (msg.type === "started") {
        setServerStarted(true);
      }
      if (msg.type === "game_state" && typeof msg.turnPlayerId === "string") {
        setServerStarted(true);
      }
    };

    ws.addEventListener("message", onMsg);
    return () => ws.removeEventListener("message", onMsg);
  }, [ws]);

  useEffect(() => {
    if (startingRef.current) return;
    if (!roomCode) return;

    if (serverStarted || !!turnPlayerId) {
      startingRef.current = true;
      navigation.navigate("GameScreen");
    }
  }, [serverStarted, turnPlayerId, roomCode, navigation]);

  const handleShareRoom = async () => {
    if (!roomCode) {
      Alert.alert("No room yet", "Wait until the room code appears.");
      return;
    }

    try {
      await Share.share({
        title: "BANG! room invite",
        message:
          `🤠 Join my BANG! room\n` +
          `Room code: ${roomCode}\n` +
          `Open the game, choose Join Room, then enter this code.`,
      });
    } catch {
      Alert.alert("Share failed", "Could not open the share menu.");
    }
  };

  const handleStart = () => {
    if (wsStatus !== "open") {
      Alert.alert("Not connected", "WebSocket is not open yet.");
      return;
    }
    if (!roomCode) {
      Alert.alert("No room yet", "Wait until room code appears.");
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

    sendWS({ type: "start", roomCode });
  };

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

  return (
    <ImageBackground
      source={require("../../assets/homescreen3.png")}
      style={styles.root}
      resizeMode="cover"
    >
      <View style={styles.overlay} />

      <View style={styles.topBar}>
        <WoodButton title="Back" onPress={handleBack} style={styles.topBtn} />

        <View style={styles.codeBadge}>
          <Text style={styles.codeLabel}>ROOM</Text>
          <Text style={styles.codeText}>{roomCode || "....."}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>Waiting Room</Text>
        <Text style={styles.subTitle}>
          {isHost ? "You are the host." : hostName ? `${hostName} is the host.` : "Preparing lobby…"}
        </Text>

        <View style={styles.statusRow}>
          <View style={styles.statBadge}>
            <Text style={styles.statLabel}>PLAYERS</Text>
            <Text style={styles.statValue}>{playersCount}/{maxPlayers}</Text>
          </View>

          <View style={styles.statBadge}>
            <Text style={styles.statLabel}>STATUS</Text>
            <Text style={styles.statValueSmall}>{wsStatus.toUpperCase()}</Text>
          </View>
        </View>

        <View style={styles.playersBox}>
          <Text style={styles.sectionTitle}>Players</Text>
          {lobbyPlayers.length === 0 ? (
            <Text style={styles.emptyText}>No players yet…</Text>
          ) : (
            lobbyPlayers.map((p, i) => {
              const isRowHost = String(p.id) === String(hostId);
              const isMe = String(p.id) === String(lobbyPlayerId);
              return (
                <View key={p.id ?? String(i)} style={styles.playerRow}>
                  <Text style={styles.playerText}>
                    {isMe ? "• You" : `• ${p.name ?? "Unknown"}`}
                  </Text>
                  {isRowHost ? <Text style={styles.hostTag}>HOST</Text> : null}
                </View>
              );
            })
          )}
        </View>

        {loading && (
          <View style={styles.loadingWrap}>
            <ActivityIndicator />
            <Text style={styles.hint}>Creating room…</Text>
          </View>
        )}

        <View style={styles.actionsRow}>
          <WoodButton
            title="Share Room"
            onPress={handleShareRoom}
            disabled={!roomCode}
            style={styles.actionBtn}
          />
          <WoodButton
            title={isHost ? "Start" : "Host Starts"}
            onPress={handleStart}
            disabled={!isHost || !canStart || wsStatus !== "open" || !roomCode}
            style={styles.actionBtn}
          />
        </View>

        {!roomCode ? (
          <Text style={styles.hint}>Waiting for room code…</Text>
        ) : !isHost ? (
          <Text style={styles.hint}>When the current host leaves, the next player becomes host automatically.</Text>
        ) : !canStart ? (
          <Text style={styles.hint}>Need at least 4 players to start.</Text>
        ) : (
          <Text style={styles.hintReady}>Ready. Press START.</Text>
        )}

      </View>

      <LobbyChatPanel />
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.45)" },
  topBar: {
    position: "absolute",
    top: 46,
    left: 14,
    right: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    zIndex: 10,
  },
  topBtn: { width: 118, height: 44 },
  codeBadge: {
    minWidth: 150,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    alignItems: "flex-end",
  },
  codeLabel: { color: "rgba(255,255,255,0.72)", fontSize: 12, fontWeight: "800" },
  codeText: { color: "white", fontSize: 22, fontWeight: "900", letterSpacing: 1 },
  card: {
    marginTop: 142,
    marginHorizontal: 16,
    borderRadius: 22,
    padding: 16,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },
  title: { color: "white", fontSize: 28, fontWeight: "900" },
  subTitle: { color: "rgba(255,255,255,0.82)", marginTop: 8, fontWeight: "700" },
  statusRow: { flexDirection: "row", gap: 10, marginTop: 16 },
  statBadge: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.28)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  statLabel: { color: "rgba(255,255,255,0.65)", fontSize: 11, fontWeight: "800" },
  statValue: { color: "white", fontSize: 20, fontWeight: "900", marginTop: 4 },
  statValueSmall: { color: "white", fontSize: 15, fontWeight: "900", marginTop: 6 },
  playersBox: {
    marginTop: 16,
    padding: 14,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.24)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  sectionTitle: { color: "#fff4d6", fontSize: 18, fontWeight: "900" },
  emptyText: { color: "rgba(255,255,255,0.65)", marginTop: 10, fontWeight: "700" },
  playerRow: {
    marginTop: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.06)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  playerText: { color: "white", fontWeight: "800", fontSize: 16 },
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
  loadingWrap: { marginTop: 16, alignItems: "center" },
  actionsRow: { flexDirection: "row", gap: 12, marginTop: 18 },
  actionBtn: { flex: 1, height: 48 },
  hint: {
    marginTop: 12,
    color: "rgba(255,255,255,0.76)",
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 20,
  },
  hintReady: {
    marginTop: 12,
    color: "#fff4d6",
    fontWeight: "900",
    textAlign: "center",
  },
});
