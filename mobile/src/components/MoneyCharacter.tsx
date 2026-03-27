import React, { useEffect } from 'react';
import { View, Text } from 'react-native';
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
  size?: number;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Cartoon eye: white sclera + pupil + highlight */
function Eye({ size, closed, wide }: { size: number; closed?: boolean; wide?: boolean }) {
  const w = size;
  const h = closed ? size * 0.28 : wide ? size * 1.1 : size;
  const pupilS = wide ? size * 0.55 : size * 0.48;

  if (closed) {
    return (
      <View style={{ width: w, height: size * 0.3, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{
          width: w * 0.9,
          height: 3.5,
          borderRadius: 3,
          backgroundColor: '#14532d',
        }} />
        {/* eyelashes */}
        <View style={{ flexDirection: 'row', gap: w * 0.15, marginTop: 1 }}>
          {[0, 1, 2].map(i => (
            <View key={i} style={{
              width: 2,
              height: w * 0.18,
              borderRadius: 2,
              backgroundColor: '#14532d',
              transform: [{ rotate: i === 0 ? '-15deg' : i === 2 ? '15deg' : '0deg' }],
            }} />
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={{
      width: w,
      height: h,
      borderRadius: w * 0.5,
      backgroundColor: 'white',
      borderWidth: 2,
      borderColor: '#1a1a1a',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    }}>
      {/* Pupil */}
      <View style={{
        width: pupilS,
        height: pupilS,
        borderRadius: pupilS / 2,
        backgroundColor: '#111',
        marginTop: wide ? 2 : 3,
      }}>
        {/* White highlight */}
        <View style={{
          position: 'absolute',
          top: pupilS * 0.12,
          right: pupilS * 0.12,
          width: pupilS * 0.32,
          height: pupilS * 0.32,
          borderRadius: pupilS * 0.16,
          backgroundColor: 'white',
        }} />
      </View>
    </View>
  );
}

/** Cartoon mouth */
function Mouth({ width: w, expr }: { width: number; expr: string }) {
  if (expr === 'grin') {
    // Wide open mouth with teeth
    const mH = w * 0.55;
    return (
      <View style={{
        width: w,
        height: mH,
        backgroundColor: '#1a1a1a',
        borderRadius: w * 0.12,
        borderWidth: 2.5,
        borderColor: '#111',
        overflow: 'hidden',
        alignItems: 'center',
      }}>
        {/* Teeth row */}
        <View style={{ flexDirection: 'row', width: w - 6 }}>
          {[0, 1, 2, 3].map(i => (
            <View key={i} style={{
              flex: 1,
              height: mH * 0.42,
              backgroundColor: 'white',
              borderRightWidth: i < 3 ? 1.5 : 0,
              borderColor: '#ddd',
            }} />
          ))}
        </View>
        {/* Tongue */}
        <View style={{
          width: w * 0.38,
          height: mH * 0.32,
          borderRadius: w * 0.19,
          backgroundColor: '#f87171',
          marginTop: 2,
        }} />
      </View>
    );
  }

  if (expr === 'smile_open') {
    // Happy open smile (break/eating)
    const mH = w * 0.4;
    return (
      <View style={{
        width: w,
        height: mH,
        backgroundColor: '#1a1a1a',
        borderRadius: w * 0.5,
        borderWidth: 2.5,
        borderColor: '#111',
        overflow: 'hidden',
        alignItems: 'center',
      }}>
        <View style={{ flexDirection: 'row', width: w - 8 }}>
          {[0, 1, 2].map(i => (
            <View key={i} style={{
              flex: 1,
              height: mH * 0.45,
              backgroundColor: 'white',
              borderRightWidth: i < 2 ? 1.5 : 0,
              borderColor: '#ddd',
            }} />
          ))}
        </View>
      </View>
    );
  }

  if (expr === 'smile_small') {
    // Tiny relaxed smile (sleeping/done)
    return (
      <View style={{
        width: w * 0.7,
        height: w * 0.25,
        borderBottomLeftRadius: w * 0.35,
        borderBottomRightRadius: w * 0.35,
        borderLeftWidth: 2.5,
        borderRightWidth: 2.5,
        borderBottomWidth: 2.5,
        borderTopWidth: 0,
        borderColor: '#14532d',
      }} />
    );
  }

  // Default: normal smile
  return (
    <View style={{
      width: w * 0.85,
      height: w * 0.35,
      borderBottomLeftRadius: w * 0.43,
      borderBottomRightRadius: w * 0.43,
      borderLeftWidth: 2.5,
      borderRightWidth: 2.5,
      borderBottomWidth: 2.5,
      borderTopWidth: 0,
      borderColor: '#14532d',
    }} />
  );
}

/** Cartoon shoe */
function Shoe({ size, flip }: { size: number; flip?: boolean }) {
  return (
    <View style={{
      width: size,
      height: size * 0.46,
      transform: flip ? [{ scaleX: -1 }] : [],
    }}>
      {/* Main shoe body */}
      <View style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        width: size,
        height: size * 0.36,
        backgroundColor: '#1a1a1a',
        borderRadius: size * 0.1,
        borderTopRightRadius: size * 0.22,
      }} />
      {/* White sole */}
      <View style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        width: size,
        height: size * 0.12,
        backgroundColor: '#f0f0f0',
        borderRadius: size * 0.06,
      }} />
      {/* Tongue/laces area */}
      <View style={{
        position: 'absolute',
        bottom: size * 0.14,
        left: size * 0.45,
        width: size * 0.35,
        height: size * 0.18,
        backgroundColor: '#f0f0f0',
        borderRadius: size * 0.04,
      }} />
    </View>
  );
}

/** White glove */
function Glove({ size }: { size: number }) {
  return (
    <View style={{
      width: size,
      height: size,
      borderRadius: size / 2,
      backgroundColor: 'white',
      borderWidth: 1.5,
      borderColor: '#e5e7eb',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.15,
      shadowRadius: 2,
      elevation: 2,
    }} />
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function MoneyCharacter({ state, size = 110 }: MoneyCharacterProps) {
  const billW = size;
  const billH = size * 1.18;
  const eyeS = size * 0.19;
  const mouthW = size * 0.44;
  const armW = size * 0.11;
  const armH = size * 0.28;
  const gloveS = size * 0.18;
  const legW = size * 0.115;
  const legH = size * 0.2;
  const shoeS = size * 0.26;

  // Shared animation values
  const bodyY = useSharedValue(0);
  const bodyRot = useSharedValue(0);
  const bodyScale = useSharedValue(1);
  const armLRot = useSharedValue(-15);
  const armRRot = useSharedValue(15);
  const legLRot = useSharedValue(0);
  const legRRot = useSharedValue(0);
  const zzzOpacity = useSharedValue(0);
  const zzzY = useSharedValue(0);

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

    bodyY.value = 0;
    bodyRot.value = 0;
    bodyScale.value = 1;
    legLRot.value = 0;
    legRRot.value = 0;
    zzzOpacity.value = 0;
    zzzY.value = 0;

    switch (state) {
      case 'idle':
        bodyScale.value = withRepeat(withSequence(
          withTiming(1.025, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
          withTiming(0.985, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
        ), -1, false);
        armLRot.value = withRepeat(withSequence(
          withTiming(-22, { duration: 1600, easing: Easing.inOut(Easing.ease) }),
          withTiming(-8, { duration: 1600, easing: Easing.inOut(Easing.ease) }),
        ), -1, true);
        armRRot.value = withRepeat(withSequence(
          withTiming(8, { duration: 1600, easing: Easing.inOut(Easing.ease) }),
          withTiming(22, { duration: 1600, easing: Easing.inOut(Easing.ease) }),
        ), -1, true);
        break;

      case 'working':
        bodyY.value = withRepeat(withSequence(
          withTiming(-14, { duration: 260, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: 260, easing: Easing.in(Easing.quad) }),
        ), -1, false);
        bodyRot.value = withRepeat(withSequence(
          withTiming(-7, { duration: 260 }),
          withTiming(7, { duration: 260 }),
        ), -1, false);
        armLRot.value = withRepeat(withSequence(
          withTiming(-110, { duration: 260 }),
          withTiming(-50, { duration: 260 }),
        ), -1, false);
        armRRot.value = withRepeat(withSequence(
          withTiming(50, { duration: 260 }),
          withTiming(110, { duration: 260 }),
        ), -1, false);
        legLRot.value = withRepeat(withSequence(
          withTiming(-28, { duration: 260 }),
          withTiming(28, { duration: 260 }),
        ), -1, false);
        legRRot.value = withRepeat(withSequence(
          withTiming(28, { duration: 260 }),
          withTiming(-28, { duration: 260 }),
        ), -1, false);
        break;

      case 'break':
        bodyScale.value = withRepeat(withSequence(
          withTiming(1.015, { duration: 1200 }),
          withTiming(0.99, { duration: 1200 }),
        ), -1, false);
        armLRot.value = withRepeat(withSequence(
          withTiming(-55, { duration: 900, easing: Easing.inOut(Easing.ease) }),
          withTiming(-40, { duration: 900, easing: Easing.inOut(Easing.ease) }),
        ), -1, true);
        armRRot.value = withRepeat(withSequence(
          withTiming(40, { duration: 900, easing: Easing.inOut(Easing.ease) }),
          withTiming(55, { duration: 900, easing: Easing.inOut(Easing.ease) }),
        ), -1, true);
        break;

      case 'done':
        bodyY.value = withRepeat(withSequence(
          withSpring(-18, { damping: 5, stiffness: 220 }),
          withSpring(0, { damping: 9, stiffness: 180 }),
          withTiming(0, { duration: 350 }),
        ), -1, false);
        armLRot.value = withRepeat(withSequence(
          withTiming(-130, { duration: 220 }),
          withTiming(-100, { duration: 220 }),
        ), -1, true);
        armRRot.value = withRepeat(withSequence(
          withTiming(100, { duration: 220 }),
          withTiming(130, { duration: 220 }),
        ), -1, true);
        break;

      case 'sleeping':
        bodyRot.value = withTiming(14, { duration: 700 });
        bodyScale.value = withRepeat(withSequence(
          withTiming(1.04, { duration: 2800, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.97, { duration: 2800, easing: Easing.inOut(Easing.ease) }),
        ), -1, false);
        armLRot.value = withTiming(-8, { duration: 700 });
        armRRot.value = withTiming(8, { duration: 700 });
        zzzOpacity.value = withRepeat(withSequence(
          withTiming(0, { duration: 0 }),
          withTiming(1, { duration: 450 }),
          withTiming(1, { duration: 700 }),
          withTiming(0, { duration: 450 }),
          withTiming(0, { duration: 300 }),
        ), -1, false);
        zzzY.value = withRepeat(withSequence(
          withTiming(0, { duration: 0 }),
          withTiming(-28, { duration: 1600 }),
          withTiming(0, { duration: 0 }),
          withTiming(0, { duration: 300 }),
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
    transformOrigin: 'top center',
  }));
  const armRStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${armRRot.value}deg` }],
    transformOrigin: 'top center',
  }));
  const legLStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${legLRot.value}deg` }],
    transformOrigin: 'top center',
  }));
  const legRStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${legRRot.value}deg` }],
    transformOrigin: 'top center',
  }));
  const zzzStyle = useAnimatedStyle(() => ({
    opacity: zzzOpacity.value,
    transform: [{ translateY: zzzY.value }],
  }));

  const eyeClosed = state === 'sleeping' || state === 'done';
  const eyeWide = state === 'working';
  const mouthExpr =
    state === 'working' ? 'grin' :
    state === 'break' ? 'smile_open' :
    (state === 'sleeping' || state === 'done') ? 'smile_small' :
    'smile';

  const totalW = billW + (armW + gloveS) * 2 + 16;
  const totalH = billH + legH + shoeS * 0.46 + 36;

  return (
    <View style={{ width: totalW, height: totalH, alignItems: 'center' }}>

      {/* ZZZ */}
      {state === 'sleeping' ? (
        <Animated.View style={[{
          position: 'absolute',
          top: 2,
          right: totalW * 0.52,
          zIndex: 20,
        }, zzzStyle]}>
          <Text style={{ fontSize: size * 0.155, fontWeight: '900', color: '#818cf8', letterSpacing: 1 }}>ZZZ</Text>
        </Animated.View>
      ) : null}

      {/* ⏰ for working - upper right */}
      {state === 'working' ? (
        <View style={{ position: 'absolute', top: 2, right: 2, zIndex: 20 }}>
          <Text style={{ fontSize: size * 0.24 }}>⏰</Text>
        </View>
      ) : null}

      {/* ✨ for done */}
      {state === 'done' ? (
        <View style={{ position: 'absolute', top: 2, left: 4, zIndex: 20 }}>
          <Text style={{ fontSize: size * 0.2 }}>✨</Text>
        </View>
      ) : null}

      <Animated.View style={[{ alignItems: 'center' }, bodyStyle]}>

        {/* Cap (break state) */}
        {state === 'break' ? (
          <View style={{ alignItems: 'center', marginBottom: -6, zIndex: 10 }}>
            {/* Brim */}
            <View style={{
              width: billW * 0.72,
              height: size * 0.065,
              backgroundColor: '#dc2626',
              borderRadius: size * 0.033,
              marginBottom: -2,
              marginLeft: billW * 0.06,
            }} />
            {/* Body */}
            <View style={{
              width: billW * 0.58,
              height: size * 0.14,
              backgroundColor: '#dc2626',
              borderTopLeftRadius: billW * 0.29,
              borderTopRightRadius: billW * 0.29,
              borderBottomLeftRadius: 4,
              borderBottomRightRadius: 4,
            }}>
              {/* Logo dot */}
              <View style={{
                position: 'absolute',
                top: '40%',
                left: '50%',
                width: size * 0.055,
                height: size * 0.055,
                borderRadius: size * 0.028,
                backgroundColor: 'white',
                transform: [{ translateX: -size * 0.028 }, { translateY: -size * 0.028 }],
              }} />
            </View>
          </View>
        ) : null}

        {/* 🍔 burger above for break */}
        {state === 'break' ? (
          <Text style={{ fontSize: size * 0.26, marginBottom: 2, zIndex: 5 }}>🍔</Text>
        ) : null}

        {/* ── ARMS + BILL ROW ── */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>

          {/* LEFT ARM */}
          <View style={{ marginTop: billH * 0.28, alignItems: 'center' }}>
            <Animated.View style={armLStyle}>
              <View style={{
                width: armW,
                height: armH,
                backgroundColor: '#166534',
                borderRadius: armW / 2,
                shadowColor: '#000',
                shadowOffset: { width: 1, height: 1 },
                shadowOpacity: 0.2,
                shadowRadius: 2,
              }} />
              <View style={{ marginTop: -3, marginLeft: -(gloveS - armW) / 2 }}>
                <Glove size={gloveS} />
              </View>
            </Animated.View>
          </View>

          {/* ── BILL BODY ── */}
          <View style={{
            width: billW,
            height: billH,
            backgroundColor: '#22c55e',
            borderRadius: billW * 0.09,
            borderWidth: 2.5,
            borderColor: '#15803d',
            alignItems: 'center',
            justifyContent: 'center',
            marginHorizontal: 3,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 5 },
            shadowOpacity: 0.25,
            shadowRadius: 8,
            elevation: 10,
            overflow: 'hidden',
          }}>

            {/* Bill inner frame */}
            <View style={{
              position: 'absolute',
              top: 7, left: 7, right: 7, bottom: 7,
              borderRadius: billW * 0.065,
              borderWidth: 1.5,
              borderColor: '#16a34a',
            }} />

            {/* Corner watermark circles */}
            {([
              { top: 11, left: 11 },
              { top: 11, right: 11 },
              { bottom: 11, left: 11 },
              { bottom: 11, right: 11 },
            ] as const).map((pos, i) => (
              <View key={i} style={{
                position: 'absolute',
                ...pos,
                width: billW * 0.1,
                height: billW * 0.1,
                borderRadius: billW * 0.05,
                borderWidth: 1.5,
                borderColor: '#16a34a',
              }} />
            ))}

            {/* Center decorative oval */}
            <View style={{
              width: billW * 0.65,
              height: billH * 0.42,
              borderRadius: billW * 0.325,
              borderWidth: 1.5,
              borderColor: '#16a34a',
              position: 'absolute',
            }} />

            {/* ── FACE ── */}
            <View style={{ alignItems: 'center', zIndex: 5 }}>

              {/* EYES */}
              <View style={{
                flexDirection: 'row',
                gap: eyeS * 0.8,
                marginBottom: size * 0.055,
              }}>
                <Eye size={eyeS} closed={eyeClosed} wide={eyeWide} />
                <Eye size={eyeS} closed={eyeClosed} wide={eyeWide} />
              </View>

              {/* ₪ symbol */}
              <Text style={{
                color: '#14532d',
                fontSize: size * 0.11,
                fontWeight: '900',
                opacity: 0.45,
                marginBottom: size * 0.035,
                letterSpacing: -0.5,
              }}>₪</Text>

              {/* MOUTH */}
              <Mouth width={mouthW} expr={mouthExpr} />

              {/* Rosy cheeks */}
              {state !== 'sleeping' ? (
                <View style={{
                  flexDirection: 'row',
                  gap: mouthW * 1.05,
                  marginTop: size * 0.025,
                }}>
                  <View style={{
                    width: size * 0.1,
                    height: size * 0.065,
                    borderRadius: size * 0.033,
                    backgroundColor: '#fda4af',
                    opacity: 0.55,
                  }} />
                  <View style={{
                    width: size * 0.1,
                    height: size * 0.065,
                    borderRadius: size * 0.033,
                    backgroundColor: '#fda4af',
                    opacity: 0.55,
                  }} />
                </View>
              ) : null}
            </View>
          </View>

          {/* RIGHT ARM */}
          <View style={{ marginTop: billH * 0.28, alignItems: 'center' }}>
            <Animated.View style={armRStyle}>
              <View style={{
                width: armW,
                height: armH,
                backgroundColor: '#166534',
                borderRadius: armW / 2,
                shadowColor: '#000',
                shadowOffset: { width: -1, height: 1 },
                shadowOpacity: 0.2,
                shadowRadius: 2,
              }} />
              <View style={{ marginTop: -3, marginLeft: -(gloveS - armW) / 2 }}>
                <Glove size={gloveS} />
              </View>
            </Animated.View>
          </View>
        </View>

        {/* ── LEGS ── */}
        <View style={{
          flexDirection: 'row',
          gap: billW * 0.22,
          marginTop: -3,
          paddingHorizontal: armW + gloveS + 6,
        }}>
          {/* Left leg */}
          <Animated.View style={[{ alignItems: 'flex-end' }, legLStyle]}>
            <View style={{
              width: legW,
              height: legH,
              backgroundColor: '#166534',
              borderRadius: legW / 2,
              marginLeft: shoeS * 0.3,
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
              marginRight: shoeS * 0.3,
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
