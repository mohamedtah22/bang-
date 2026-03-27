import "react-native-gesture-handler";

import React from "react";
import { I18nManager, ImageBackground, StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import HomeScreen from "./src/screens/HomeScreen";
import JoinRoomScreen from "./src/screens/joinroomscreen";
import ProfileScreen from "./src/screens/ProfileScreen";
import CreateRoomScreen from "./src/screens/createroomscreen";
import GameScreen from "./src/screens/GameScreen";

import { PlayerProvider } from "./src/contexts/playercontext";

// أهم سطرين عشان ما ينعكس التطبيق
I18nManager.allowRTL(false);
I18nManager.forceRTL(false);

const Stack = createNativeStackNavigator();

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: "transparent",
  },
};

// Wrapper: يعطي الخلفية بس للشاشات اللي بدك إياها
function withHomeBg(Component: React.ComponentType<any>) {
  return function Wrapped(props: any) {
    return (
      <ImageBackground
        source={require("./assets/homescreen3.png")}
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        <Component {...props} />
      </ImageBackground>
    );
  };
}

export default function App() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <PlayerProvider>
        <NavigationContainer theme={navTheme}>
          <Stack.Navigator
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: "transparent" },
              animation: "fade",
            }}
            initialRouteName="Profile"
          >
            <Stack.Screen name="Profile" component={withHomeBg(ProfileScreen)} />
            <Stack.Screen name="Home" component={withHomeBg(HomeScreen)} />
            <Stack.Screen name="JoinRoom" component={withHomeBg(JoinRoomScreen)} />
            <Stack.Screen name="CreateRoom" component={withHomeBg(CreateRoomScreen)} />

            <Stack.Screen name="GameScreen" component={GameScreen} />
          </Stack.Navigator>
        </NavigationContainer>
      </PlayerProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  backgroundImage: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
});