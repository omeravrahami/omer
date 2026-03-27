/**
 * MoneyCharacter — WorkClock's premium animated mascot.
 * A cartoon shekel bill with expressive eyes, arms, and legs.
 * States: idle | working | break | done | sleeping
 */
import React, { useEffect } from 'react';
import { View, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';

export type MoneyCharacterState = 'idle' | 'working' | 'break' | 'done' | 'sleeping';

interface MoneyCharacterProps {
  state: MoneyCharacterState;
  size?: number; // bill width, default 120
}

// ─── Eye ─────────────────────────────────────────────────────────────────────

interface EyeProps {
  size: number;
  state: MoneyCharacterState;
  side: 'left' | 'right';
}

function Eye({ size, state, side }: EyeProps) {
  const isClosed  = state === 'sleeping';
  const isSquint  = state === 'break';
  const isWide    = state === 'working' || state === 'done';
  const h         = isWide ? size * 1.08 : isSquint ? size * 0.46 : size * 0.92;
  const irisS     = size * 0.58;
  const pupilS    = isWide ? size * 0.42 : size * 0.38;

  // Closed eye — thick arc with lashes
  if (isClosed) {
    return (
      <View style={{ width: size, height: size * 0.55, justifyContent: 'center', alignItems: 'center' }}>
        {/* Arc line */}
        <View style={{
          width: size * 0.92,
          height: size * 0.46,
          borderBottomWidth: 3.5,
          borderLeftWidth: 2.5,
          borderRightWidth: 2.5,
          borderTopWidth: 0,
          borderColor: '#14532d',
          borderRadius: size * 0.46,
        }} />
        {/* Lashes */}
        <View style={{ flexDirection: 'row', gap: size * 0.12, marginTop: 2 }}>
          {['-12deg', '0deg', '12deg'].map((rot, i) => (
            <View key={i} style={{
              width: 2.5,
              height: size * 0.18,
              borderRadius: 2,
              backgroundColor: '#14532d',
              transform: [{ rotate: rot }],
            }} />
          ))}
        </View>
      </View>
    );
  }

  // Squinting happy eye (break)
  if (isSquint) {
    return (
      <View style={{ width: size, height: size * 0.52, justifyContent: 'flex-end', alignItems: 'center' }}>
        <View style={{
          width: size,
          height: h,
          borderRadius: size * 0.5,
          backgroundColor: 'white',
          borderWidth: 2.5,
          borderColor: '#111',
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <View style={{
            width: pupilS,
            height: pupilS * 0.5,
            borderRadius: pupilS * 0.25,
            backgroundColor: '#111',
          }} />
        </View>
      </View>
    );
  }

  // Normal / wide open eye
  return (
    <View style={{
      width: size,
      height: h,
      borderRadius: size * 0.52,
      backgroundColor: 'white',
      borderWidth: 2.5,
      borderColor: '#111',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      // Subtle shadow for depth
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.12,
      shadowRadius: 3,
      elevation: 3,
    }}>
      {/* Iris */}
      <View style={{
        width: irisS,
        height: irisS,
        borderRadius: irisS / 2,
        backgroundColor: '#86efac',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: isWide ? -3 : 4,
      }}>
        {/* Pupil */}
        <View style={{
          width: pupilS,
          height: pupilS,
          borderRadius: pupilS / 2,
          backgroundColor: '#0f172a',
          alignItems: 'flex-start',
          justifyContent: 'flex-start',
          padding: pupilS * 0.1,
        }}>
          {/* Main highlight */}
          <View style={{
            width: pupilS * 0.32,
            height: pupilS * 0.32,
            borderRadius: pupilS * 0.16,
            backgroundColor: 'white',
            alignSelf: side === 'left' ? 'flex-end' : 'flex-start',
          }} />
          {/* Secondary tiny highlight */}
          <View style={{
            position: 'absolute',
            bottom: pupilS * 0.22,
            left: pupilS * 0.2,
            width: pupilS * 0.14,
            height: pupilS * 0.14,
            borderRadius: pupilS * 0.07,
            backgroundColor: 'rgba(255,255,255,0.75)',
          }} />
        </View>
      </View>
    </View>
  );
}

// ─── Eyebrow ──────────────────────────────────────────────────────────────────

function Eyebrow({ size, state, side }: { size: number; state: MoneyCharacterState; side: 'left' | 'right' }) {
  const w = size * 0.88;
  const h = size * 0.155;
  const rot =
    state === 'working' ? (side === 'left' ? '-14deg' : '14deg') :
    state === 'done'    ? (side === 'left' ? '-10deg' : '10deg') :
    state === 'sleeping'? (side === 'left' ? '8deg'  : '-8deg') :
                          (side === 'left' ? '-5deg'  : '5deg');
  const ty =
    state === 'working' ? -size * 0.06 :
    state === 'sleeping' ? size * 0.04 : 0;

  return (
    <View style={{
      width: w,
      height: h,
      borderRadius: h * 0.7,
      backgroundColor: '#14532d',
      transform: [{ rotate: rot }, { translateY: ty }],
    }} />
  );
}

// ─── Mouth ───────────────────────────────────────────────────────────────────

function Mouth({ billW, state }: { billW: number; state: MoneyCharacterState }) {
  const mW =
    state === 'working' ? billW * 0.48 :
    state === 'break'   ? billW * 0.4 :
    state === 'done'    ? billW * 0.44 :
    state === 'sleeping'? billW * 0.28 :
                          billW * 0.38;

  // Sleeping — thin elegant smile arc
  if (state === 'sleeping') {
    return (
      <View style={{
        width: mW,
        height: mW * 0.38,
        borderBottomLeftRadius: mW * 0.5,
        borderBottomRightRadius: mW * 0.5,
        borderLeftWidth: 2.5,
        borderRightWidth: 2.5,
        borderBottomWidth: 2.5,
        borderTopWidth: 0,
        borderColor: '#14532d',
      }} />
    );
  }

  // Normal idle smile arc
  if (state === 'idle') {
    return (
      <View style={{
        width: mW,
        height: mW * 0.42,
        borderBottomLeftRadius: mW * 0.5,
        borderBottomRightRadius: mW * 0.5,
        borderLeftWidth: 3,
        borderRightWidth: 3,
        borderBottomWidth: 3,
        borderTopWidth: 0,
        borderColor: '#14532d',
      }} />
    );
  }

  // Open mouth (working / break / done)
  const mH =
    state === 'working' ? mW * 0.62 :
    state === 'done'    ? mW * 0.54 :
                          mW * 0.46;

  const teethH = mH * 0.4;
  const teethCount = state === 'working' ? 5 : 4;

  return (
    <View style={{
      width: mW,
      height: mH,
      borderRadius: mW * 0.13,
      borderBottomLeftRadius: mW * 0.5,
      borderBottomRightRadius: mW * 0.5,
      backgroundColor: '#111',
      borderWidth: 3,
      borderColor: '#0a0a0a',
      overflow: 'hidden',
    }}>
      {/* Teeth */}
      <View style={{ flexDirection: 'row', height: teethH, backgroundColor: 'white' }}>
        {Array.from({ length: teethCount }).map((_, i) => (
          <View key={i} style={{
            flex: 1,
            borderRightWidth: i < teethCount - 1 ? 1.5 : 0,
            borderColor: '#e2e8f0',
          }} />
        ))}
      </View>
      {/* Tongue (working + done) */}
      {(state === 'working' || state === 'done') ? (
        <View style={{
          alignSelf: 'center',
          marginTop: 3,
          width: mW * 0.38,
          height: mH * 0.32,
          borderRadius: mW * 0.2,
          backgroundColor: '#f87171',
        }}>
          {/* Tongue center line */}
          <View style={{
            position: 'absolute',
            top: 3,
            bottom: 3,
            left: '48%',
            width: 1.5,
            borderRadius: 1,
            backgroundColor: '#ef4444',
          }} />
        </View>
      ) : null}
    </View>
  );
}

// ─── Glove ────────────────────────────────────────────────────────────────────

function Glove({ size }: { size: number }) {
  return (
    <View style={{
      width: size,
      height: size * 0.95,
      borderRadius: size * 0.5,
      backgroundColor: '#f8fafc',
      borderWidth: 2,
      borderColor: '#e2e8f0',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.18,
      shadowRadius: 3,
      elevation: 3,
      overflow: 'hidden',
    }}>
      {/* Finger segments at top */}
      <View style={{
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 3,
        marginTop: 3,
      }}>
        {[0.28, 0.38, 0.28].map((w, i) => (
          <View key={i} style={{
            width: size * w,
            height: size * 0.22,
            borderRadius: size * 0.11,
            backgroundColor: '#e2e8f0',
          }} />
        ))}
      </View>
      {/* Wrist cuff */}
      <View style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: size * 0.22,
        backgroundColor: '#e2e8f0',
        borderBottomLeftRadius: size * 0.5,
        borderBottomRightRadius: size * 0.5,
      }} />
    </View>
  );
}

// ─── Shoe ─────────────────────────────────────────────────────────────────────

function Shoe({ size, flip }: { size: number; flip?: boolean }) {
  return (
    <View style={{
      width: size,
      height: size * 0.5,
      transform: flip ? [{ scaleX: -1 }] : [],
    }}>
      {/* Sole (white, slightly wider) */}
      <View style={{
        position: 'absolute',
        bottom: 0,
        left: -size * 0.04,
        width: size * 1.06,
        height: size * 0.16,
        backgroundColor: '#f1f5f9',
        borderRadius: size * 0.08,
        borderWidth: 1,
        borderColor: '#cbd5e1',
      }} />
      {/* Main upper body */}
      <View style={{
        position: 'absolute',
        bottom: size * 0.1,
        left: 0,
        width: size,
        height: size * 0.35,
        backgroundColor: '#1e293b',
        borderRadius: size * 0.1,
        borderTopRightRadius: size * 0.22,
      }}>
        {/* Lace zone highlight */}
        <View style={{
          position: 'absolute',
          top: size * 0.05,
          left: size * 0.42,
          width: size * 0.36,
          height: size * 0.22,
          backgroundColor: '#f1f5f9',
          borderRadius: size * 0.04,
          opacity: 0.9,
        }}>
          {/* Lace cross lines */}
          {[0.2, 0.55, 0.85].map((pct, i) => (
            <View key={i} style={{
              position: 'absolute',
              top: `${pct * 100}%`,
              left: '10%',
              right: '10%',
              height: 1.5,
              backgroundColor: '#94a3b8',
              borderRadius: 1,
            }} />
          ))}
        </View>
        {/* Toe cap */}
        <View style={{
          position: 'absolute',
          top: size * 0.04,
          left: size * 0.03,
          width: size * 0.32,
          height: size * 0.2,
          backgroundColor: '#334155',
          borderRadius: size * 0.1,
        }} />
      </View>
    </View>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function MoneyCharacter({ state, size = 120 }: MoneyCharacterProps) {
  // Layout
  const billW  = size;
  const billH  = size * 1.22;
  const eyeS   = size * 0.205;
  const bwS    = size * 0.165; // eyebrow width relative
  const armW   = size * 0.115;
  const armH   = size * 0.3;
  const gloveS = size * 0.2;
  const legW   = size * 0.12;
  const legH   = size * 0.22;
  const shoeS  = size * 0.28;

  // ── Animation values ───────────────────────────────────────────────────────
  const bodyY      = useSharedValue(0);
  const bodyRot    = useSharedValue(0);
  const bodyScale  = useSharedValue(1);
  const armLRot    = useSharedValue(-15);
  const armRRot    = useSharedValue(15);
  const legLRot    = useSharedValue(0);
  const legRRot    = useSharedValue(0);
  const zzzOpacity = useSharedValue(0);
  const zzzY       = useSharedValue(0);

  useEffect(() => {
    cancelAnimation(bodyY);
    cancelAnimation(bodyRot);
    cancelAnimation(bodyScale);
    cancelAnimation(armLRot);
    cancelAnimation(armRRot);
    cancelAnimation(legLRot);
    cancelAnimation(legRRot);
    cancelAnimation(zzzOpacity);
    cancelAnimation(zzzY);

    bodyY.value     = 0;
    bodyRot.value   = 0;
    bodyScale.value = 1;
    legLRot.value   = 0;
    legRRot.value   = 0;
    zzzOpacity.value = 0;
    zzzY.value       = 0;

    const ease = Easing.inOut(Easing.ease);

    switch (state) {
      case 'idle':
        bodyScale.value = withRepeat(withSequence(
          withTiming(1.022, { duration: 1900, easing: ease }),
          withTiming(0.984, { duration: 1900, easing: ease }),
        ), -1, false);
        armLRot.value = withRepeat(withSequence(
          withTiming(-20, { duration: 1700, easing: ease }),
          withTiming(-8,  { duration: 1700, easing: ease }),
        ), -1, true);
        armRRot.value = withRepeat(withSequence(
          withTiming(8,  { duration: 1700, easing: ease }),
          withTiming(20, { duration: 1700, easing: ease }),
        ), -1, true);
        break;

      case 'working':
        bodyY.value = withRepeat(withSequence(
          withTiming(-15, { duration: 245, easing: Easing.out(Easing.quad) }),
          withTiming(0,   { duration: 245, easing: Easing.in(Easing.quad) }),
        ), -1, false);
        bodyRot.value = withRepeat(withSequence(
          withTiming(-9, { duration: 245 }),
          withTiming(9,  { duration: 245 }),
        ), -1, false);
        armLRot.value = withRepeat(withSequence(
          withTiming(-115, { duration: 245 }),
          withTiming(-45,  { duration: 245 }),
        ), -1, false);
        armRRot.value = withRepeat(withSequence(
          withTiming(45,  { duration: 245 }),
          withTiming(115, { duration: 245 }),
        ), -1, false);
        legLRot.value = withRepeat(withSequence(
          withTiming(-30, { duration: 245 }),
          withTiming(30,  { duration: 245 }),
        ), -1, false);
        legRRot.value = withRepeat(withSequence(
          withTiming(30,  { duration: 245 }),
          withTiming(-30, { duration: 245 }),
        ), -1, false);
        break;

      case 'break':
        bodyScale.value = withRepeat(withSequence(
          withTiming(1.016, { duration: 1300, easing: ease }),
          withTiming(0.99,  { duration: 1300, easing: ease }),
        ), -1, false);
        armLRot.value = withRepeat(withSequence(
          withTiming(-58, { duration: 950, easing: ease }),
          withTiming(-42, { duration: 950, easing: ease }),
        ), -1, true);
        armRRot.value = withRepeat(withSequence(
          withTiming(42, { duration: 950, easing: ease }),
          withTiming(58, { duration: 950, easing: ease }),
        ), -1, true);
        break;

      case 'done':
        bodyY.value = withRepeat(withSequence(
          withSpring(-20, { damping: 5, stiffness: 230 }),
          withSpring(0,   { damping: 9, stiffness: 180 }),
          withTiming(0, { duration: 320 }),
        ), -1, false);
        armLRot.value = withRepeat(withSequence(
          withTiming(-135, { duration: 210 }),
          withTiming(-95,  { duration: 210 }),
        ), -1, true);
        armRRot.value = withRepeat(withSequence(
          withTiming(95,  { duration: 210 }),
          withTiming(135, { duration: 210 }),
        ), -1, true);
        break;

      case 'sleeping':
        bodyRot.value   = withTiming(16, { duration: 700 });
        bodyScale.value = withRepeat(withSequence(
          withTiming(1.045, { duration: 3000, easing: ease }),
          withTiming(0.966, { duration: 3000, easing: ease }),
        ), -1, false);
        armLRot.value = withTiming(-6, { duration: 700 });
        armRRot.value = withTiming(6,  { duration: 700 });
        zzzOpacity.value = withRepeat(withSequence(
          withTiming(0, { duration: 0 }),
          withTiming(1, { duration: 480 }),
          withTiming(1, { duration: 740 }),
          withTiming(0, { duration: 480 }),
          withTiming(0, { duration: 280 }),
        ), -1, false);
        zzzY.value = withRepeat(withSequence(
          withTiming(0,   { duration: 0 }),
          withTiming(-32, { duration: 1700 }),
          withTiming(0,   { duration: 0 }),
          withTiming(0,   { duration: 280 }),
        ), -1, false);
        break;
    }
  }, [state]);

  const bodyStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: bodyY.value },
      { scale: bodyScale.value },
      { rotate: `${bodyRot.value}deg` },
    ],
  }));
  const armLStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${armLRot.value}deg` }],
  }));
  const armRStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${armRRot.value}deg` }],
  }));
  const legLStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${legLRot.value}deg` }],
  }));
  const legRStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${legRRot.value}deg` }],
  }));
  const zzzStyle = useAnimatedStyle(() => ({
    opacity: zzzOpacity.value,
    transform: [{ translateY: zzzY.value }],
  }));

  const totalW = billW + (armW + gloveS) * 2 + 18;
  const totalH = billH + legH + shoeS * 0.5 + 44;

  // Bill gradient colors per state
  const gradColors: [string, string, string] =
    state === 'working' ? ['#4ade80', '#16a34a', '#14532d'] :
    state === 'break'   ? ['#6ee7b7', '#22c55e', '#15803d'] :
    state === 'done'    ? ['#86efac', '#4ade80', '#16a34a'] :
    state === 'sleeping'? ['#d1fae5', '#6ee7b7', '#22c55e'] :
                          ['#4ade80', '#22c55e', '#15803d'];

  return (
    <View style={{ width: totalW, height: totalH, alignItems: 'center' }}>

      {/* ── ZZZ ── */}
      {state === 'sleeping' ? (
        <Animated.View style={[{
          position: 'absolute',
          top: 0,
          right: totalW * 0.5,
          zIndex: 30,
        }, zzzStyle]}>
          <Text style={{
            fontSize: size * 0.16,
            fontWeight: '900',
            color: '#818cf8',
            letterSpacing: 1,
            textShadowColor: 'rgba(129,140,248,0.4)',
            textShadowOffset: { width: 0, height: 2 },
            textShadowRadius: 4,
          }}>ZZZ</Text>
        </Animated.View>
      ) : null}

      {/* ── Floating props ── */}
      {state === 'working' ? (
        <View style={{ position: 'absolute', top: 2, right: 6, zIndex: 30 }}>
          <Text style={{ fontSize: size * 0.25 }}>⏰</Text>
        </View>
      ) : null}
      {state === 'done' ? (
        <>
          <View style={{ position: 'absolute', top: 0, left: 4, zIndex: 30 }}>
            <Text style={{ fontSize: size * 0.22 }}>✨</Text>
          </View>
          <View style={{ position: 'absolute', top: 8, right: 8, zIndex: 30 }}>
            <Text style={{ fontSize: size * 0.16 }}>⭐</Text>
          </View>
        </>
      ) : null}

      {/* ── ANIMATED BODY ── */}
      <Animated.View style={[{ alignItems: 'center' }, bodyStyle]}>

        {/* Break: red cap */}
        {state === 'break' ? (
          <View style={{ alignItems: 'center', marginBottom: -5, zIndex: 20 }}>
            {/* Brim */}
            <View style={{
              width: billW * 0.78,
              height: size * 0.068,
              backgroundColor: '#dc2626',
              borderRadius: size * 0.034,
              marginLeft: billW * 0.08,
              marginBottom: -2,
              shadowColor: '#991b1b',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.4,
              shadowRadius: 2,
              elevation: 4,
            }} />
            {/* Crown */}
            <View style={{
              width: billW * 0.6,
              height: size * 0.15,
              backgroundColor: '#ef4444',
              borderTopLeftRadius: billW * 0.3,
              borderTopRightRadius: billW * 0.3,
              borderBottomLeftRadius: 4,
              borderBottomRightRadius: 4,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <View style={{
                width: size * 0.06,
                height: size * 0.06,
                borderRadius: size * 0.03,
                backgroundColor: 'white',
                opacity: 0.8,
              }} />
            </View>
          </View>
        ) : null}

        {/* Break: burger */}
        {state === 'break' ? (
          <Text style={{ fontSize: size * 0.28, marginBottom: 3, zIndex: 10 }}>🍔</Text>
        ) : null}

        {/* ── ROW: LEFT ARM + BILL + RIGHT ARM ── */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>

          {/* LEFT ARM */}
          <View style={{ marginTop: billH * 0.26, alignItems: 'center' }}>
            <Animated.View style={armLStyle}>
              {/* Arm upper */}
              <View style={{
                width: armW,
                height: armH * 0.55,
                backgroundColor: '#166534',
                borderRadius: armW / 2,
                alignSelf: 'center',
              }} />
              {/* Elbow joint */}
              <View style={{
                width: armW * 1.2,
                height: armW * 1.2,
                borderRadius: armW * 0.6,
                backgroundColor: '#15803d',
                alignSelf: 'center',
                marginVertical: -2,
              }} />
              {/* Arm lower */}
              <View style={{
                width: armW,
                height: armH * 0.45,
                backgroundColor: '#166534',
                borderRadius: armW / 2,
                alignSelf: 'center',
              }} />
              {/* Glove */}
              <View style={{
                marginTop: -3,
                marginLeft: -(gloveS - armW) / 2,
              }}>
                <Glove size={gloveS} />
              </View>
            </Animated.View>
          </View>

          {/* ── BILL BODY ── */}
          <LinearGradient
            colors={gradColors}
            start={{ x: 0.1, y: 0 }}
            end={{ x: 0.9, y: 1 }}
            style={{
              width: billW,
              height: billH,
              borderRadius: billW * 0.09,
              borderWidth: 2.5,
              borderColor: '#14532d',
              alignItems: 'center',
              justifyContent: 'center',
              marginHorizontal: 3,
              shadowColor: '#052e16',
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.35,
              shadowRadius: 10,
              elevation: 12,
              overflow: 'hidden',
            }}
          >
            {/* Inner frame */}
            <View style={{
              position: 'absolute',
              top: 8, left: 8, right: 8, bottom: 8,
              borderRadius: billW * 0.065,
              borderWidth: 1.5,
              borderColor: 'rgba(255,255,255,0.25)',
            }} />

            {/* Security thread (vertical line) */}
            <View style={{
              position: 'absolute',
              left: billW * 0.2,
              top: 0, bottom: 0,
              width: 2,
              backgroundColor: 'rgba(255,255,255,0.15)',
            }} />

            {/* Corner seals */}
            {([
              { top: 10, left: 10 },
              { top: 10, right: 10 },
              { bottom: 10, left: 10 },
              { bottom: 10, right: 10 },
            ] as const).map((pos, i) => (
              <View key={i} style={{
                position: 'absolute',
                ...pos,
                width: billW * 0.115,
                height: billW * 0.115,
                borderRadius: billW * 0.058,
                borderWidth: 1.5,
                borderColor: 'rgba(255,255,255,0.3)',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <View style={{
                  width: billW * 0.05,
                  height: billW * 0.05,
                  borderRadius: billW * 0.025,
                  backgroundColor: 'rgba(255,255,255,0.2)',
                }} />
              </View>
            ))}

            {/* Serial number bars */}
            <View style={{
              position: 'absolute',
              top: 12,
              left: billW * 0.28,
              right: 16,
              height: 5,
              borderRadius: 3,
              backgroundColor: 'rgba(255,255,255,0.12)',
            }} />
            <View style={{
              position: 'absolute',
              bottom: 12,
              left: 16,
              right: billW * 0.28,
              height: 5,
              borderRadius: 3,
              backgroundColor: 'rgba(255,255,255,0.12)',
            }} />

            {/* Center oval watermark */}
            <View style={{
              position: 'absolute',
              width: billW * 0.7,
              height: billH * 0.48,
              borderRadius: billW * 0.35,
              borderWidth: 1.5,
              borderColor: 'rgba(255,255,255,0.18)',
            }} />

            {/* ── FACE ── */}
            <View style={{ alignItems: 'center', zIndex: 10 }}>

              {/* Eyebrows */}
              <View style={{
                flexDirection: 'row',
                gap: eyeS * 0.72,
                marginBottom: size * 0.042,
              }}>
                <Eyebrow size={bwS} state={state} side="left" />
                <Eyebrow size={bwS} state={state} side="right" />
              </View>

              {/* Eyes */}
              <View style={{
                flexDirection: 'row',
                gap: eyeS * 0.62,
                marginBottom: size * 0.05,
              }}>
                <Eye size={eyeS} state={state} side="left" />
                <Eye size={eyeS} state={state} side="right" />
              </View>

              {/* ₪ watermark behind face */}
              <Text style={{
                position: 'absolute',
                color: 'rgba(20,83,45,0.22)',
                fontSize: size * 1.1,
                fontWeight: '900',
                top: -size * 0.3,
                letterSpacing: -2,
              }}>₪</Text>

              {/* Mouth */}
              <Mouth billW={billW} state={state} />

              {/* Cheeks */}
              {state !== 'sleeping' ? (
                <View style={{
                  flexDirection: 'row',
                  gap: billW * 0.46,
                  marginTop: size * 0.03,
                }}>
                  <View style={{
                    width: size * 0.115,
                    height: size * 0.07,
                    borderRadius: size * 0.04,
                    backgroundColor: '#fda4af',
                    opacity: 0.58,
                  }} />
                  <View style={{
                    width: size * 0.115,
                    height: size * 0.07,
                    borderRadius: size * 0.04,
                    backgroundColor: '#fda4af',
                    opacity: 0.58,
                  }} />
                </View>
              ) : null}
            </View>
          </LinearGradient>

          {/* RIGHT ARM */}
          <View style={{ marginTop: billH * 0.26, alignItems: 'center' }}>
            <Animated.View style={armRStyle}>
              <View style={{
                width: armW,
                height: armH * 0.55,
                backgroundColor: '#166534',
                borderRadius: armW / 2,
                alignSelf: 'center',
              }} />
              <View style={{
                width: armW * 1.2,
                height: armW * 1.2,
                borderRadius: armW * 0.6,
                backgroundColor: '#15803d',
                alignSelf: 'center',
                marginVertical: -2,
              }} />
              <View style={{
                width: armW,
                height: armH * 0.45,
                backgroundColor: '#166534',
                borderRadius: armW / 2,
                alignSelf: 'center',
              }} />
              <View style={{
                marginTop: -3,
                marginLeft: -(gloveS - armW) / 2,
              }}>
                <Glove size={gloveS} />
              </View>
            </Animated.View>
          </View>
        </View>

        {/* ── LEGS ── */}
        <View style={{
          flexDirection: 'row',
          gap: billW * 0.18,
          marginTop: -4,
          paddingHorizontal: armW + gloveS + 6,
        }}>
          {/* Left leg */}
          <Animated.View style={[{ alignItems: 'flex-end' }, legLStyle]}>
            <View style={{
              width: legW,
              height: legH,
              backgroundColor: '#166534',
              borderRadius: legW / 2,
              marginLeft: shoeS * 0.28,
            }} />
            <View style={{ marginTop: -3 }}>
              <Shoe size={shoeS} />
            </View>
          </Animated.View>

          {/* Right leg */}
          <Animated.View style={[{ alignItems: 'flex-start' }, legRStyle]}>
            <View style={{
              width: legW,
              height: legH,
              backgroundColor: '#166534',
              borderRadius: legW / 2,
              marginRight: shoeS * 0.28,
            }} />
            <View style={{ marginTop: -3 }}>
              <Shoe size={shoeS} flip />
            </View>
          </Animated.View>
        </View>

      </Animated.View>
    </View>
  );
}
