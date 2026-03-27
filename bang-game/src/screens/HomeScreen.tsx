// src/screens/HomeScreen.tsx

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  ImageBackground,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";

import { usePlayer } from "../contexts/playercontext";
import { getCardImage, getWeaponImage } from "../data/cardAssets";
import { getRoleImage } from "../data/roleAssets";
import { CHARACTERS } from "../models/characters";
import WoodButton from "./game/WoodButton";
import { useAmbientMusic } from "./game/useAmbientMusic";

const BG = require("../../assets/homescreen3.png");
const CLICK_SFX = require("../../assets/sfx/buttonclick.mp3");
const GUIDE_TABLE_LAYOUT = require("../../assets/guide/howto_table_layout.jpg");
const GUIDE_DISTANCE = require("../../assets/guide/howto_distance_number.jpg");
const GUIDE_TABLE_CARDS = require("../../assets/guide/howto_table_cards.jpg");

let BANG_LOGO: any;
try {
  BANG_LOGO = require("../../assets/bang!.png");
} catch {
  BANG_LOGO = require("../../assets/bang!.png");
}

type GuideTab = "overview" | "roles" | "brown" | "blue" | "weapons" | "characters";

type GuideEntry = {
  title: string;
  description: string;
  subtitle?: string;
  image?: any;
};

type PreviewState = {
  image: any;
  title: string;
  subtitle?: string;
  description?: string;
} | null;

const GUIDE_TABS: Array<{ key: GuideTab; label: string }> = [
  { key: "overview", label: "Game Flow" },
  { key: "roles", label: "Roles" },
  { key: "brown", label: "Brown Cards" },
  { key: "blue", label: "Blue Cards" },
  { key: "weapons", label: "Weapons" },
  { key: "characters", label: "Characters" },
];

const SECTION_DESCRIPTIONS: Record<GuideTab, string> = {
  overview: "A quick tour of the table layout, distance numbers, and where active cards appear around each player.",
  roles: "Who wants what, who is revealed, and how each side wins.",
  brown: "One-shot action cards that resolve immediately when you play them.",
  blue: "Persistent cards and equipment that stay on the table until removed.",
  weapons: "Weapon ranges, distance tools, and how targeting changes.",
  characters: "Character powers that change how you draw, defend, heal, and attack.",
};

const OVERVIEW_ENTRIES: GuideEntry[] = [
  {
    title: "Table overview",
    subtitle: "Main screen",
    description:
      "The top row shows the other players. The center area is where actions and status badges appear. Your own panel and your hand stay in the lower part of the screen so you can always see your cards.",
    image: GUIDE_TABLE_LAYOUT,
  },
  {
    title: "Distance number",
    subtitle: "Enemy range",
    description:
      "The dark circle with the number next to each opponent portrait is that player's distance from you. A smaller number means the player is closer. Weapon range, Scope, Mustang, and some character abilities change this number.",
    image: GUIDE_DISTANCE,
  },
  {
    title: "Cards around the portrait",
    subtitle: "Table cards",
    description:
      "Small cards placed around a player's portrait are table cards that stay active on that player, such as equipment or ongoing effects. They stay attached around the portrait so you can quickly see what is affecting that player.",
    image: GUIDE_TABLE_CARDS,
  },
  {
    title: "Start of Turn",
    subtitle: "Draw phase",
    description:
      "At the beginning of your turn you normally draw 2 cards. Some characters or blue cards can change this step.",
  },
  {
    title: "Main Phase",
    subtitle: "Play cards",
    description:
      "Play attacks, utility cards, blue cards, weapons, or use your character power if it is available in your version of the game.",
  },
  {
    title: "Responses",
    subtitle: "Action pauses",
    description:
      "When a card asks for a response, the current action pauses. For example Bang! is often answered with Missed!, Indians! asks for Bang!, and Beer can save a dying player.",
  },
  {
    title: "End of Turn",
    subtitle: "Discard if needed",
    description:
      "When you finish playing, end your turn. If your hand size is bigger than your current HP, you must discard down to that limit.",
  },
  {
    title: "How the match ends",
    subtitle: "Win conditions",
    description:
      "Sheriff team wins when Outlaws and Renegade are gone. Outlaws win if the Sheriff dies. Renegade usually wins only as the last survivor.",
  },
];

