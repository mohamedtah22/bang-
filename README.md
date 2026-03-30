# Bang! Mobile Multiplayer Game

A real-time multiplayer mobile card game inspired by **BANG!**, built with **React Native + Expo + TypeScript** on the client and a **Node.js + TypeScript WebSocket server** on the backend.

This project focuses on **live turn synchronization**, **rule-driven gameplay**, **character abilities**, **response chains**, and **mobile-first game UX**. It was built as a hands-on systems project that combines frontend engineering, backend game-state management, and real-time communication.

> This is an independent educational / portfolio project inspired by the original BANG! game. It is not an official adaptation.

---

## Project Highlights

- **Real-time multiplayer rooms** with live player synchronization
- **Turn-based gameplay engine** with server-authoritative state updates
- **Character ability system** with multiple passive and reactive abilities
- **Card-driven combat and response flow** such as BANG!, MISSED!, Duel, Indians!, Gatling, Panic!, Cat Balou, Beer, Saloon, General Store, Jail, Dynamite, and more
- **Distance and equipment mechanics** including weapons, Barrel, Scope, Mustang, and Jail/Dynamite draw checks
- **Revive / death handling** with Beer-based survival flow
- **Public + private state separation**, including room-level updates and player-specific action prompts
- **Mobile UI/UX** with overlays, animations, audio effects, banners, timers, and event feedback
- **Reconnect / disconnect handling** for more stable real-time sessions

---

## Tech Stack

### Frontend
- **React Native**
- **Expo**
- **TypeScript**
- React Navigation
- Expo AV / image / UI utilities

### Backend
- **Node.js**
- **TypeScript**
- **WebSocket server (`ws`)**

### Deployment
- **Expo / EAS Build** for mobile builds
- **Render** for backend deployment

---

## Architecture Overview

The project is split into two main codebases:

### 1) Mobile Client
Responsible for:
- room creation / joining flow
- rendering the game table and player hand
- showing turn / respond / revive / ability states
- animating card flow and visual effects
- playing music and sound effects
- maintaining the local player context and normalizing server events for UI

### 2) Game Server
Responsible for:
- room management and player join/create flow
- deck setup and card handling
- validating moves and legal targets
- applying game rules and character abilities
- managing turn flow, damage, revive, and game-over conditions
- broadcasting public game state and private action prompts

The **server is authoritative** for gameplay. The client renders state and sends player actions, while the backend enforces rules and resolves card effects.

---

## Repository Structure

### Client Structure

```text
bang-game/
├── App.tsx
├── app.json
├── eas.json
├── index.ts
├── package.json
├── assets/
│   ├── cards/
│   ├── characters/
│   ├── roles/
│   ├── sfx/
│   ├── music/
│   └── ui/
└── src/
    ├── contexts/
    │   └── playercontext.tsx
    ├── data/
    │   ├── cardAssets.ts
    │   └── roleAssets.ts
    ├── models/
    │   ├── card.ts
    │   ├── characters.ts
    │   └── player.ts
    ├── network/
    │   └── wsClient.ts
    ├── screens/
    │   ├── HomeScreen.tsx
    │   ├── ProfileScreen.tsx
    │   ├── GameScreen.tsx
    │   ├── createroomscreen.tsx
    │   ├── joinroomscreen.tsx
    │   ├── characters/
    │   └── game/
    │       ├── ActionOverlay.tsx
    │       ├── CharacterAbilityOverlay.tsx
    │       ├── ChatOverlay.tsx
    │       ├── DrawCheckOverlay.tsx
    │       ├── DrawMotionLayer.tsx
    │       ├── EndGameOverlay.tsx
    │       ├── EventBanner.tsx
    │       ├── FxLayer.tsx
    │       ├── GeneralStorePanel.tsx
    │       ├── HandBar.tsx
    │       ├── LogPanel.tsx
    │       ├── OpponentTile.tsx
    │       ├── OpponentsRow.tsx
    │       ├── StartInfoOverlay.tsx
    │       ├── TableCenter.tsx
    │       ├── TimerBar.tsx
    │       └── WoodButton.tsx
    └── socket.ts
```

### Server Structure

