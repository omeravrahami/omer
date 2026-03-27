/**
 * MoneyCharacter — WorkClock mascot.
 * 3D cartoon money bill with volume, gradients, highlights & shadows.
 * Inspired by Duolingo / top-tier app mascot style.
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
  state?: MoneyCharacterState;
  size?: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Simulate a 3D outline by rendering a dark slightly-larger shadow layer */
function Outlined({
  children,
  radius,
  outlineColor = '#0a3d1a',
  spread = 3,
  style,
}: {
  children: React.ReactNode;
  radius: number;
  outlineColor?: string;
  spread?: number;
  style?: object;
}) {
  return (
    <View style={[{ position: 'relative' }, style]}>
      <View
        style={{
          position: 'absolute',
          top: -spread / 2,
          left: -spread / 2,
          right: -spread / 2,
          bottom: -spread / 2,
          borderRadius: radius + spread / 2,
          backgroundColor: outlineColor,
        }}
      />
      {children}
    </View>
  );
}

// ─── Eye ─────────────────────────────────────────────────────────────────────

function Eye({
  w,
  h,
  state,
}: {
  w: number;
  h: number;
  state: MoneyCharacterState;
}) {
  const closed = state === 'sleeping' || state === 'done';
  const squint = state === 'break';
  const wide   = state === 'working';
  const eyeH   = wide ? h * 1.08 : squint ? h * 0.45 : closed ? h * 0.28 : h;

  if (closed) {
    return (
      <View style={{ width: w, height: h * 0.5, alignItems: 'center', justifyContent: 'center' }}>
        {/* closed arc */}
        <View
          style={{
            width: w * 0.9,
            height: h * 0.44,
            borderBottomLeftRadius: w * 0.5,
            borderBottomRightRadius: w * 0.5,
            borderBottomWidth: 3.5,
            borderLeftWidth: 2.5,
            borderRightWidth: 2.5,
            borderTopWidth: 0,
            borderColor: '#0f3320',
          }}
        />
        {/* lashes */}
        <View style={{ flexDirection: 'row', gap: w * 0.12, marginTop: 2 }}>
          {['-12deg', '0deg', '12deg'].map((r, i) => (
            <View
              key={i}
              style={{
                width: 2.5,
                height: h * 0.2,
                borderRadius: 2,
                backgroundColor: '#0f3320',
                transform: [{ rotate: r }],
              }}
            />
          ))}
        </View>
      </View>
    );
  }

  const irisS  = w * 0.6;
  const pupilS = irisS * 0.68;

  return (
    <Outlined radius={w * 0.52} outlineColor="#0a3d1a" spread={2.5}>
      <View
        style={{
          width: w,
          height: eyeH,
          borderRadius: w * 0.52,
          backgroundColor: 'white',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {/* iris */}
        <View
          style={{
            width: irisS,
            height: irisS,
            borderRadius: irisS / 2,
            backgroundColor: wide ? '#a3e635' : '#4ade80',
            alignItems: 'center',
            justifyContent: 'center',
            marginTop: wide ? -4 : squint ? 0 : 3,
          }}
        >
          {/* pupil */}
          <View
            style={{
              width: pupilS,
              height: pupilS,
              borderRadius: pupilS / 2,
              backgroundColor: '#0c1a10',
            }}
          >
            {/* main highlight */}
            <View
              style={{
                position: 'absolute',
                top: pupilS * 0.1,
                right: pupilS * 0.08,
                width: pupilS * 0.36,
                height: pupilS * 0.36,
                borderRadius: pupilS * 0.18,
                backgroundColor: 'rgba(255,255,255,0.95)',
              }}
            />
            {/* small secondary highlight */}
            <View
              style={{
                position: 'absolute',
                bottom: pupilS * 0.2,
                left: pupilS * 0.18,
                width: pupilS * 0.16,
                height: pupilS * 0.16,
                borderRadius: pupilS * 0.08,
                backgroundColor: 'rgba(255,255,255,0.6)',
              }}
            />
          </View>
        </View>
        {/* squint eyelid */}
        {squint === true && (
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: eyeH * 0.45,
              borderTopLeftRadius: w * 0.52,
              borderTopRightRadius: w * 0.52,
              backgroundColor: '#15803d',
            }}
          />
        )}
        {/* top inner glare strip */}
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: eyeH * 0.22,
            borderTopLeftRadius: w * 0.52,
            borderTopRightRadius: w * 0.52,
            backgroundColor: 'rgba(255,255,255,0.12)',
          }}
        />
      </View>
    </Outlined>
  );
}

