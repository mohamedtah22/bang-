import React from "react";
import {
  Image,
  ImageBackground,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useNavigation } from "@react-navigation/native";

import { usePlayer } from "../contexts/playercontext";
import { CHARACTERS } from "../models/characters";
import WoodButton from "./game/WoodButton";
import { useAmbientMusic } from "./game/useAmbientMusic";

const BG = require("../../assets/homescreen3.png");
let BANG_LOGO: any;
try {
  BANG_LOGO = require("../../assets/bang!.png");
} catch {
  BANG_LOGO = require("../../assets/bang!.png");
}

export default function ProfileScreen() {
  const navigation = useNavigation<any>();
  const { name, setName } = usePlayer();

  useAmbientMusic("lobby", true, 0.2);

  const canContinue = String(name ?? "").trim().length >= 2;

  return (
    <ImageBackground source={BG} style={styles.bg} resizeMode="cover">
      <View style={styles.bgShade} />
      <SafeAreaView style={styles.safe}>
        <View style={styles.wrap}>
          <Text style={styles.kicker}>mt22</Text>
          <Image source={BANG_LOGO} style={styles.logo} resizeMode="contain" />

          <View style={styles.card}>
            

            <Text style={styles.title}>Choose your name</Text>
            <Text style={styles.subtitle}>
              This is the name shown in the lobby, on your seat, and during the match.
            </Text>

            <View style={styles.inputShell}>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Your cowboy name"
                placeholderTextColor="rgba(255,240,220,0.46)"
                autoCapitalize="words"
                maxLength={18}
                selectionColor="#d7a24c"
                style={styles.input}
              />
            </View>

            {!canContinue ? <Text style={styles.warning}>Name must be at least 2 characters.</Text> : null}

            <WoodButton
              title="Continue"
              onPress={() => canContinue && navigation.replace("Home")}
              disabled={!canContinue}
              style={styles.ctaBtn}
            />
          </View>
        </View>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: "#0c0907" },
  bgShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.46)",
  },
  safe: { flex: 1 },
  wrap: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 6,
    paddingBottom: 18,
    alignItems: "center",
  },
  kicker: {
    color: "#d8a04b",
    fontWeight: "900",
    letterSpacing: 3.3,
    fontSize: 11,
    marginTop: 8,
    marginBottom: 0,
    textAlign: "center",
  },
  logo: {
    width: 360,
    height: 250,
    marginTop: -8,
    marginBottom: 2,
  },
  card: {
    width: "100%",
    borderRadius: 30,
    borderWidth: 1.4,
    borderColor: "rgba(210,160,90,0.44)",
    backgroundColor: "rgba(8,6,4,0.76)",
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 22,
    alignItems: "center",
    marginTop: -2,
  },
  heroImageWrap: {
    width: 220,
    height: 260,
    borderRadius: 28,
    backgroundColor: "rgba(0,0,0,0.30)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
  },
  heroImage: {
    width: 202,
    height: 240,
  },
  title: {
    color: "#fff0cf",
    fontSize: 32,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 6,
  },
  subtitle: {
    color: "rgba(255,240,220,0.88)",
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginBottom: 14,
  },
  inputShell: {
    width: "100%",
    borderRadius: 22,
    borderWidth: 1.2,
    borderColor: "rgba(210,160,90,0.30)",
    backgroundColor: "rgba(0,0,0,0.42)",
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  input: {
    color: "#fff0cf",
    textAlign: "center",
    fontSize: 19,
    fontWeight: "800",
    paddingVertical: 16,
  },
  warning: {
    color: "#f1b278",
    fontWeight: "700",
    marginBottom: 10,
    textAlign: "center",
  },
  ctaBtn: {
    width: "100%",
    height: 58,
    marginTop: 2,
  },
});
