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
} from 'react-native-reanimated';

export type MoneyCharacterState = 'idle' | 'working' | 'break' | 'done' | 'sleeping';

interface MoneyCharacterProps {
  state: MoneyCharacterState;
  size?: number;
}

export function MoneyCharacter({ state, size = 80 }: MoneyCharacterProps) {
  const scale = useSharedValue(1);
  const translateY = useSharedValue(0);
  const rotate = useSharedValue(0);
  const eyeBlink = useSharedValue(1);
  const armLeftRotate = useSharedValue(0);
  const armRightRotate = useSharedValue(0);
  const zzzOpacity = useSharedValue(0);
  const zzzTranslateY = useSharedValue(0);

  const bodySize = size;
  const eyeSize = Math.max(4, bodySize * 0.075);
  const armWidth = Math.max(3, bodySize * 0.07);
  const armHeight = Math.max(16, bodySize * 0.28);
  const legWidth = Math.max(3, bodySize * 0.07);
  const legHeight = Math.max(12, bodySize * 0.22);

  useEffect(() => {
    // Reset all values
    scale.value = 1;
    translateY.value = 0;
    rotate.value = 0;
    armLeftRotate.value = 0;
    armRightRotate.value = 0;
    zzzOpacity.value = 0;
    zzzTranslateY.value = 0;

    // Blink loop — common to all states
    eyeBlink.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2500 }),
        withTiming(0.05, { duration: 80 }),
        withTiming(1, { duration: 80 }),
      ),
      -1,
      false
    );

    if (state === 'idle') {
      // Gentle breathing
      scale.value = withRepeat(
        withSequence(
          withTiming(1.03, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.98, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false
      );
    } else if (state === 'working') {
      // Energetic bouncing
      translateY.value = withRepeat(
        withSequence(
          withTiming(-10, { duration: 350, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: 350, easing: Easing.in(Easing.quad) }),
        ),
        -1,
        false
      );
      armLeftRotate.value = withRepeat(
        withSequence(
          withTiming(-30, { duration: 350 }),
          withTiming(30, { duration: 350 }),
        ),
        -1,
        true
      );
      armRightRotate.value = withRepeat(
        withSequence(
          withTiming(30, { duration: 350 }),
          withTiming(-30, { duration: 350 }),
        ),
        -1,
        true
      );
    } else if (state === 'break') {
      // Gentle side-to-side sway
      rotate.value = withRepeat(
        withSequence(
          withTiming(-8, { duration: 700, easing: Easing.inOut(Easing.ease) }),
          withTiming(8, { duration: 700, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false
      );
      armLeftRotate.value = withRepeat(
        withSequence(
          withTiming(-20, { duration: 700 }),
          withTiming(20, { duration: 700 }),
        ),
        -1,
        true
      );
    } else if (state === 'done') {
      // Happy jump
      translateY.value = withRepeat(
        withSequence(
          withSpring(-14, { damping: 8, stiffness: 180 }),
          withSpring(0, { damping: 10, stiffness: 160 }),
          withTiming(0, { duration: 600 }),
        ),
        -1,
        false
      );
      armLeftRotate.value = withRepeat(
        withSequence(
          withTiming(-60, { duration: 200 }),
          withTiming(-20, { duration: 400 }),
        ),
        -1,
        true
      );
      armRightRotate.value = withRepeat(
        withSequence(
          withTiming(60, { duration: 200 }),
          withTiming(20, { duration: 400 }),
        ),
        -1,
        true
      );
    } else if (state === 'sleeping') {
      // Slow breathing
      scale.value = withRepeat(
        withSequence(
          withTiming(1.04, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.97, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
        false
      );
      // Tilted
      rotate.value = withTiming(12, { duration: 500 });
      // ZZZ float up and fade
      zzzOpacity.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 600 }),
          withTiming(0, { duration: 1200 }),
          withTiming(0, { duration: 400 }),
        ),
        -1,
        false
      );
      zzzTranslateY.value = withRepeat(
        withSequence(
          withTiming(-24, { duration: 1800 }),
          withTiming(0, { duration: 0 }),
        ),
        -1,
        false
      );
    }
  }, [state]);

  const bodyStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { scale: scale.value },
      { rotate: `${rotate.value}deg` },
    ],
  }));

  const eyeStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: eyeBlink.value }],
  }));

  const armLeftStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${armLeftRotate.value}deg` }],
  }));

  const armRightStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${armRightRotate.value}deg` }],
  }));

  const zzzStyle = useAnimatedStyle(() => ({
    opacity: zzzOpacity.value,
    transform: [{ translateY: zzzTranslateY.value }],
  }));

  const billWidth = bodySize;
  const billHeight = bodySize * 1.15;

  const billColors = {
    idle: { bg: '#1A3A2E', border: '#22C55E', shadow: '#22C55E' },
    working: { bg: '#1A2E3A', border: '#3B82F6', shadow: '#3B82F6' },
    break: { bg: '#2E2A1A', border: '#F59E0B', shadow: '#F59E0B' },
    done: { bg: '#1A3A28', border: '#34D399', shadow: '#34D399' },
    sleeping: { bg: '#1A1A2E', border: '#818CF8', shadow: '#818CF8' },
  };

  const colors = billColors[state];

  const eyeColor = state === 'sleeping' ? '#818CF8' : '#22C55E';
  const shekelColor = state === 'working' ? '#60A5FA' : state === 'sleeping' ? '#A78BFA' : '#34D399';

  return (
    <View style={{ alignItems: 'center', justifyContent: 'center', width: billWidth + armWidth * 3, height: billHeight + legHeight + 8 }}>
      {/* ZZZ for sleeping */}
      {state === 'sleeping' ? (
        <Animated.View
          style={[
            {
              position: 'absolute',
              top: -8,
              right: 0,
              zIndex: 10,
            },
            zzzStyle,
          ]}
        >
          <Text style={{ color: '#818CF8', fontSize: 14, fontWeight: '800' }}>{'zzz'}</Text>
        </Animated.View>
      ) : null}

      {/* Body wrapper with arms */}
      <Animated.View style={[{ alignItems: 'center' }, bodyStyle]}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {/* Left arm */}
          <Animated.View
            style={[
              {
                width: armWidth,
                height: armHeight,
                backgroundColor: colors.border,
                borderRadius: armWidth / 2,
                marginRight: 2,
                transformOrigin: 'top',
              },
              armLeftStyle,
            ]}
          />

          {/* Bill body */}
          <View
            style={{
              width: billWidth,
              height: billHeight,
              backgroundColor: colors.bg,
              borderRadius: 12,
              borderWidth: 2,
              borderColor: colors.border,
              alignItems: 'center',
              justifyContent: 'center',
              shadowColor: colors.shadow,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.5,
              shadowRadius: 8,
              elevation: 6,
              overflow: 'hidden',
            }}
          >
            {/* Corner decoration */}
            <View style={{
              position: 'absolute',
              top: 5,
              left: 5,
              width: 10,
              height: 10,
              borderRadius: 5,
              backgroundColor: colors.border,
              opacity: 0.4,
            }} />
            <View style={{
              position: 'absolute',
              top: 5,
              right: 5,
              width: 10,
              height: 10,
              borderRadius: 5,
              backgroundColor: colors.border,
              opacity: 0.4,
            }} />

            {/* Eyes */}
            <Animated.View
              style={[
                {
                  flexDirection: 'row',
                  gap: eyeSize * 2.2,
                  marginBottom: eyeSize * 0.8,
                },
                eyeStyle,
              ]}
            >
              <View style={{
                width: eyeSize,
                height: eyeSize,
                borderRadius: eyeSize / 2,
                backgroundColor: eyeColor,
              }} />
              <View style={{
                width: eyeSize,
                height: eyeSize,
                borderRadius: eyeSize / 2,
                backgroundColor: eyeColor,
              }} />
            </Animated.View>

            {/* Shekel symbol */}
            <Text style={{
              color: shekelColor,
              fontSize: bodySize * 0.38,
              fontWeight: '900',
              lineHeight: bodySize * 0.44,
            }}>
              {'₪'}
            </Text>

            {/* Mouth */}
            <View style={{
              width: bodySize * 0.3,
              height: bodySize * 0.05,
              borderRadius: bodySize * 0.03,
              backgroundColor: state === 'done' ? '#34D399' : colors.border,
              marginTop: eyeSize * 0.6,
              opacity: 0.7,
            }} />
          </View>

          {/* Right arm */}
          <Animated.View
            style={[
              {
                width: armWidth,
                height: armHeight,
                backgroundColor: colors.border,
                borderRadius: armWidth / 2,
                marginLeft: 2,
                transformOrigin: 'top',
              },
              armRightStyle,
            ]}
          />
        </View>

        {/* Legs */}
        <View style={{ flexDirection: 'row', gap: billWidth * 0.22, marginTop: 2 }}>
          <View style={{
            width: legWidth,
            height: legHeight,
            backgroundColor: colors.border,
            borderRadius: legWidth / 2,
            opacity: 0.8,
          }} />
          <View style={{
            width: legWidth,
            height: legHeight,
            backgroundColor: colors.border,
            borderRadius: legWidth / 2,
            opacity: 0.8,
          }} />
        </View>
      </Animated.View>
    </View>
  );
}