// ─── Eyebrow ──────────────────────────────────────────────────────────────────

function Eyebrow({ w, state, side }: { w: number; state: MoneyCharacterState; side: 'L' | 'R' }) {
  const h   = w * 0.28;
  const rot =
    state === 'working' ? (side === 'L' ? '-18deg' : '18deg') :
    state === 'done'    ? (side === 'L' ? '-8deg'  : '8deg')  :
    state === 'sleeping'? (side === 'L' ? '10deg'  : '-10deg'):
                          (side === 'L' ? '-6deg'  : '6deg');
  const ty  =
    state === 'working' ? -w * 0.12 :
    state === 'sleeping' ? w * 0.08 : 0;

  return (
    <View
      style={{
        width: w,
        height: h,
        borderRadius: h * 0.7,
        backgroundColor: '#0f3320',
        transform: [{ rotate: rot }, { translateY: ty }],
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.25,
        shadowRadius: 1,
        elevation: 2,
      }}
    />
  );
}

// ─── Mouth ───────────────────────────────────────────────────────────────────

function Mouth({ bw, state }: { bw: number; state: MoneyCharacterState }) {
  const asleep = state === 'sleeping' || state === 'done';
  const eating = state === 'break';
  const pumped = state === 'working';
  const mW     = pumped ? bw * 0.52 : eating ? bw * 0.44 : bw * 0.36;

  if (asleep) {
    return (
      <View
        style={{
          width: mW,
          height: mW * 0.36,
          borderBottomLeftRadius: mW * 0.5,
          borderBottomRightRadius: mW * 0.5,
          borderLeftWidth: 3,
          borderRightWidth: 3,
          borderBottomWidth: 3,
          borderTopWidth: 0,
          borderColor: '#0f3320',
        }}
      />
    );
  }

  if (pumped || eating) {
    const mH       = pumped ? mW * 0.64 : mW * 0.52;
    const teethCnt = pumped ? 5 : 4;
    return (
      <Outlined
        radius={mW * 0.16}
        outlineColor="#0a0f0a"
        spread={3}
      >
        <View
          style={{
            width: mW,
            height: mH,
            borderRadius: mW * 0.16,
            borderBottomLeftRadius: mW * 0.5,
            borderBottomRightRadius: mW * 0.5,
            backgroundColor: '#111',
            overflow: 'hidden',
          }}
        >
          {/* teeth */}
          <View style={{ flexDirection: 'row', height: mH * 0.38, backgroundColor: '#fff' }}>
            {Array.from({ length: teethCnt }).map((_, i) => (
              <View
                key={i}
                style={{
                  flex: 1,
                  borderRightWidth: i < teethCnt - 1 ? 1.5 : 0,
                  borderColor: '#d1d5db',
                }}
              />
            ))}
          </View>
          {/* tongue */}
          {pumped === true && (
            <View
              style={{
                alignSelf: 'center',
                marginTop: 3,
                width: mW * 0.36,
                height: mH * 0.3,
                borderRadius: mW * 0.2,
                backgroundColor: '#f87171',
                borderWidth: 1,
                borderColor: '#ef4444',
              }}
            >
              <View
                style={{
                  position: 'absolute',
                  top: 3,
                  bottom: 3,
                  left: '47%',
                  width: 1.5,
                  backgroundColor: '#dc2626',
                  borderRadius: 1,
                }}
              />
            </View>
          )}
        </View>
      </Outlined>
    );
  }

  // idle smile
  return (
    <View
      style={{
        width: mW,
        height: mW * 0.42,
        borderBottomLeftRadius: mW * 0.5,
        borderBottomRightRadius: mW * 0.5,
        borderLeftWidth: 3,
        borderRightWidth: 3,
        borderBottomWidth: 3,
        borderTopWidth: 0,
        borderColor: '#0f3320',
      }}
    />
  );
}