const ROLE_ENTRIES: GuideEntry[] = [
  {
    title: "Sheriff",
    subtitle: "Revealed role",
    description:
      "Your role is public. Remove all Outlaws and the Renegade. The Sheriff usually begins with +1 maximum HP.",
    image: getRoleImage("sheriff"),
  },
  {
    title: "Deputy",
    subtitle: "Sheriff team",
    description: "Protect the Sheriff, read the table, and remove threats. You win with the Sheriff team.",
    image: getRoleImage("deputy"),
  },
  {
    title: "Outlaw",
    subtitle: "Hidden role",
    description: "Your job is to kill the Sheriff. Bluff early, then pressure the table when the Sheriff becomes exposed.",
    image: getRoleImage("outlaw"),
  },
  {
    title: "Renegade",
    subtitle: "Solo role",
    description: "You play alone. Usually you want to be the last player alive after the Sheriff is gone.",
    image: getRoleImage("renegade"),
  },
  {
    title: "Rewards & Penalties",
    subtitle: "Important rule",
    description:
      "If you eliminate an Outlaw, draw 3 cards. If the Sheriff eliminates a Deputy, the Sheriff discards all hand cards and equipped blue cards.",
  },
];

const BROWN_ENTRIES: GuideEntry[] = [
  { title: "Bang!", subtitle: "Attack", description: "Deal 1 damage to a target in range. Most targets can respond with Missed!.", image: getCardImage({ key: "bang" }) },
  { title: "Missed!", subtitle: "Defense", description: "Use it to avoid Bang! or another effect that asks for a Missed! answer.", image: getCardImage({ key: "missed" }) },
  { title: "Beer", subtitle: "Heal", description: "Recover 1 HP. Beer can also save a dying player before elimination.", image: getCardImage({ key: "beer" }) },
  { title: "Panic!", subtitle: "Steal", description: "Take a card from a nearby player when the target is close enough.", image: getCardImage({ key: "panic" }) },
  { title: "Cat Balou", subtitle: "Discard", description: "Make a player lose one card from hand or from the table.", image: getCardImage({ key: "catbalou" }) },
  { title: "Duel", subtitle: "Bang chain", description: "You and the target alternate Bang! cards. The first player who cannot answer loses 1 HP.", image: getCardImage({ key: "duel" }) },
  { title: "Gatling", subtitle: "Area pressure", description: "Hits every other player for 1 damage in the standard rules.", image: getCardImage({ key: "gatling" }) },
  { title: "Indians!", subtitle: "Area attack", description: "Every other player must play Bang! or lose 1 HP.", image: getCardImage({ key: "indians" }) },
  { title: "Stagecoach", subtitle: "Draw 2", description: "Instantly draw 2 cards.", image: getCardImage({ key: "stagecoach" }) },
  { title: "Wells Fargo", subtitle: "Draw 3", description: "Instantly draw 3 cards.", image: getCardImage({ key: "wellsfargo" }) },
  { title: "Saloon", subtitle: "Group heal", description: "All living players recover 1 HP.", image: getCardImage({ key: "saloon" }) },
  { title: "General Store", subtitle: "Draft pick", description: "Reveal cards equal to living players. Starting from you, each player picks one.", image: getCardImage({ key: "generalstore" }) },
];

const BLUE_ENTRIES: GuideEntry[] = [
  { title: "Barrel", subtitle: "Defense", description: "When Bang! targets you, draw-check. On hearts, the shot is avoided.", image: getCardImage({ key: "barrel" }) },
  { title: "Mustang", subtitle: "Distance +1", description: "Other players see you at +1 distance.", image: getCardImage({ key: "mustang" }) },
  { title: "Scope", subtitle: "Distance -1", description: "You see other players at -1 distance.", image: getCardImage({ key: "scope" }) },
  { title: "Jail", subtitle: "Trap", description: "Play it on another player. On their turn they must pass a draw-check or skip that turn.", image: getCardImage({ key: "jail" }) },
  { title: "Dynamite", subtitle: "Bomb", description: "It moves around the table. On a bad draw-check it explodes for 3 damage.", image: getCardImage({ key: "dynamite" }) },
];