```text
bang-game-server/
├── server.ts
├── package.json
├── tsconfig.json
├── routes/
│   └── joinandcreateroutes.ts
├── models/
│   ├── player.ts
│   └── room.ts
└── controllers/
    ├── state.ts
    ├── deck.ts
    ├── gameengine.ts
    ├── startandjoincontroller.ts
    ├── cards/
    │   ├── bang.ts
    │   ├── barrel.ts
    │   ├── beer.ts
    │   ├── catbalou.ts
    │   ├── duel.ts
    │   ├── dynamite.ts
    │   ├── gatling.ts
    │   ├── generalstore.ts
    │   ├── indians.ts
    │   ├── jail.ts
    │   ├── mustang.ts
    │   ├── panic.ts
    │   ├── saloon.ts
    │   ├── scope.ts
    │   ├── stagecoach.ts
    │   ├── weapon.ts
    │   └── wellsfargo.ts
    └── engine/
        ├── broadcast.ts
        ├── drawcheck.ts
        ├── gameover.ts
        ├── players.ts
        ├── rules.ts
        ├── runtime.ts
        ├── turn.ts
        ├── types.ts
        └── utils.ts
```

---

## Gameplay Systems Implemented

### Core Turn Flow
- turn ownership and turn transitions
- draw phase, action phase, discard-to-limit flow
- player-specific action prompts and timers
- start-of-turn effects such as **Jail** and **Dynamite**

### Combat / Response Systems
- **BANG! / MISSED!**
- **Duel**
- **Indians!**
- **Gatling**
- revive logic using **Beer**
- damage, lethal hits, and death resolution

### Equipment / Distance Systems
- weapon range handling
- default weapon fallback
- **Barrel** reaction flow
- **Scope** / **Mustang** distance modifiers
- table cards and side equipment state

### Character Logic
The project includes support for multiple characters and ability-driven interactions, including:
- Bart Cassidy
- Black Jack
- Calamity Janet
- El Gringo
- Jesse Jones
- Jourdonnais
- Kit Carlson
- Lucky Duke
- Paul Regret
- Pedro Ramirez
- Rose Doolan
- Sid Ketchum
- Slab the Killer
- Suzy Lafayette
- Vulture Sam
- Willy the Kid

### UI / Feedback Systems
- animated overlays and action prompts
- event banner and passive ability feedback
- chat/log overlay support
- draw-check and general store overlays
- sound effects and ambient music
- mobile game table layout with player tiles and hand bar

---

## Engineering Focus

This project was mainly an exercise in building and debugging a **real-time stateful multiplayer system**.
The most interesting technical parts were:

- designing a **server-authoritative rule engine** instead of trusting the client
- separating **public room state** from **private player state**
- supporting **complex chained interactions** such as Barrel / Jourdonnais / Lucky Duke / Slab the Killer
- resolving **revive and death flow** without breaking turn progression
- managing **WebSocket lifecycle issues**, reconnects, duplicate sockets, and disconnect handling
- translating backend events into a clean mobile UI with overlays, badges, timers, and action buttons

---

## Local Development

## Backend

```bash
cd bang-game-server
npm install
npm run dev
```

By default, the server runs on port `3000`.
For local mobile testing, it should listen on your local network interface, e.g.:

```ts
server.listen(3000, "0.0.0.0");
```

## Frontend

```bash
cd bang-game
npm install
npx expo start
```

### Frontend scripts

```bash
npm run start
npm run android
npm run ios
npm run web
```

### WebSocket URL for local testing
If you test on a physical device with Expo Go, do **not** use `localhost`.
Use your machine's local IP instead, for example:

```ts
const WS_URL = "ws://10.0.0.4:3000";
```

Your phone and computer must be connected to the same Wi-Fi network.

---

## Production Notes

For production builds, the mobile client should connect to the deployed backend over secure WebSocket:

```ts
const WS_URL = "wss://your-render-server.onrender.com";
```

A common setup is:

```ts
export const WS_URL = __DEV__
  ? "ws://YOUR_LOCAL_IP:3000"
  : "wss://your-render-server.onrender.com";
```

---

## Why This Project Is Portfolio-Relevant

This project demonstrates experience in:

- mobile frontend development with React Native
- TypeScript across both client and server
- real-time communication and WebSocket debugging
- multiplayer state synchronization
- rule-based game engine design
- UI architecture for event-heavy interactive systems
- debugging race conditions, reconnect behavior, and state consistency bugs

It is especially relevant for roles involving:
- frontend engineering
- full-stack development
- real-time / interactive systems
- product engineering
- game-adjacent systems and event-driven applications

---

## Future Improvements

- stronger reconnect recovery and session restoration
- automated tests for complex rule interactions
- matchmaking / room discovery improvements
- better responsive scaling on more screen sizes
- replay / spectating support
- more polished onboarding and tutorial flow
- continued edge-case validation for advanced card interactions

---

## Disclaimer

This is a personal / student portfolio project inspired by the original **BANG!** tabletop card game.
It is intended for learning, experimentation, and demonstration of engineering skills.