// ─── Glove ────────────────────────────────────────────────────────────────────

function Glove({ s }: { s: number }) {
  return (
    <Outlined radius={s * 0.52} outlineColor="#888" spread={2}>
      <View
        style={{
          width: s,
          height: s,
          borderRadius: s * 0.52,
          backgroundColor: '#f8fafc',
          overflow: 'hidden',
        }}
      >
        {/* finger nubs at top */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'center',
            gap: 3,
            marginTop: 4,
          }}
        >
          {[s * 0.28, s * 0.36, s * 0.28].map((fw, i) => (
            <View
              key={i}
              style={{
                width: fw,
                height: s * 0.24,
                borderRadius: s * 0.12,
                backgroundColor: '#e2e8f0',
              }}
            />
          ))}
        </View>
        {/* knuckle line */}
        <View
          style={{
            marginHorizontal: s * 0.1,
            marginTop: 3,
            height: 1.5,
            borderRadius: 1,
            backgroundColor: '#cbd5e1',
          }}
        />
        {/* wrist cuff */}
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: s * 0.24,
            backgroundColor: '#e2e8f0',
            borderBottomLeftRadius: s * 0.52,
            borderBottomRightRadius: s * 0.52,
          }}
        />
        {/* highlight */}
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: s * 0.08,
            right: s * 0.08,
            height: s * 0.32,
            borderTopLeftRadius: s * 0.52,
            borderTopRightRadius: s * 0.52,
            backgroundColor: 'rgba(255,255,255,0.5)',
          }}
        />
      </View>
    </Outlined>
  );
}

// ─── Shoe ─────────────────────────────────────────────────────────────────────

function Shoe({ s, flip = false }: { s: number; flip?: boolean }) {
  return (
    <View
      style={{
        width: s * 1.1,
        height: s * 0.52,
        transform: flip ? [{ scaleX: -1 }] : [],
      }}
    >
      {/* sole (white) */}
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: s * 1.1,
          height: s * 0.17,
          backgroundColor: '#f1f5f9',
          borderRadius: s * 0.085,
          borderWidth: 1,
          borderColor: '#cbd5e1',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.2,
          shadowRadius: 2,
          elevation: 2,
        }}
      />
      {/* upper (black) */}
      <View
        style={{
          position: 'absolute',
          bottom: s * 0.11,
          left: 0,
          width: s * 1.1,
          height: s * 0.38,
          backgroundColor: '#1e293b',
          borderRadius: s * 0.1,
          borderTopRightRadius: s * 0.26,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.3,
          shadowRadius: 3,
          elevation: 4,
        }}
      >
        {/* lace zone */}
        <View
          style={{
            position: 'absolute',
            top: s * 0.04,
            left: s * 0.4,
            width: s * 0.46,
            height: s * 0.24,
            backgroundColor: '#e2e8f0',
            borderRadius: s * 0.04,
          }}
        >
          {[0.25, 0.6].map((p, i) => (
            <View
              key={i}
              style={{
                position: 'absolute',
                top: `${p * 100}%`,
                left: '8%',
                right: '8%',
                height: 1.5,
                backgroundColor: '#94a3b8',
                borderRadius: 1,
              }}
            />
          ))}
        </View>
        {/* toe cap */}
        <View
          style={{
            position: 'absolute',
            top: s * 0.06,
            left: s * 0.04,
            width: s * 0.3,
            height: s * 0.22,
            backgroundColor: '#334155',
            borderRadius: s * 0.1,
          }}
        />
        {/* top highlight */}
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: s * 0.1,
            borderTopLeftRadius: s * 0.1,
            borderTopRightRadius: s * 0.26,
            backgroundColor: 'rgba(255,255,255,0.1)',
          }}
        />
      </View>
    </View>
  );
}

