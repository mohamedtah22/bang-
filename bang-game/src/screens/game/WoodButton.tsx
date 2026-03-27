import React, { useMemo, useRef } from "react";
import {
  Animated,
  GestureResponderEvent,
  ImageBackground,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  ViewStyle,
} from "react-native";
import { useUiSounds } from "./useUiSounds";

type Props = {
  title: string;
  onPress?: (e: GestureResponderEvent) => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

const WOOD_BG = require("../../../assets/red_wood_cracked.png");

export default function WoodButton({
  title,
  onPress,
  disabled = false,
  style,
}: Props) {
  const pressAnim = useRef(new Animated.Value(0)).current;
  const { playClick } = useUiSounds();

  const pressIn = () => {
    Animated.spring(pressAnim, {
      toValue: 1,
      friction: 8,
      tension: 180,
      useNativeDriver: true,
    }).start();
  };

  const pressOut = () => {
    Animated.spring(pressAnim, {
      toValue: 0,
      friction: 9,
      tension: 170,
      useNativeDriver: true,
    }).start();
  };

  const handlePress = (e: GestureResponderEvent) => {
    if (disabled) return;
    playClick();
    onPress?.(e);
  };

  const animatedStyle = useMemo(
    () => ({
      transform: [
        {
          translateY: pressAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [0, 3],
          }),
        },
        {
          scale: pressAnim.interpolate({
            inputRange: [0, 1],
            outputRange: [1, 0.975],
          }),
        },
      ],
    }),
    [pressAnim]
  );

  const innerStyle = useMemo(
    () => ({
      opacity: pressAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 0.96],
      }),
    }),
    [pressAnim]
  );

  return (
    <Animated.View
      style={[
        styles.shadowWrap,
        animatedStyle,
        style,
        disabled ? styles.disabledWrap : null,
      ]}
    >
      <Pressable
        onPress={handlePress}
        onPressIn={disabled ? undefined : pressIn}
        onPressOut={disabled ? undefined : pressOut}
        disabled={disabled}
        style={styles.pressable}
      >
        <Animated.View style={[styles.inner, innerStyle]}>
          <ImageBackground
            source={WOOD_BG}
            resizeMode="cover"
            imageStyle={styles.bgImage}
            style={styles.button}
          >
            <Text style={[styles.label, disabled ? styles.disabledLabel : null]}>
              {title}
            </Text>
          </ImageBackground>
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  shadowWrap: {
    minWidth: 112,
    height: 44,
    borderWidth: 1.5,
    borderColor: "rgba(60,30,10,0.95)",
    backgroundColor: "#5a2e12",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  inner: {
    flex: 1,
  },
  disabledWrap: {
    opacity: 0.55,
  },
  pressable: {
    flex: 1,
  },
  button: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  bgImage: {
    borderRadius: 0,
  },
  label: {
    color: "#fff4d6",
    fontWeight: "900",
    fontSize: 16,
    letterSpacing: 0.6,
    textTransform: "uppercase",
    textShadowColor: "rgba(0,0,0,0.35)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  disabledLabel: {
    opacity: 0.9,
  },
});