const WEAPON_ENTRIES: GuideEntry[] = [
  { title: "Colt .45", subtitle: "Range 1", description: "Your default starting weapon.", image: getWeaponImage("colt45") },
  { title: "Volcanic", subtitle: "Range 1", description: "Lets you play any number of Bang! cards during your turn.", image: getWeaponImage("volcanic") },
  { title: "Schofield", subtitle: "Range 2", description: "A clean weapon upgrade for medium range fights.", image: getWeaponImage("schofield") },
  { title: "Remington", subtitle: "Range 3", description: "Good for safer long pressure.", image: getWeaponImage("remington") },
  { title: "Rev. Carabine", subtitle: "Range 4", description: "Very strong for controlling distant players.", image: getWeaponImage("rev_carabine") },
  { title: "Winchester", subtitle: "Range 5", description: "The farthest standard weapon range.", image: getWeaponImage("winchester") },
  { title: "Range Rules", subtitle: "Distance tools", description: "Weapon range combines with Scope, Mustang, and passive abilities to decide who can be targeted." },
];

const CHARACTER_ENTRIES: GuideEntry[] = [
  { title: "Bart Cassidy", subtitle: "Passive", description: "Each time you lose 1 HP, draw 1 card.", image: CHARACTERS.bart_cassidy.image },
  { title: "Black Jack", subtitle: "Draw phase", description: "Reveal the second draw card. If it is hearts or diamonds, draw 1 extra card.", image: CHARACTERS.black_jack.image },
  { title: "Calamity Janet", subtitle: "Flexible", description: "You can use Bang! as Missed! and Missed! as Bang!.", image: CHARACTERS.calamity_janet.image },
  { title: "El Gringo", subtitle: "Punish attackers", description: "Each time another player makes you lose HP, take a random card from that player.", image: CHARACTERS.el_gringo.image },
  { title: "Jesse Jones", subtitle: "Draw phase", description: "For your first draw, you may take the first card from another player's hand.", image: CHARACTERS.jesse_jones.image },
  { title: "Jourdonnais", subtitle: "Passive defense", description: "You are always considered to have a Barrel in play.", image: CHARACTERS.jourdonnais.image },
  { title: "Kit Carlson", subtitle: "Deck control", description: "Look at the top 3 cards of the deck, keep 2, and return 1 on top.", image: CHARACTERS.kit_carlson.image },
  { title: "Lucky Duke", subtitle: "Draw! checks", description: "Whenever you make a draw-check, flip 2 cards and choose which one counts.", image: CHARACTERS.lucky_duke.image },
  { title: "Paul Regret", subtitle: "Passive distance", description: "Other players see you at +1 distance.", image: CHARACTERS.paul_regret.image },
  { title: "Pedro Ramirez", subtitle: "Discard value", description: "You may draw your first card from the discard pile instead of the deck.", image: CHARACTERS.pedro_ramirez.image },
  { title: "Rose Doolan", subtitle: "Aggressive range", description: "You see every other player at -1 distance.", image: CHARACTERS.rose_doolan.image },
  { title: "Sid Ketchum", subtitle: "Active heal", description: "Discard 2 cards to recover 1 HP.", image: CHARACTERS.sid_ketchum.image },
  { title: "Slab the Killer", subtitle: "Hard to stop", description: "Players need 2 Missed! cards to cancel your Bang!.", image: CHARACTERS.slab_the_killer.image },
  { title: "Suzy Lafayette", subtitle: "Empty hand", description: "When you have no cards in hand, draw 1 card.", image: CHARACTERS.suzy_lafayette.image },
  { title: "Vulture Sam", subtitle: "Loot", description: "Whenever a player is eliminated, take all the cards they had.", image: CHARACTERS.vulture_sam.image },
  { title: "Willy the Kid", subtitle: "Fast shooter", description: "You can play any number of Bang! cards during your turn.", image: CHARACTERS.willy_the_kid.image },
];