// ─── Arm ─────────────────────────────────────────────────────────────────────

function Arm({ w, h, gloveS }: { w: number; h: number; gloveS: number }) {
  return (
    <View style={{ alignItems: 'center' }}>
      {/* upper segment */}
      <LinearGradient
        colors={['#22c55e', '#166534']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          width: w,
          height: h * 0.55,
          borderRadius: w / 2,
          borderWidth: 1.5,
          borderColor: '#0f3320',
        }}
      />
      {/* elbow joint */}
      <View
        style={{
          width: w * 1.3,
          height: w * 1.3,
          borderRadius: w * 0.65,
          backgroundColor: '#1a7a3f',
          borderWidth: 1.5,
          borderColor: '#0f3320',
          marginVertical: -2,
          alignSelf: 'center',
        }}
      />
      {/* lower segment */}
      <LinearGradient
        colors={['#22c55e', '#166534']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          width: w,
          height: h * 0.45,
          borderRadius: w / 2,
          borderWidth: 1.5,
          borderColor: '#0f3320',
        }}
      />
      {/* glove */}
      <View style={{ marginTop: -2, marginLeft: -(gloveS - w) / 2 }}>
        <Glove s={gloveS} />
      </View>
    </View>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function MoneyCharacter({ state = 'idle', size = 120 }: MoneyCharacterProps) {
  const bW       = size;           // bill width
  const bH       = size * 1.24;   // bill height
  const eyeW     = size * 0.2;
  const eyeH     = size * 0.23;
  const browW    = size * 0.16;
  const armW     = size * 0.12;
  const armH     = size * 0.3;
  const gloveS   = size * 0.22;
  const legW     = size * 0.13;
  const legH     = size * 0.22;
  const shoeS    = size * 0.28;
  const stackOff = size * 0.06;   // how much back bills peek out

  // ── Animation values ─────────────────────────────────────────────────────
  const bodyY      = useSharedValue(0);
  const bodyRot    = useSharedValue(0);
  const bodySc     = useSharedValue(1);
  const armLRot    = useSharedValue(-14);
  const armRRot    = useSharedValue(14);
  const legLRot    = useSharedValue(0);
  const legRRot    = useSharedValue(0);
  const zzzOp      = useSharedValue(0);
  const zzzY       = useSharedValue(0);

  useEffect(() => {
    [bodyY, bodyRot, bodySc, armLRot, armRRot, legLRot, legRRot, zzzOp, zzzY]
      .forEach(v => cancelAnimation(v));

    bodyY.value   = 0;
    bodyRot.value = 0;
    bodySc.value  = 1;
    legLRot.value = 0;
    legRRot.value = 0;
    zzzOp.value   = 0;
    zzzY.value    = 0;

    const sin = Easing.inOut(Easing.ease);

    switch (state) {
      case 'idle':
        bodySc.value = withRepeat(withSequence(
          withTiming(1.022, { duration: 2000, easing: sin }),
          withTiming(0.983, { duration: 2000, easing: sin }),
        ), -1, false);
        armLRot.value = withRepeat(withSequence(
          withTiming(-20, { duration: 1800, easing: sin }),
          withTiming(-8,  { duration: 1800, easing: sin }),
        ), -1, true);
        armRRot.value = withRepeat(withSequence(
          withTiming(8,  { duration: 1800, easing: sin }),
          withTiming(20, { duration: 1800, easing: sin }),
        ), -1, true);
        break;

      case 'working':
        bodyY.value = withRepeat(withSequence(
          withTiming(-16, { duration: 240, easing: Easing.out(Easing.quad) }),
          withTiming(0,   { duration: 240, easing: Easing.in(Easing.quad) }),
        ), -1, false);
        bodyRot.value = withRepeat(withSequence(
          withTiming(-9, { duration: 240 }),
          withTiming(9,  { duration: 240 }),
        ), -1, false);
        armLRot.value = withRepeat(withSequence(
          withTiming(-120, { duration: 240 }),
          withTiming(-45,  { duration: 240 }),
        ), -1, false);
        armRRot.value = withRepeat(withSequence(
          withTiming(45,  { duration: 240 }),
          withTiming(120, { duration: 240 }),
        ), -1, false);
        legLRot.value = withRepeat(withSequence(
          withTiming(-32, { duration: 240 }),
          withTiming(32,  { duration: 240 }),
        ), -1, false);
        legRRot.value = withRepeat(withSequence(
          withTiming(32,  { duration: 240 }),
          withTiming(-32, { duration: 240 }),
        ), -1, false);
        break;

      case 'break':
        bodySc.value = withRepeat(withSequence(
          withTiming(1.016, { duration: 1400, easing: sin }),
          withTiming(0.99,  { duration: 1400, easing: sin }),
        ), -1, false);
        armLRot.value = withRepeat(withSequence(
          withTiming(-60, { duration: 1000, easing: sin }),
          withTiming(-44, { duration: 1000, easing: sin }),
        ), -1, true);
        armRRot.value = withRepeat(withSequence(
          withTiming(44, { duration: 1000, easing: sin }),
          withTiming(60, { duration: 1000, easing: sin }),
        ), -1, true);
        break;

      case 'done':
        bodyY.value = withRepeat(withSequence(
          withSpring(-20, { damping: 5, stiffness: 240 }),
          withSpring(0,   { damping: 9, stiffness: 180 }),
          withTiming(0, { duration: 360 }),
        ), -1, false);
        armLRot.value = withRepeat(withSequence(
          withTiming(-138, { duration: 200 }),
          withTiming(-95,  { duration: 200 }),
        ), -1, true);
        armRRot.value = withRepeat(withSequence(
          withTiming(95,  { duration: 200 }),
          withTiming(138, { duration: 200 }),
        ), -1, true);
        break;

      case 'sleeping':
        bodyRot.value = withTiming(15, { duration: 700 });
        bodySc.value  = withRepeat(withSequence(
          withTiming(1.048, { duration: 3200, easing: sin }),
          withTiming(0.963, { duration: 3200, easing: sin }),
        ), -1, false);
        armLRot.value = withTiming(-6, { duration: 700 });
        armRRot.value = withTiming(6,  { duration: 700 });
        zzzOp.value   = withRepeat(withSequence(
          withTiming(0, { duration: 0 }),
          withTiming(1, { duration: 480 }),
          withTiming(1, { duration: 800 }),
          withTiming(0, { duration: 480 }),
          withTiming(0, { duration: 320 }),
        ), -1, false);
        zzzY.value = withRepeat(withSequence(
          withTiming(0,   { duration: 0 }),
          withTiming(-30, { duration: 1760 }),
          withTiming(0,   { duration: 0 }),
          withTiming(0,   { duration: 320 }),
        ), -1, false);
        break;
    }
  }, [state]);

  const bodyStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: bodyY.value },
      { scale: bodySc.value },
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
  const zzzStyle  = useAnimatedStyle(() => ({
    opacity: zzzOp.value,
    transform: [{ translateY: zzzY.value }],
  }));

  // gradient shift per state
  const grad: [string, string, string] =
    state === 'working' ? ['#86efac', '#22c55e', '#15803d'] :
    state === 'break'   ? ['#6ee7b7', '#16a34a', '#14532d'] :
    state === 'done'    ? ['#d1fae5', '#4ade80', '#16a34a'] :
    state === 'sleeping'? ['#dcfce7', '#6ee7b7', '#22c55e'] :
                          ['#4ade80', '#22c55e', '#15803d'];

  // arm pivot offset from bill top
  const armTop = bH * 0.27;
  // extra space left/right for arms sticking out
  const sideSpace = armW + gloveS + 10;

  return (
    <View style={{ alignItems: 'center' }}>
      {/* ── Floating state props ── */}
      {state === 'sleeping' ? (
        <Animated.View
          style={[
            { position: 'absolute', top: -8, right: 10, zIndex: 30 },
            zzzStyle,
          ]}
        >
          <Text
            style={{
              fontSize: size * 0.16,
              fontWeight: '900',
              color: '#818cf8',
              textShadowColor: 'rgba(129,140,248,0.5)',
              textShadowOffset: { width: 0, height: 2 },
              textShadowRadius: 4,
            }}
          >
            ZZZ
          </Text>
        </Animated.View>
      ) : null}

      {state === 'working' ? (
        <View style={{ position: 'absolute', top: 0, right: 0, zIndex: 30 }}>
          <Text style={{ fontSize: size * 0.26 }}>⏰</Text>
        </View>
      ) : null}

      {state === 'done' ? (
        <>
          <View style={{ position: 'absolute', top: -4, left: 0, zIndex: 30 }}>
            <Text style={{ fontSize: size * 0.22 }}>✨</Text>
          </View>
          <View style={{ position: 'absolute', top: 4, right: 2, zIndex: 30 }}>
            <Text style={{ fontSize: size * 0.15 }}>⭐</Text>
          </View>
        </>
      ) : null}

      {/* ── MAIN ANIMATED GROUP ── */}
      <Animated.View style={[{ alignItems: 'center' }, bodyStyle]}>

        {/* break: cap */}
        {state === 'break' ? (
          <View style={{ alignItems: 'center', marginBottom: -4, zIndex: 20 }}>
            <View
              style={{
                width: bW * 0.78,
                height: size * 0.065,
                backgroundColor: '#dc2626',
                borderRadius: 4,
                marginLeft: bW * 0.1,
                marginBottom: -2,
                shadowColor: '#7f1d1d',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.5,
                shadowRadius: 2,
                elevation: 3,
              }}
            />
            <View
              style={{
                width: bW * 0.62,
                height: size * 0.16,
                backgroundColor: '#ef4444',
                borderTopLeftRadius: bW * 0.31,
                borderTopRightRadius: bW * 0.31,
                borderBottomLeftRadius: 4,
                borderBottomRightRadius: 4,
                alignItems: 'center',
                paddingTop: 5,
                shadowColor: '#7f1d1d',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.4,
                shadowRadius: 2,
                elevation: 3,
              }}
            >
              <View
                style={{
                  width: size * 0.06,
                  height: size * 0.06,
                  borderRadius: size * 0.03,
                  backgroundColor: 'rgba(255,255,255,0.7)',
                }}
              />
            </View>
          </View>
        ) : null}

        {state === 'break' ? (
          <Text style={{ fontSize: size * 0.28, marginBottom: 3 }}>🍔</Text>
        ) : null}

        {/* ── BILL CONTAINER WITH ARMS ── */}
        <View
          style={{
            width: bW + sideSpace * 2,
            height: bH + stackOff,
            position: 'relative',
          }}
        >
          {/* ── BILL STACK (back bills) ── */}
          {/* back bill */}
          <View
            style={{
              position: 'absolute',
              top: stackOff,
              right: sideSpace - stackOff,
              width: bW,
              height: bH,
              backgroundColor: '#14532d',
              borderRadius: bW * 0.09,
              transform: [{ rotate: '5deg' }],
              shadowColor: '#000',
              shadowOffset: { width: 2, height: 4 },
              shadowOpacity: 0.25,
              shadowRadius: 4,
              elevation: 4,
            }}
          >
            <View
              style={{
                position: 'absolute',
                top: 6, left: 6, right: 6, bottom: 6,
                borderRadius: bW * 0.065,
                borderWidth: 1.5,
                borderColor: 'rgba(255,255,255,0.15)',
              }}
            />
          </View>

          {/* middle bill */}
          <View
            style={{
              position: 'absolute',
              top: stackOff * 0.5,
              right: sideSpace - stackOff * 0.5,
              width: bW,
              height: bH,
              backgroundColor: '#166534',
              borderRadius: bW * 0.09,
              transform: [{ rotate: '2.5deg' }],
              shadowColor: '#000',
              shadowOffset: { width: 1, height: 3 },
              shadowOpacity: 0.2,
              shadowRadius: 3,
              elevation: 6,
            }}
          >
            <View
              style={{
                position: 'absolute',
                top: 6, left: 6, right: 6, bottom: 6,
                borderRadius: bW * 0.065,
                borderWidth: 1.5,
                borderColor: 'rgba(255,255,255,0.12)',
              }}
            />
          </View>

          {/* ── FRONT BILL (main face) ── */}
          <LinearGradient
            colors={grad}
            start={{ x: 0.05, y: 0 }}
            end={{ x: 0.95, y: 1 }}
            style={{
              position: 'absolute',
              top: 0,
              left: sideSpace,
              width: bW,
              height: bH,
              borderRadius: bW * 0.09,
              borderWidth: 2,
              borderColor: '#0f3320',
              shadowColor: '#052e16',
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.45,
              shadowRadius: 12,
              elevation: 14,
              overflow: 'hidden',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {/* top-left light reflection (3D effect) */}
            <View
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: bH * 0.36,
                borderTopLeftRadius: bW * 0.09,
                borderTopRightRadius: bW * 0.09,
                backgroundColor: 'rgba(255,255,255,0.18)',
              }}
            />
            {/* bottom shadow */}
            <View
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: bH * 0.22,
                borderBottomLeftRadius: bW * 0.09,
                borderBottomRightRadius: bW * 0.09,
                backgroundColor: 'rgba(0,0,0,0.2)',
              }}
            />
            {/* inner border */}
            <View
              style={{
                position: 'absolute',
                top: 7, left: 7, right: 7, bottom: 7,
                borderRadius: bW * 0.065,
                borderWidth: 1.5,
                borderColor: 'rgba(255,255,255,0.22)',
              }}
            />
            {/* security thread */}
            <View
              style={{
                position: 'absolute',
                left: bW * 0.19,
                top: 0, bottom: 0,
                width: 2,
                backgroundColor: 'rgba(255,255,255,0.14)',
              }}
            />
            {/* corner seals */}
            {([
              { top: 10, left: 10 }, { top: 10, right: 10 },
              { bottom: 10, left: 10 }, { bottom: 10, right: 10 },
            ] as const).map((pos, i) => (
              <View
                key={i}
                style={{
                  position: 'absolute',
                  ...pos,
                  width: bW * 0.115,
                  height: bW * 0.115,
                  borderRadius: bW * 0.058,
                  borderWidth: 1.5,
                  borderColor: 'rgba(255,255,255,0.28)',
                }}
              >
                <View
                  style={{
                    position: 'absolute',
                    top: '20%', left: '20%', right: '20%', bottom: '20%',
                    borderRadius: bW * 0.03,
                    backgroundColor: 'rgba(255,255,255,0.15)',
                  }}
                />
              </View>
            ))}
            {/* serial number bars */}
            <View
              style={{
                position: 'absolute',
                top: 14,
                left: bW * 0.28,
                right: 14,
                height: 5,
                borderRadius: 3,
                backgroundColor: 'rgba(255,255,255,0.13)',
              }}
            />
            <View
              style={{
                position: 'absolute',
                bottom: 14,
                left: 14,
                right: bW * 0.28,
                height: 5,
                borderRadius: 3,
                backgroundColor: 'rgba(255,255,255,0.13)',
              }}
            />
            {/* center oval watermark */}
            <View
              style={{
                position: 'absolute',
                width: bW * 0.72,
                height: bH * 0.5,
                borderRadius: bW * 0.36,
                borderWidth: 1.5,
                borderColor: 'rgba(255,255,255,0.15)',
              }}
            />

            {/* ── FACE ── */}
            <View style={{ alignItems: 'center', zIndex: 10 }}>
              {/* eyebrows */}
              <View
                style={{
                  flexDirection: 'row',
                  gap: eyeW * 0.62,
                  marginBottom: size * 0.04,
                }}
              >
                <Eyebrow w={browW} state={state} side="L" />
                <Eyebrow w={browW} state={state} side="R" />
              </View>
              {/* eyes */}
              <View
                style={{
                  flexDirection: 'row',
                  gap: eyeW * 0.5,
                  marginBottom: size * 0.048,
                }}
              >
                <Eye w={eyeW} h={eyeH} state={state} />
                <Eye w={eyeW} h={eyeH} state={state} />
              </View>
              {/* ₪ watermark (decorative) */}
              <Text
                style={{
                  position: 'absolute',
                  color: 'rgba(20,83,45,0.18)',
                  fontSize: size * 1.2,
                  fontWeight: '900',
                  top: -size * 0.28,
                  letterSpacing: -2,
                  zIndex: -1,
                }}
              >
                ₪
              </Text>
              {/* mouth */}
              <Mouth bw={bW} state={state} />
              {/* cheeks */}
              {state !== 'sleeping' ? (
                <View
                  style={{
                    flexDirection: 'row',
                    gap: bW * 0.44,
                    marginTop: size * 0.028,
                  }}
                >
                  {[0, 1].map(i => (
                    <View
                      key={i}
                      style={{
                        width: size * 0.115,
                        height: size * 0.068,
                        borderRadius: size * 0.034,
                        backgroundColor: '#fda4af',
                        opacity: 0.58,
                      }}
                    />
                  ))}
                </View>
              ) : null}
            </View>
          </LinearGradient>

          {/* ── LEFT ARM (absolute, sticking out left of bill) ── */}
          <Animated.View
            style={[
              {
                position: 'absolute',
                left: 0,
                top: armTop,
              },
              armLStyle,
            ]}
          >
            <Arm w={armW} h={armH} gloveS={gloveS} />
          </Animated.View>

          {/* ── RIGHT ARM (absolute, sticking out right of bill) ── */}
          <Animated.View
            style={[
              {
                position: 'absolute',
                right: 0,
                top: armTop,
              },
              armRStyle,
            ]}
          >
            <Arm w={armW} h={armH} gloveS={gloveS} />
          </Animated.View>
        </View>

        {/* ── LEGS ── */}
        <View
          style={{
            flexDirection: 'row',
            gap: bW * 0.2,
            marginTop: -3,
            paddingHorizontal: sideSpace,
          }}
        >
          {/* left leg */}
          <Animated.View style={[{ alignItems: 'center' }, legLStyle]}>
            <LinearGradient
              colors={['#22c55e', '#166534']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                width: legW,
                height: legH,
                borderRadius: legW / 2,
                borderWidth: 1.5,
                borderColor: '#0f3320',
                marginLeft: shoeS * 0.2,
              }}
            />
            <View style={{ marginTop: -3 }}>
              <Shoe s={shoeS} />
            </View>
          </Animated.View>

          {/* right leg */}
          <Animated.View style={[{ alignItems: 'center' }, legRStyle]}>
            <LinearGradient
              colors={['#22c55e', '#166534']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                width: legW,
                height: legH,
                borderRadius: legW / 2,
                borderWidth: 1.5,
                borderColor: '#0f3320',
                marginRight: shoeS * 0.2,
              }}
            />
            <View style={{ marginTop: -3 }}>
              <Shoe s={shoeS} flip />
            </View>
          </Animated.View>
        </View>

      </Animated.View>

      {/* ── FLOOR SHADOW ── */}
      <View
        style={{
          width: bW * 0.75,
          height: size * 0.055,
          borderRadius: bW * 0.375,
          backgroundColor: 'rgba(0,0,0,0.18)',
          marginTop: 4,
        }}
      />
    </View>
  );
}
