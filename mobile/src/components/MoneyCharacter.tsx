import React, { useEffect } from 'react';
import { Image } from 'react-native';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withTiming, withSequence, withRepeat,
  Easing,
} from 'react-native-reanimated';

export type MoneyCharacterState = 'idle' | 'working' | 'break' | 'done' | 'sleeping';

interface MoneyCharacterProps {
  state?: MoneyCharacterState;
  size?: number;
}

const mascotMap = {
  idle:   require('../../assets/images/mascot/mascot_idle.png'),
  active: require('../../assets/images/mascot/mascot_active.png'),
  break:  require('../../assets/images/mascot/mascot_break.png'),
  done:   require('../../assets/images/mascot/mascot_done.png'),
};

export default function MoneyCharacter({ state = 'idle', size = 140 }: MoneyCharacterProps) {
  // Map app states → asset keys
  const key = state === 'working' ? 'active' : state === 'sleeping' ? 'done' : state;

  // ── Float animation (gentle bob) ──────────────────────────────────────────
  const floatY = useSharedValue(0);
  useEffect(() => {
    floatY.value = withRepeat(
      withSequence(
        withTiming(-6, { duration: 2000, easing: Easing.inOut(Easing.sin) }),
        withTiming(0,  { duration: 2000, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
  }, []);

  // ── State-change pop animation ────────────────────────────────────────────
  const scale   = useSharedValue(1);
  const opacity = useSharedValue(1);
  useEffect(() => {
    opacity.value = 0;
    scale.value   = 0.88;
    opacity.value = withTiming(1,   { duration: 260, easing: Easing.out(Easing.quad) });
    scale.value   = withTiming(1,   { duration: 280, easing: Easing.out(Easing.back(1.4)) });
  }, [key]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: floatY.value },
      { scale: scale.value },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={animStyle}>
      <Image
        source={mascotMap[key as keyof typeof mascotMap]}
        style={{ width: size, height: size }}
        resizeMode="contain"
      />
    </Animated.View>
  );
}
