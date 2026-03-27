import React from "react";
import { Modal, Pressable, StyleSheet, Text, View, ImageBackground } from "react-native";
import WoodButton from "./WoodButton";

const WOOD_BOARD = require("../../../assets/wood_board.png");

type Props = {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children?: React.ReactNode;
};

export default function CharacterAbilityOverlay({ open, title, subtitle, onClose, children }: Props) {
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.root}>
        <Pressable style={s.backdrop} onPress={onClose} />

        <View style={s.centerWrap} pointerEvents="box-none">
          <ImageBackground
            source={WOOD_BOARD}
            resizeMode="cover"
            imageStyle={s.boardImage}
            style={s.board}
          >
            <View style={s.inner}>
              <View style={s.header}>
                <View style={s.titleWrap}>
                  <Text style={s.title}>{title}</Text>
                  {!!subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}
                </View>
                <WoodButton title="Close" onPress={onClose} style={s.closeBtn} />
              </View>

              <View style={s.content}>{children}</View>
            </View>
          </ImageBackground>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 20,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.62)",
  },
  centerWrap: {
    width: "100%",
    maxWidth: 560,
  },
  board: {
    borderRadius: 22,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,230,180,0.24)",
    elevation: 14,
  },
  boardImage: {
    borderRadius: 22,
  },
  inner: {
    backgroundColor: "rgba(0,0,0,0.36)",
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  titleWrap: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    color: "#fff3d4",
    fontWeight: "900",
    fontSize: 18,
  },
  subtitle: {
    marginTop: 3,
    color: "rgba(255,245,220,0.86)",
    fontWeight: "800",
    fontSize: 12,
  },
  closeBtn: {
    minWidth: 96,
    height: 38,
  },
  content: {
    width: "100%",
  },
});