function GuideStripTab({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const isWide = label.length >= 9;

  return (
    <View style={styles.tabBtnWrap}>
      <WoodButton
        title={label}
        onPress={onPress}
        style={[styles.tabBtn, isWide ? styles.tabBtnWide : null, active ? styles.tabBtnActive : null]}
      />
    </View>
  );
}

function GuideCard({
  item,
  onOpen,
}: {
  item: GuideEntry;
  onOpen: (item: GuideEntry) => void;
}) {
  const hasImage = !!item.image;

  return (
    <View style={styles.guideCard}>
      <View style={styles.guideCardInner}>
        {hasImage ? (
          <View style={styles.imageFrame}>
            <Pressable
              onPress={() => onOpen(item)}
              style={({ pressed }) => [styles.cardPressable, pressed ? styles.cardPressablePressed : null]}
            >
              <Image source={item.image as any} style={styles.cardImage} resizeMode="contain" />
              <View style={styles.tapHintWrap}>
                <Text style={styles.tapHintText}>Tap card</Text>
              </View>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.guideTextCol}>
          {!!item.subtitle ? <Text style={styles.guideItemSubtitle}>{item.subtitle}</Text> : null}
          <Text style={styles.guideItemTitle}>{item.title}</Text>
          <Text style={styles.guideItemBody}>{item.description}</Text>
        </View>
      </View>
    </View>
  );
}

export default function HomeScreen({ navigation }: any) {
  const { width, height } = useWindowDimensions();
  const { name } = usePlayer();

  const [guideOpen, setGuideOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<GuideTab>("overview");
  const [preview, setPreview] = useState<PreviewState>(null);

  const tapSoundRef = useRef<any>(null);
  const previewScale = useRef(new Animated.Value(0.9)).current;
  const previewOpacity = useRef(new Animated.Value(0)).current;

  useAmbientMusic("lobby", true, 0.2);

  useEffect(() => {
    let mounted = true;
    let localSound: any = null;

    (async () => {
      try {
        const mod = require("expo-av");
        const Audio = mod?.Audio;
        if (!Audio) return;

        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, shouldDuckAndroid: true });
        const created = await Audio.Sound.createAsync(CLICK_SFX, {
          shouldPlay: false,
          volume: 0.34,
        });

        localSound = created.sound;

        if (!mounted) {
          try {
            await localSound?.unloadAsync?.();
          } catch {}
          return;
        }

        tapSoundRef.current = localSound;
      } catch {}
    })();

    return () => {
      mounted = false;
      const sound = tapSoundRef.current ?? localSound;
      tapSoundRef.current = null;
      if (sound) {
        Promise.resolve(sound.unloadAsync?.()).catch(() => {});
      }
    };
  }, []);

  useEffect(() => {
    if (!preview) return;

    previewScale.setValue(0.9);
    previewOpacity.setValue(0);

    Animated.parallel([
      Animated.timing(previewScale, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(previewOpacity, {
        toValue: 1,
        duration: 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [preview, previewOpacity, previewScale]);

  const playUiTap = async () => {
    const sound = tapSoundRef.current;
    if (!sound) return;

    try {
      await sound.replayAsync?.();
    } catch {}
  };

  const trimmedName = useMemo(() => String(name ?? "").trim(), [name]);

  const currentEntries = useMemo(() => {
    switch (activeTab) {
      case "overview":
        return OVERVIEW_ENTRIES;
      case "roles":
        return ROLE_ENTRIES;
      case "brown":
        return BROWN_ENTRIES;
      case "blue":
        return BLUE_ENTRIES;
      case "weapons":
        return WEAPON_ENTRIES;
      case "characters":
      default:
        return CHARACTER_ENTRIES;
    }
  }, [activeTab]);

  const openCreate = () => {
    if (trimmedName.length < 2) return navigation?.navigate?.("Profile");
    navigation?.navigate?.("CreateRoom", { name: trimmedName });
  };

  const openJoin = () => {
    if (trimmedName.length < 2) return navigation?.navigate?.("Profile");
    navigation?.navigate?.("JoinRoom", { name: trimmedName });
  };

  const openPreview = (item: GuideEntry) => {
    if (!item.image) return;
    void playUiTap();
    setPreview({
      image: item.image,
      title: item.title,
      subtitle: item.subtitle,
      description: item.description,
    });
  };

  const closePreview = () => {
    void playUiTap();
    setPreview(null);
  };

  return (
    <ImageBackground source={BG} style={styles.bg} resizeMode="cover">
      <StatusBar barStyle="light-content" />
      <View style={styles.bgShade} />

      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.screenPad} showsVerticalScrollIndicator={false}>
          <Text style={styles.heroKicker}>MULTIPLAYER WESTERN CARD GAME</Text>
          <Image source={BANG_LOGO} style={styles.heroLogo} resizeMode="contain" />

          <View style={styles.heroPanel}>
            <Text style={styles.heroTitle}>Ready for the next duel?</Text>
            <Text style={styles.heroBody}>
              Create a room, join your friends, or open the guide before the bullets start flying.
            </Text>
          </View>

          <View style={styles.buttonsBlock}>
            <WoodButton title="Create Room" onPress={openCreate} style={styles.mainBtn} />
            <WoodButton title="Join Room" onPress={openJoin} style={styles.mainBtn} />
            <WoodButton
              title="How To Play"
              onPress={() => {
                setActiveTab("overview");
                setGuideOpen(true);
              }}
              style={styles.mainBtn}
            />
            <WoodButton
              title={trimmedName ? `Change Name (${trimmedName})` : "Change Name"}
              onPress={() => navigation?.navigate?.("Profile")}
              style={styles.mainBtn}
            />
          </View>
        </ScrollView>
      </SafeAreaView>

      <Modal visible={guideOpen} transparent animationType="fade" onRequestClose={() => setGuideOpen(false)}>
        <View style={styles.guideBackdrop}>
          <View style={styles.guideModal}>
            <View style={styles.guideHeaderRow}>
              <View style={styles.guideHeaderTextWrap}>
                <Text style={styles.guideMini}>GAME GUIDE</Text>
                <Text style={styles.guideTitle}>How To Play</Text>
              </View>

              <WoodButton title="Close" onPress={() => setGuideOpen(false)} style={styles.closeBtn} />
            </View>

            <View style={styles.stripWrap}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stripScroll}>
                {GUIDE_TABS.map((tab) => (
                  <GuideStripTab
                    key={tab.key}
                    label={tab.label}
                    active={tab.key === activeTab}
                    onPress={() => {
                      void playUiTap();
                      setActiveTab(tab.key);
                    }}
                  />
                ))}
              </ScrollView>
            </View>

            <View style={styles.sectionBadge}>
              <Text style={styles.sectionBadgeText}>{SECTION_DESCRIPTIONS[activeTab]}</Text>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.guideContent}>
              {currentEntries.map((item) => (
                <GuideCard key={`${activeTab}-${item.title}`} item={item} onOpen={openPreview} />
              ))}
            </ScrollView>

            {preview ? (
              <View style={styles.previewOverlay} pointerEvents="box-none">
                <Pressable style={styles.previewScrim} onPress={closePreview} />

                <Animated.View
                  style={[
                    styles.previewCard,
                    {
                      width: Math.min(width * 0.82, 460),
                      opacity: previewOpacity,
                      transform: [{ scale: previewScale }],
                    },
                  ]}
                >
                  {!!preview.subtitle ? <Text style={styles.previewMini}>{preview.subtitle}</Text> : null}
                  <Text style={styles.previewTitle}>{preview.title}</Text>

                  <Image
                    source={preview.image as any}
                    resizeMode="contain"
                    style={{
                      width: width * 0.45,
                      height: height * 0.45,
                      maxWidth: 420,
                      maxHeight: 620,
                    }}
                  />

                  {!!preview.description ? <Text style={styles.previewBody}>{preview.description}</Text> : null}
                  <Text style={styles.previewHint}>Tap outside to close</Text>
                </Animated.View>
              </View>
            ) : null}
          </View>
        </View>
      </Modal>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1, backgroundColor: "#0b0907" },
  bgShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.43)",
  },
  safe: { flex: 1 },
  screenPad: {
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 26,
    alignItems: "center",
  },
  heroKicker: {
    color: "#d6a150",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 3.3,
    marginTop: 8,
    marginBottom: 4,
    textAlign: "center",
  },
  heroLogo: {
    width: 360,
    height: 230,
    marginTop: -4,
    marginBottom: 14,
  },
  heroPanel: {
    width: "100%",
    backgroundColor: "rgba(10,7,5,0.74)",
    borderRadius: 30,
    borderWidth: 1.4,
    borderColor: "rgba(216,160,84,0.42)",
    paddingHorizontal: 18,
    paddingTop: 26,
    paddingBottom: 22,
    alignItems: "center",
    marginBottom: 18,
  },
  heroTitle: {
    color: "#fff0cf",
    fontSize: 34,
    lineHeight: 39,
    fontWeight: "900",
    textAlign: "center",
    marginBottom: 12,
  },
  heroBody: {
    color: "rgba(255,241,220,0.92)",
    fontSize: 16,
    lineHeight: 26,
    textAlign: "center",
    maxWidth: 330,
  },
  buttonsBlock: {
    width: "100%",
  },
  mainBtn: {
    width: "100%",
    height: 58,
    marginBottom: 16,
  },
  guideBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.62)",
    justifyContent: "center",
    paddingHorizontal: 14,
    paddingVertical: 24,
  },
  guideModal: {
    flex: 1,
    borderRadius: 32,
    borderWidth: 1.6,
    borderColor: "rgba(223,165,86,0.82)",
    backgroundColor: "rgba(7,5,4,0.96)",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    overflow: "hidden",
  },
  guideHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    gap: 12,
  },
  guideHeaderTextWrap: {
    flex: 1,
    paddingRight: 4,
  },
  guideMini: {
    color: "#d7a44f",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 3,
    marginBottom: 6,
  },
  guideTitle: {
    color: "#fff0cf",
    fontSize: 40,
    lineHeight: 42,
    fontWeight: "900",
  },
  closeBtn: {
    width: 140,
    height: 56,
  },
  stripWrap: {
    backgroundColor: "transparent",
    borderWidth: 0,
    paddingVertical: 0,
    marginBottom: 12,
  },
  stripScroll: {
    paddingHorizontal: 0,
    gap: 10,
    alignItems: "center",
  },
  tabBtnWrap: {
    borderRadius: 18,
    padding: 0,
  },
  tabBtn: {
    width: 148,
    height: 52,
    opacity: 0.96,
  },
  tabBtnWide: {
    width: 214,
  },
  tabBtnActive: {
    opacity: 1,
  },
  sectionBadge: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "rgba(44,27,18,0.66)",
    borderWidth: 1,
    borderColor: "rgba(215,164,79,0.16)",
    marginBottom: 12,
  },
  sectionBadgeText: {
    color: "rgba(255,240,207,0.88)",
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },
  guideContent: {
    paddingBottom: 28,
  },
  guideCard: {
    marginBottom: 14,
    borderRadius: 26,
    backgroundColor: "rgba(20,12,10,0.94)",
    borderWidth: 1,
    borderColor: "rgba(255,224,185,0.08)",
    overflow: "hidden",
  },
  guideCardInner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  imageFrame: {
    width: 92,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  cardPressable: {
    alignItems: "center",
    justifyContent: "center",
  },
  cardPressablePressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.92,
  },
  cardImage: {
    width: 96,
    height: 136,
  },
  tapHintWrap: {
    marginTop: 8,
    borderRadius: 999,
    backgroundColor: "rgba(128,18,18,0.82)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "rgba(255,190,190,0.16)",
  },
  tapHintText: {
    color: "#fff0cf",
    fontWeight: "900",
    fontSize: 11,
    letterSpacing: 0.6,
  },
  infoFrame: {
    width: 82,
    height: 112,
    borderRadius: 16,
    backgroundColor: "rgba(76,40,18,0.30)",
    borderWidth: 1,
    borderColor: "rgba(215,164,79,0.32)",
    alignItems: "center",
    justifyContent: "center",
  },
  infoFrameText: {
    color: "#d8a44f",
    fontSize: 15,
    fontWeight: "900",
    letterSpacing: 1.4,
  },
  guideTextCol: {
    flex: 1,
  },
  guideItemSubtitle: {
    color: "#d7a44f",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 1.1,
    marginBottom: 6,
    textTransform: "uppercase",
  },
  guideItemTitle: {
    color: "#fff0cf",
    fontSize: 21,
    fontWeight: "900",
    marginBottom: 8,
  },
  guideItemBody: {
    color: "rgba(255,240,220,0.92)",
    fontSize: 15,
    lineHeight: 24,
  },
  infoOnlyHint: {
    color: "rgba(215,164,79,0.70)",
    fontSize: 12,
    fontWeight: "800",
    marginTop: 10,
  },
  previewOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 12,
    zIndex: 999,
  },
  previewScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.90)",
  },
  previewCard: {
    borderRadius: 28,
    backgroundColor: "rgba(10,8,6,0.98)",
    borderWidth: 1.4,
    borderColor: "rgba(215,164,79,0.44)",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    alignItems: "center",
  },
  previewMini: {
    color: "#d8a44f",
    fontSize: 11,
    fontWeight: "900",
    letterSpacing: 1.4,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  previewTitle: {
    color: "#fff0cf",
    fontSize: 24,
    fontWeight: "900",
    marginBottom: 12,
    textAlign: "center",
  },
  previewBody: {
    color: "rgba(255,240,220,0.94)",
    fontSize: 15,
    lineHeight: 24,
    textAlign: "center",
    marginTop: 10,
  },
  previewHint: {
    color: "rgba(255,240,220,0.74)",
    marginTop: 12,
    fontSize: 13,
    fontWeight: "700",
  },
});
