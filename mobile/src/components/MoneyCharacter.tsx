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
  size?: number; // controls the bill width, default 100
}

export function MoneyCharacter({ state, size = 100 }: MoneyCharacterProps) {
  // Dimensions derived from size
  const billW = size;
  const billH = size * 1.2;
  const eyeW = size * 0.18;
  const eyeH = size * 0.22;
  const pupilS = size * 0.1;
  const cheekS = size * 0.1;
  const mouthW = size * 0.35;
  const armW = size * 0.12;
  const armH = size * 0.32;
  const handS = size * 0.16;
  const legW = size * 0.12;
  const legH = size * 0.22;
  const shoeW = size * 0.2;
  const shoeH = size * 0.1;

  // Animation values
  const bodyTranslateY = useSharedValue(0);
  const bodyRotate = useSharedValue(0);
  const bodyScale = useSharedValue(1);
  const armLRotate = useSharedValue(-15);
  const armRRotate = useSharedValue(15);
  const zzzOpacity = useSharedValue(0);
  const zzzY = useSharedValue(0);
  const legLRotate = useSharedValue(0);
  const legRRotate = useSharedValue(0);

  useEffect(() => {
    // Cancel previous and reset
    cancelAnimation(bodyTranslateY);
    cancelAnimation(bodyRotate);
    cancelAnimation(bodyScale);
    cancelAnimation(armLRotate);
    cancelAnimation(armRRotate);
    cancelAnimation(zzzOpacity);
    cancelAnimation(zzzY);
    cancelAnimation(legLRotate);
    cancelAnimation(legRRotate);

    bodyTranslateY.value = 0;
    bodyRotate.value = 0;
    bodyScale.value = 1;
    zzzOpacity.value = 0;
    zzzY.value = 0;
    legLRotate.value = 0;
    legRRotate.value = 0;

    switch (state) {
      case 'idle':
        armLRotate.value = withRepeat(withSequence(
          withTiming(-20, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
          withTiming(-10, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        ), -1, true);
        armRRotate.value = withRepeat(withSequence(
          withTiming(10, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
          withTiming(20, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
        ), -1, true);
        bodyScale.value = withRepeat(withSequence(
          withTiming(1.02, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.99, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        ), -1, false);
        break;

      case 'working':
        bodyTranslateY.value = withRepeat(withSequence(
          withTiming(-12, { duration: 280, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: 280, easing: Easing.in(Easing.quad) }),
        ), -1, false);
        bodyRotate.value = withRepeat(withSequence(
          withTiming(-8, { duration: 280 }),
          withTiming(8, { duration: 280 }),
        ), -1, false);
        armLRotate.value = withRepeat(withSequence(
          withTiming(-90, { duration: 280 }),
          withTiming(-40, { duration: 280 }),
        ), -1, false);
        armRRotate.value = withRepeat(withSequence(
          withTiming(40, { duration: 280 }),
          withTiming(90, { duration: 280 }),
        ), -1, false);
        legLRotate.value = withRepeat(withSequence(
          withTiming(-20, { duration: 280 }),
          withTiming(20, { duration: 280 }),
        ), -1, false);
        legRRotate.value = withRepeat(withSequence(
          withTiming(20, { duration: 280 }),
          withTiming(-20, { duration: 280 }),
        ), -1, false);
        break;

      case 'break':
        armLRotate.value = withRepeat(withSequence(
          withTiming(-45, { duration: 800, easing: Easing.inOut(Easing.ease) }),
          withTiming(-35, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        ), -1, true);
        armRRotate.value = withRepeat(withSequence(
          withTiming(35, { duration: 800, easing: Easing.inOut(Easing.ease) }),
          withTiming(45, { duration: 800, easing: Easing.inOut(Easing.ease) }),
        ), -1, true);
        bodyScale.value = withRepeat(withSequence(
          withTiming(1.01, { duration: 1200 }),
          withTiming(0.99, { duration: 1200 }),
        ), -1, false);
        break;

      case 'done':
        bodyTranslateY.value = withRepeat(withSequence(
          withSpring(-16, { damping: 6, stiffness: 200 }),
          withSpring(0, { damping: 8, stiffness: 160 }),
          withTiming(0, { duration: 400 }),
        ), -1, false);
        armLRotate.value = withRepeat(withSequence(
          withTiming(-120, { duration: 250 }),
          withTiming(-90, { duration: 250 }),
        ), -1, true);
        armRRotate.value = withRepeat(withSequence(
          withTiming(90, { duration: 250 }),
          withTiming(120, { duration: 250 }),
        ), -1, true);
        break;

      case 'sleeping':
        bodyRotate.value = withTiming(15, { duration: 600 });
        bodyScale.value = withRepeat(withSequence(
          withTiming(1.03, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.97, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
        ), -1, false);
        armLRotate.value = withTiming(-5, { duration: 600 });
        armRRotate.value = withTiming(5, { duration: 600 });
        zzzOpacity.value = withRepeat(withSequence(
          withTiming(0, { duration: 0 }),
          withTiming(1, { duration: 500 }),
          withTiming(1, { duration: 800 }),
          withTiming(0, { duration: 500 }),
          withTiming(0, { duration: 300 }),
        ), -1, false);
        zzzY.value = withRepeat(withSequence(
          withTiming(0, { duration: 0 }),
          withTiming(-30, { duration: 1800 }),
          withTiming(0, { duration: 0 }),
          withTiming(0, { duration: 300 }),
        ), -1, false);
        break;
    }
  }, [state]);

  const bodyStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: bodyTranslateY.value },
      { scale: bodyScale.value },
      { rotate: `${bodyRotate.value}deg` },
    ],
  }));

  const armLStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${armLRotate.value}deg` }],
  }));
  const armRStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${armRRotate.value}deg` }],
  }));
  const legLStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${legLRotate.value}deg` }],
  }));
  const legRStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${legRRotate.value}deg` }],
  }));
  const zzzStyle = useAnimatedStyle(() => ({
    opacity: zzzOpacity.value,
    transform: [{ translateY: zzzY.value }],
  }));

  // Eye expression based on state
  const getEyeExpression = () => {
    switch (state) {
      case 'sleeping': return 'closed'; // closed curved lines
      case 'working': return 'wide';    // fully round
      case 'done': return 'wide';
      case 'break': return 'happy';     // slightly squinted happy
      default: return 'normal';
    }
  };

  const getMouthExpression = () => {
    switch (state) {
      case 'sleeping': return 'smile_small';
      case 'working': return 'grin';
      case 'done': return 'grin';
      case 'break': return 'smile_open';
      default: return 'smile';
    }
  };

  const eyeExpr = getEyeExpression();
  const mouthExpr = getMouthExpression();

  const totalW = billW + armW * 2 + 8;
  const totalH = billH + legH + shoeH + 20;

  return (
    <View style={{ width: totalW, height: totalH + 30, alignItems: 'center' }}>
      {/* ZZZ bubble */}
      {state === 'sleeping' ? (
        <Animated.View style={[{ position: 'absolute', top: 0, right: totalW * 0.55, zIndex: 10 }, zzzStyle]}>
          <Text style={{ fontSize: size * 0.14, fontWeight: '900', color: '#818cf8', letterSpacing: 2 }}>ZZZ</Text>
        </Animated.View>
      ) : null}

      {/* State props floating above */}
      {state === 'working' ? (
        <View style={{ position: 'absolute', top: -4, right: 0, zIndex: 10 }}>
          <Text style={{ fontSize: size * 0.22 }}>⏰</Text>
        </View>
      ) : null}

      {/* Main animated body group */}
      <Animated.View style={[{ alignItems: 'center' }, bodyStyle]}>

        {/* State emoji for break - above head */}
        {state === 'break' ? (
          <Text style={{ fontSize: size * 0.22, marginBottom: 2 }}>🍔</Text>
        ) : null}
        {state === 'done' ? (
          <Text style={{ fontSize: size * 0.2, marginBottom: 2 }}>✨</Text>
        ) : null}

        {/* Arms + Bill row */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 4 }}>

          {/* Left arm */}
          <View style={{ alignItems: 'center', marginTop: billH * 0.22 }}>
            <Animated.View style={armLStyle}>
              {/* Arm */}
              <View style={{
                width: armW,
                height: armH,
                backgroundColor: '#15803d',
                borderRadius: armW / 2,
                alignItems: 'center',
                marginRight: 1,
              }} />
              {/* Left glove/hand */}
              <View style={{
                width: handS,
                height: handS,
                borderRadius: handS / 2,
                backgroundColor: '#f0fdf4',
                borderWidth: 1.5,
                borderColor: '#dcfce7',
                marginTop: -4,
                marginLeft: -(handS - armW) / 2,
              }} />
            </Animated.View>
          </View>

          {/* Bill body */}
          <View style={{
            width: billW,
            height: billH,
            backgroundColor: '#16a34a',
            borderRadius: billW * 0.1,
            borderWidth: 2,
            borderColor: '#14532d',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            marginHorizontal: 2,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 6,
            elevation: 8,
          }}>
            {/* Bill inner border decoration */}
            <View style={{
              position: 'absolute',
              top: 6, left: 6, right: 6, bottom: 6,
              borderRadius: billW * 0.07,
              borderWidth: 1.5,
              borderColor: '#15803d',
              opacity: 0.7,
            }} />

            {/* Corner circles (bill texture) */}
            <View style={{
              position: 'absolute',
              top: 10, left: 10,
              width: billW * 0.12,
              height: billW * 0.12,
              borderRadius: billW * 0.06,
              backgroundColor: '#14532d',
              opacity: 0.5,
            }} />
            <View style={{
              position: 'absolute',
              top: 10, right: 10,
              width: billW * 0.12,
              height: billW * 0.12,
              borderRadius: billW * 0.06,
              backgroundColor: '#14532d',
              opacity: 0.5,
            }} />
            <View style={{
              position: 'absolute',
              bottom: 10, left: 10,
              width: billW * 0.12,
              height: billW * 0.12,
              borderRadius: billW * 0.06,
              backgroundColor: '#14532d',
              opacity: 0.5,
            }} />
            <View style={{
              position: 'absolute',
              bottom: 10, right: 10,
              width: billW * 0.12,
              height: billW * 0.12,
              borderRadius: billW * 0.06,
              backgroundColor: '#14532d',
              opacity: 0.5,
            }} />

            {/* Center oval (bill face area - lighter background) */}
            <View style={{
              width: billW * 0.8,
              height: billH * 0.72,
              backgroundColor: '#22c55e',
              borderRadius: billW * 0.15,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: 0.9,
            }}>

              {/* EYES */}
              <View style={{ flexDirection: 'row', gap: billW * 0.1, marginBottom: billH * 0.03 }}>
                {/* Left eye */}
                <View style={{
                  width: eyeW,
                  height: eyeExpr === 'closed' || eyeExpr === 'happy' ? eyeH * 0.35 : eyeH,
                  borderRadius: eyeExpr === 'closed' ? eyeW / 2 : eyeW * 0.5,
                  backgroundColor: eyeExpr === 'closed' ? 'transparent' : 'white',
                  borderBottomWidth: eyeExpr === 'closed' ? 3 : 0,
                  borderColor: eyeExpr === 'closed' ? '#14532d' : 'transparent',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                }}>
                  {eyeExpr !== 'closed' ? (
                    <View style={{
                      width: pupilS,
                      height: pupilS,
                      borderRadius: pupilS / 2,
                      backgroundColor: '#14532d',
                      marginTop: eyeExpr === 'wide' ? 2 : 4,
                    }} />
                  ) : null}
                </View>

                {/* Right eye */}
                <View style={{
                  width: eyeW,
                  height: eyeExpr === 'closed' || eyeExpr === 'happy' ? eyeH * 0.35 : eyeH,
                  borderRadius: eyeExpr === 'closed' ? eyeW / 2 : eyeW * 0.5,
                  backgroundColor: eyeExpr === 'closed' ? 'transparent' : 'white',
                  borderBottomWidth: eyeExpr === 'closed' ? 3 : 0,
                  borderColor: eyeExpr === 'closed' ? '#14532d' : 'transparent',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                }}>
                  {eyeExpr !== 'closed' ? (
                    <View style={{
                      width: pupilS,
                      height: pupilS,
                      borderRadius: pupilS / 2,
                      backgroundColor: '#14532d',
                      marginTop: eyeExpr === 'wide' ? 2 : 4,
                    }} />
                  ) : null}
                </View>
              </View>

              {/* Shekel - small, in center */}
              <Text style={{
                color: '#14532d',
                fontSize: size * 0.13,
                fontWeight: '900',
                opacity: 0.6,
                marginBottom: 2,
              }}>{'₪'}</Text>

              {/* MOUTH */}
              <View style={{
                width: mouthExpr === 'grin' ? mouthW * 1.1 : mouthW,
                height: mouthExpr === 'grin' || mouthExpr === 'smile_open' ? size * 0.12 : size * 0.07,
                borderBottomLeftRadius: mouthW * 0.6,
                borderBottomRightRadius: mouthW * 0.6,
                borderLeftWidth: 2.5,
                borderRightWidth: 2.5,
                borderBottomWidth: 2.5,
                borderTopWidth: 0,
                borderColor: '#14532d',
                backgroundColor: mouthExpr === 'grin' || mouthExpr === 'smile_open' ? 'rgba(20,83,45,0.15)' : 'transparent',
                marginTop: 2,
              }} />

              {/* Cheeks */}
              {state !== 'sleeping' ? (
                <View style={{ flexDirection: 'row', gap: billW * 0.35, position: 'absolute', bottom: billH * 0.04 }}>
                  <View style={{
                    width: cheekS,
                    height: cheekS * 0.6,
                    borderRadius: cheekS / 2,
                    backgroundColor: '#fca5a5',
                    opacity: 0.5,
                  }} />
                  <View style={{
                    width: cheekS,
                    height: cheekS * 0.6,
                    borderRadius: cheekS / 2,
                    backgroundColor: '#fca5a5',
                    opacity: 0.5,
                  }} />
                </View>
              ) : null}
            </View>
          </View>

          {/* Right arm */}
          <View style={{ alignItems: 'center', marginTop: billH * 0.22 }}>
            <Animated.View style={armRStyle}>
              <View style={{
                width: armW,
                height: armH,
                backgroundColor: '#15803d',
                borderRadius: armW / 2,
                marginLeft: 1,
              }} />
              {/* Right glove/hand */}
              <View style={{
                width: handS,
                height: handS,
                borderRadius: handS / 2,
                backgroundColor: '#f0fdf4',
                borderWidth: 1.5,
                borderColor: '#dcfce7',
                marginTop: -4,
                marginLeft: -(handS - armW) / 2,
              }} />
            </Animated.View>
          </View>
        </View>

        {/* Legs row */}
        <View style={{ flexDirection: 'row', gap: billW * 0.25, marginTop: -2 }}>
          {/* Left leg */}
          <Animated.View style={[{ alignItems: 'center' }, legLStyle]}>
            <View style={{
              width: legW,
              height: legH,
              backgroundColor: '#14532d',
              borderRadius: legW / 2,
            }} />
            {/* Left shoe */}
            <View style={{
              width: shoeW,
              height: shoeH,
              backgroundColor: '#1a1a1a',
              borderRadius: shoeH * 0.6,
              marginTop: -2,
              marginLeft: shoeW * 0.1,
            }}>
              {/* Shoe highlight */}
              <View style={{
                position: 'absolute',
                top: 2, left: 4,
                width: shoeW * 0.4,
                height: shoeH * 0.35,
                backgroundColor: 'white',
                borderRadius: shoeH * 0.4,
                opacity: 0.35,
              }} />
            </View>
          </Animated.View>

          {/* Right leg */}
          <Animated.View style={[{ alignItems: 'center' }, legRStyle]}>
            <View style={{
              width: legW,
              height: legH,
              backgroundColor: '#14532d',
              borderRadius: legW / 2,
            }} />
            {/* Right shoe */}
            <View style={{
              width: shoeW,
              height: shoeH,
              backgroundColor: '#1a1a1a',
              borderRadius: shoeH * 0.6,
              marginTop: -2,
              marginLeft: shoeW * 0.1,
            }}>
              <View style={{
                position: 'absolute',
                top: 2, left: 4,
                width: shoeW * 0.4,
                height: shoeH * 0.35,
                backgroundColor: 'white',
                borderRadius: shoeH * 0.4,
                opacity: 0.35,
              }} />
            </View>
          </Animated.View>
        </View>
      </Animated.View>
    </View>
  );
}
