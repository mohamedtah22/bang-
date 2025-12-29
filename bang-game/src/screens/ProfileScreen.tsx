import React from "react";
import { View, Text, TextInput, Pressable } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { usePlayer } from "../contexts/playercontext";

export default function ProfileScreen() {
  const navigation = useNavigation<any>();
  const { name, setName } = usePlayer();

  const canContinue = name.trim().length >= 2;

  const handleContinue = () => {
    if (!canContinue) return;
    navigation.replace("Home");
  };

  return (
    <View
      style={{
        flex: 1,
        padding: 20,
        justifyContent: "center",
        gap: 12,
        backgroundColor: "#000", 
      }}
    >
      <Text
        style={{
          color: "white",
          fontSize: 28,
          fontWeight: "900",
          textAlign: "center",
          marginBottom: 10,
        }}
      >
        Enter your name
      </Text>

      <Text style={{ color: "rgba(255,255,255,0.85)", fontWeight: "700" }}>
        Your name
      </Text>

      <TextInput
        value={name}
        onChangeText={setName}
        placeholder="Write your name"
        placeholderTextColor="rgba(255,255,255,0.6)"
        autoCapitalize="words"
        style={{
          borderWidth: 1,
          borderColor: "rgba(255,255,255,0.35)",
          borderRadius: 14,
          padding: 12,
          color: "white",
          backgroundColor: "rgba(255,255,255,0.06)",
        }}
      />

      {!canContinue && (
        <Text style={{ color: "rgba(255,120,120,0.95)" }}>
          Name must be at least 2 characters
        </Text>
      )}

      <Pressable
        onPress={handleContinue}
        disabled={!canContinue}
        style={({ pressed }) => ({
          marginTop: 10,
          borderWidth: 1,
          borderColor: canContinue
            ? "rgba(255,255,255,0.35)"
            : "rgba(255,255,255,0.15)",
          borderRadius: 14,
          paddingVertical: 14,
          alignItems: "center",
          backgroundColor: canContinue
            ? pressed
              ? "rgba(255,255,255,0.10)"
              : "rgba(255,255,255,0.06)"
            : "rgba(255,255,255,0.03)",
          opacity: canContinue ? 1 : 0.6,
          transform: [{ scale: pressed && canContinue ? 0.98 : 1 }],
        })}
      >
        <Text style={{ color: "white", fontSize: 18, fontWeight: "800" }}>
          Continue
        </Text>
      </Pressable>
    </View>
  );
}
