import React from "react";
import { ImageBackground, StyleSheet } from "react-native";
import { NavigationContainer, DefaultTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import HomeScreen from "./src/screens/HomeScreen";
import JoinRoomScreen from "./src/screens/joinroomscreen"; 
import ProfileScreen from "./src/screens/ProfileScreen";
import { PlayerProvider } from "./src/contexts/playercontext"; 
import createroomscreen from "./src/screens/createroomscreen"; 
import GameScreen from "./src/screens/GameScreen";

const Stack = createNativeStackNavigator(); 

const navTheme = { 
  ...DefaultTheme, 
  colors: { 
    ...DefaultTheme.colors, 
    background: 'transparent', 
  }, 
}; 
 
export default function App() {
  return (
    <PlayerProvider>
      <ImageBackground 
        source={require('./assets/homescreen3.png')} 
        style={styles.backgroundImage}
        resizeMode="cover"
      >
        <NavigationContainer theme={navTheme}>
          <Stack.Navigator 
            screenOptions={{ 
              headerShown: false,
              contentStyle: { backgroundColor: 'transparent' },
              animation: 'fade',
              
            }} 
            initialRouteName="Profile"
          >
            <Stack.Screen name="Profile" component={ProfileScreen} />
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="JoinRoom" component={JoinRoomScreen} />
            <Stack.Screen name="CreateRoom" component={createroomscreen} />
            <Stack.Screen name="GameScreen" component={GameScreen} />
          </Stack.Navigator>
        </NavigationContainer>
      </ImageBackground>
    </PlayerProvider>
  );
}

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
});