import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { usePlayer } from "../contexts/playercontext";

export const WS_URL = "ws://10.14.3.212:3000";

export default function CreateRoomScreen() {
  const navigation = useNavigation<any>();

  const {
    name,
    roomCode,
    setRoomCode,

    lobbyPlayers,
    setLobbyPlayers,

    setPlayers,
    setMe,
    turnPlayerId,
    setTurnPlayerId,

    ws,           // ✅ خذ ws من الكونتكست
    wsStatus,
    connectWS,
    sendWS,
  } = usePlayer();

  const sentCreateRef = useRef(false);
  const startingRef = useRef(false);

  const [maxPlayers] = useState(7);
  const [loading, setLoading] = useState(true);
  const [serverStarted, setServerStarted] = useState(false);

  const playersCount = lobbyPlayers.length;
  const canStart = useMemo(() => playersCount >= 4, [playersCount]);

  // reset on enter
  useEffect(() => {
    sentCreateRef.current = false;
    startingRef.current = false;

    setServerStarted(false);

    setRoomCode("");
    setLobbyPlayers([]);
    setPlayers([]);
    setMe(null);
    setTurnPlayerId(null);
    setLoading(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // open WS
  useEffect(() => {
    connectWS(WS_URL);
  }, [connectWS]);

  // send create once
  useEffect(() => {
    if (wsStatus !== "open") return;
    if (sentCreateRef.current) return;

    if (!name.trim()) {
      Alert.alert("Name missing", "Go to Profile and set your name first.");
      return;
    }

    sentCreateRef.current = true;
    setLoading(true);
    sendWS({ type: "create", name: name.trim() });
  }, [wsStatus, name, sendWS]);

  // stop loading when roomCode arrives
  useEffect(() => {
    if (roomCode) setLoading(false);
  }, [roomCode]);

  // ✅ اسمع started/game_state من السيرفر
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

  // navigate once
  useEffect(() => {
    if (startingRef.current) return;
    if (!roomCode) return;

    if (serverStarted || !!turnPlayerId) {
      startingRef.current = true;
      navigation.navigate("GameScreen");
    }
  }, [serverStarted, turnPlayerId, roomCode, navigation]);

  const handleStart = () => {
    if (wsStatus !== "open") {
      Alert.alert("Not connected", "WebSocket is not open yet.");
      return;
    }
    if (!roomCode) {
      Alert.alert("No room yet", "Wait until room code appears.");
      return;
    }
    if (!canStart) {
      Alert.alert("Not enough players", "Need at least 4 players to start.");
      return;
    }

    sendWS({ type: "start", roomCode });
  };

  const handleBack = () => {
    try {
      if (roomCode) sendWS({ type: "leave", roomCode });
      else sendWS({ type: "leave" });
    } catch {}

    setRoomCode("");
    setLobbyPlayers([]);
    setPlayers([]);
    setMe(null);
    setTurnPlayerId(null);

    navigation.goBack();
  };

  return (
    <View style={styles.root}>
      <View style={styles.overlay} />

      <View style={styles.topBar}>
        <Pressable onPress={handleBack} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>

        <View style={styles.codeBadge}>
          <Text style={styles.codeLabel}>ROOM</Text>
          <Text style={styles.codeText}>{roomCode || "....."}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.title}>Lobby</Text>

        <Text style={styles.muted}>Players</Text>
        <Text style={styles.playersText}>
          {playersCount}/{maxPlayers}
        </Text>

        <View style={{ marginTop: 10 }}>
          {lobbyPlayers.map((p, i) => (
            <Text key={p.id ?? String(i)} style={{ color: "white" }}>
              - {p.name ?? "Unknown"}
            </Text>
          ))}
        </View>

        {loading && (
          <View style={{ marginTop: 14, alignItems: "center" }}>
            <ActivityIndicator />
            <Text style={[styles.muted, { marginTop: 8 }]}>
              Creating room…
            </Text>
          </View>
        )}

        <View style={{ marginTop: 18 }}>
          <Pressable
            onPress={handleStart}
            disabled={!canStart || wsStatus !== "open" || !roomCode}
            style={[
              styles.startBtn,
              (!canStart || wsStatus !== "open" || !roomCode) &&
                styles.startBtnDisabled,
            ]}
          >
            <Text
              style={[
                styles.startText,
                (!canStart || wsStatus !== "open" || !roomCode) &&
                  styles.startTextDisabled,
              ]}
            >
              START
            </Text>
          </Pressable>

          {!roomCode ? (
            <Text style={styles.hint}>Waiting for room code…</Text>
          ) : !canStart ? (
            <Text style={styles.hint}>Need at least 4 players to start.</Text>
          ) : (
            <Text style={styles.hintReady}>Ready! Press START ✅</Text>
          )}

          <Text style={[styles.muted, { marginTop: 10, textAlign: "center" }]}>
            WS: {wsStatus}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "transparent" },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.55)" },
  topBar: {
    position: "absolute",
    top: 52,
    left: 16,
    right: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    zIndex: 5,
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
    minWidth: 120,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.45)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
    alignItems: "flex-end",
  },
  codeLabel: { color: "rgba(255,255,255,0.75)", fontSize: 12, fontWeight: "700" },
  codeText: { color: "white", fontSize: 22, fontWeight: "900" },
  card: {
    marginTop: 140,
    marginHorizontal: 16,
    borderRadius: 22,
    padding: 16,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
  },
  title: { color: "white", fontSize: 26, fontWeight: "900", marginBottom: 10 },
  muted: { color: "rgba(255,255,255,0.75)", fontWeight: "600" },
  playersText: { color: "white", fontSize: 22, fontWeight: "900", marginTop: 6 },
  startBtn: {
    paddingVertical: 14,
    borderRadius: 18,
    alignItems: "center",
    backgroundColor: "rgba(255, 204, 0, 0.95)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },
  startBtnDisabled: { backgroundColor: "rgba(255,255,255,0.15)" },
  startText: { color: "#151515", fontSize: 22, fontWeight: "900" },
  startTextDisabled: { color: "rgba(255,255,255,0.55)" },
  hint: { marginTop: 10, color: "rgba(255,255,255,0.75)", fontWeight: "600", textAlign: "center" },
  hintReady: { marginTop: 10, color: "rgba(255,255,255,0.95)", fontWeight: "900", textAlign: "center" },
});
