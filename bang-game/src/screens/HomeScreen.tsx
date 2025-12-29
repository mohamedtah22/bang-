import React, { useEffect } from "react";
import { View, Text, Pressable } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { usePlayer } from "../contexts/playercontext";
import { Image } from "expo-image";

export default function HomeScreen() {
  const { name, avatarUri } = usePlayer();
  const navigation = useNavigation<any>();

  useEffect(() => {
    if (!name.trim()) navigation.replace("Profile");
  }, [name]);

  const handleJoinApp = () => navigation.navigate("JoinRoom");
  const handleCreateRoom = () => navigation.navigate("CreateRoom");

  return (
    <View style={{ flex: 1, backgroundColor: "transparent" }}>
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.35)",
          padding: 20,
          justifyContent: "center",
        }}
      >
        <View
          style={{
            alignSelf: "center",
            width: "92%",
            maxWidth: 420,
            borderRadius: 22,
            paddingVertical: 18,
            paddingHorizontal: 16,
            alignItems: "center",
            backgroundColor: "rgba(0,0,0,0.45)",
            borderWidth: 1,
            borderColor: "rgba(255,255,255,0.18)",
            marginBottom: 18,
          }}
        >
          <View
            style={{
              width: 118,
              height: 118,
              borderRadius: 59,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 2,
              borderColor: "rgba(255,255,255,0.25)",
              backgroundColor: "rgba(255,255,255,0.06)",
              overflow: "hidden",
            }}
          >
            {avatarUri?.trim() ? (
              <Image
                source={{ uri: avatarUri }}
                style={{
                  width: 104,
                  height: 104,
                  borderRadius: 52,
                  backgroundColor: "rgba(0,0,0,0.2)",
                }}
                contentFit="cover"
              />
            ) : (
              <Text
                style={{
                  color: "rgba(255,255,255,0.85)",
                  fontSize: 44,
                  fontWeight: "900",
                }}
              >
                {(name?.trim()?.[0] || "?").toUpperCase()}
              </Text>
            )}
          </View>

          <Text
            style={{
              color: "white",
              fontSize: 22,
              fontWeight: "900",
              marginTop: 12,
              textAlign: "center",
            }}
            numberOfLines={1}
          >
            {name}
          </Text>

          <Text
            style={{
              color: "rgba(255,255,255,0.75)",
              fontSize: 13,
              marginTop: 4,
              textAlign: "center",
            }}
          >
            {avatarUri?.trim() ? "Profile picture set" : "No profile picture"}
          </Text>

          <Pressable
            onPress={() => navigation.navigate("Profile")}
            style={({ pressed }) => ({
              marginTop: 12,
              paddingVertical: 10,
              paddingHorizontal: 14,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.18)",
              backgroundColor: pressed ? "rgba(0,0,0,0.55)" : "rgba(0,0,0,0.35)",
              transform: [{ scale: pressed ? 0.98 : 1 }],
            })}
          >
            <Text style={{ color: "rgba(255,255,255,0.9)", fontWeight: "800" }}>
              Edit profile
            </Text>
          </Pressable>
        </View>

        <View style={{ width: "92%", maxWidth: 420, alignSelf: "center", gap: 12 }}>
          <Pressable
            onPress={handleJoinApp}
            style={({ pressed }) => ({
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.22)",
              borderRadius: 18,
              paddingVertical: 16,
              alignItems: "center",
              backgroundColor: pressed ? "rgba(0,0,0,0.65)" : "rgba(0,0,0,0.45)",
              transform: [{ scale: pressed ? 0.985 : 1 }],
            })}
          >
            <Text style={{ color: "white", fontSize: 18, fontWeight: "900" }}>
              Join Room
            </Text>
            <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, marginTop: 4 }}>
              Enter a code and join friends
            </Text>
          </Pressable>

          <Pressable
            onPress={handleCreateRoom}
            style={({ pressed }) => ({
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.22)",
              borderRadius: 18,
              paddingVertical: 16,
              alignItems: "center",
              backgroundColor: pressed ? "rgba(0,0,0,0.65)" : "rgba(0,0,0,0.40)",
              transform: [{ scale: pressed ? 0.985 : 1 }],
            })}
          >
            <Text style={{ color: "white", fontSize: 18, fontWeight: "900" }}>
              Create Room
            </Text>
            <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, marginTop: 4 }}>
              Start a new game
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}
