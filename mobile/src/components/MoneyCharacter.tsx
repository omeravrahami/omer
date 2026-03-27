import React, { useEffect } from 'react';
import { View } from 'react-native';
import Svg, {
  Defs, G, Rect, Circle, Ellipse, Path,
  LinearGradient, RadialGradient, Stop,
  ClipPath, Filter,
  FeDropShadow, FeGaussianBlur, FeColorMatrix,
} from 'react-native-svg';
import Animated, {
  useSharedValue, useAnimatedStyle,
  withRepeat, withSequence, withTiming,
  Easing,
} from 'react-native-reanimated';

export type MoneyCharacterState = 'idle' | 'working' | 'break' | 'done' | 'sleeping';

interface MoneyCharacterProps {
  state?: MoneyCharacterState;
  size?: number;
}

export default function MoneyCharacter({ state = 'idle', size = 180 }: MoneyCharacterProps) {
  // Map app states → mascot states
  const ms = state === 'working' ? 'active' : state === 'sleeping' ? 'done' : state;
  const isIdle   = ms === 'idle';
  const isActive = ms === 'active';
  const isBreak  = ms === 'break';
  const isDone   = ms === 'done';

  // ── Subtle float animation ─────────────────────────────────────────────────
  const floatY = useSharedValue(0);
  useEffect(() => {
    floatY.value = withRepeat(
      withSequence(
        withTiming(-5, { duration: 1900, easing: Easing.inOut(Easing.sin) }),
        withTiming(0,  { duration: 1900, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
  }, []);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ translateY: floatY.value }] }));

  // ── Expression paths (unchanged from source) ───────────────────────────────
  const eyebrowLeft = isActive
    ? 'M92 92 C100 82, 112 82, 120 88'
    : isDone
    ? 'M92 96 C101 92, 111 92, 120 95'
    : isBreak
    ? 'M92 95 C100 90, 110 90, 120 94'
    : 'M92 98 C100 94, 110 94, 120 97';

  const eyebrowRight = isActive
    ? 'M146 88 C154 82, 166 82, 174 92'
    : isDone
    ? 'M146 95 C155 92, 165 92, 174 96'
    : isBreak
    ? 'M146 94 C154 90, 164 90, 174 95'
    : 'M146 97 C154 94, 164 94, 174 98';

  const mouthPath = isActive
    ? 'M113 145 C124 159, 143 159, 154 145 C149 166, 118 166, 113 145 Z'
    : isDone
    ? 'M116 149 C126 157, 142 157, 151 149'
    : isBreak
    ? 'M117 149 C127 155, 141 155, 150 149'
    : 'M118 148 C127 154, 141 154, 149 148';

  const eyeRY    = isDone ? 0.25 : isIdle ? 0.82 : 1;
  const bodyRot  = isActive ? -10 : isBreak ? -3 : isDone ? -8 : -2;
  const bodyTY   = isActive ? -8  : isDone  ?  4 : 0;
  const armRaise = isActive ? -12 : isBreak ?  6 : isDone ? 10 : 0;
  const legLift  = isActive ? -8  : 0;

  const leftArmPath  = isActive ? 'M0 0 C-8 -10,-16 -25,-12 -42'
    : isBreak ? 'M0 0 C-4 8,-8 16,-6 30'
    : isDone  ? 'M0 0 C-3 14,-7 28,-5 42'
    :           'M0 0 C-5 2,-9 10,-10 20';
  const leftHandX  = isActive ? -10 : isBreak ? -8  : isDone ? -6  : -10;
  const leftHandY  = isActive ? -44 : isBreak ?  32 : isDone ? 45  :  24;

  const rightArmPath = isActive ? 'M0 0 C10 -8,18 -22,18 -40'
    : isBreak ? 'M0 0 C6 7,12 15,13 26'
    : isDone  ? 'M0 0 C4 14,8 28,7 42'
    :           'M0 0 C5 3,9 10,11 22';
  const rightHandX = isActive ? 18  : isBreak ? 14 : isDone ? 9  : 12;
  const rightHandY = isActive ? -42 : isBreak ? 28 : isDone ? 45 : 26;

  return (
    <Animated.View style={[{ width: size, height: size }, animStyle]}>
      <Svg viewBox="0 0 320 320" width={size} height={size}>
        <Defs>
          <LinearGradient id="mc_billFront" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%"   stopColor="#7EF27C" />
            <Stop offset="45%"  stopColor="#43D85F" />
            <Stop offset="100%" stopColor="#149B39" />
          </LinearGradient>
          <LinearGradient id="mc_billMid" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%"   stopColor="#34C759" />
            <Stop offset="100%" stopColor="#0E6F2B" />
          </LinearGradient>
          <LinearGradient id="mc_billBack" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%"   stopColor="#1D9C40" />
            <Stop offset="100%" stopColor="#0B4F21" />
          </LinearGradient>
          <LinearGradient id="mc_limbGreen" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%"   stopColor="#1AAF3F" />
            <Stop offset="100%" stopColor="#0A5C26" />
          </LinearGradient>
          <LinearGradient id="mc_shoeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%"   stopColor="#303744" />
            <Stop offset="100%" stopColor="#111827" />
          </LinearGradient>
          <Filter id="mc_softShadow" x="-40%" y="-40%" width="180%" height="180%">
            <FeDropShadow dx={0} dy={10} stdDeviation={12} floodColor="#00122B" floodOpacity={0.25} />
          </Filter>
          <Filter id="mc_billGlow" x="-50%" y="-50%" width="200%" height="200%">
            <FeGaussianBlur stdDeviation={10} result="blur" />
            <FeColorMatrix in="blur" type="matrix" values="0 0 0 0 0.12  0 0 0 0 0.95  0 0 0 0 0.35  0 0 0 0.22 0" />
          </Filter>
          <RadialGradient id="mc_faceLight" cx="35%" cy="25%" r="80%">
            <Stop offset="0%"   stopColor="rgba(255,255,255,0.28)" />
            <Stop offset="100%" stopColor="rgba(255,255,255,0)" />
          </RadialGradient>
          <ClipPath id="mc_billClip">
            <Rect x={78} y={72} rx={26} ry={26} width={138} height={176} />
          </ClipPath>
        </Defs>

        {/* ground shadow */}
        <Ellipse cx={160} cy={isDone ? 266 : 272} rx={74} ry={18} fill="rgba(3,12,34,0.18)" />

        {/* break props: burger + drink */}
        {isBreak ? (
          <>
            <G transform="translate(58 185)">
              <Ellipse cx={0} cy={42} rx={38} ry={10} fill="rgba(3,12,34,0.14)" />
              <Path d="M-34 0 C-36 -14,-12 -28,14 -18 C31 -11,40 9,28 25 C20 35,4 39,-12 38 C-28 37,-39 22,-34 0 Z" fill="#F4A632" stroke="#B36816" strokeWidth={4} />
              <Path d="M-20 6 C-10 -10,8 -13,22 0"   fill="none" stroke="#7A1F1F" strokeWidth={8} strokeLinecap="round" />
              <Path d="M-16 0 C-2 -18,20 -16,30 0"   fill="none" stroke="#2EA043" strokeWidth={8} strokeLinecap="round" />
              <Path d="M-26 -3 C-10 -20,14 -20,32 -3" fill="none" stroke="#F7D774" strokeWidth={8} strokeLinecap="round" />
            </G>
            <G transform="translate(240 162)">
              <Ellipse cx={0} cy={54} rx={20} ry={5} fill="rgba(0,0,0,0.10)" />
              <Path d="M-15 0 H15 L11 44 H-11 Z" fill="#FF7A29" stroke="#D85815" strokeWidth={4} strokeLinejoin="round" />
              <Path d="M4 -14 L16 -34" stroke="#E53935" strokeWidth={5} strokeLinecap="round" />
            </G>
          </>
        ) : null}

        {/* done prop: checkmark badge */}
        {isDone ? (
          <G transform="translate(236 78)">
            <Circle cx={0} cy={0} r={22} fill="#F4A21D" opacity={0.92} />
            <Path d="M-8 1 L-1 8 L10 -8" fill="none" stroke="#fff" strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />
          </G>
        ) : null}

        {/* body group */}
        <G transform={`translate(0 ${bodyTY}) rotate(${bodyRot} 160 160)`}>

          {/* ambient glow behind bill */}
          <Rect x={82} y={76} rx={28} ry={28} width={136} height={172} fill="#58F26E" opacity={0.18} filter="url(#mc_billGlow)" />

          {/* bill stack — back two bills */}
          <G filter="url(#mc_softShadow)">
            <Rect x={100} y={82} rx={24} ry={24} width={116} height={160} fill="url(#mc_billBack)" rotation={8} originX={158} originY={162} />
            <Rect x={90}  y={78} rx={24} ry={24} width={124} height={166} fill="url(#mc_billMid)"  rotation={4} originX={152} originY={161} />
          </G>

          {/* front bill face */}
          <G filter="url(#mc_softShadow)">
            <Rect x={78} y={72} rx={26} ry={26} width={138} height={176} fill="url(#mc_billFront)" />
            <Rect x={86} y={80} rx={22} ry={22} width={122} height={160} fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth={3} />
            <Ellipse cx={126} cy={102} rx={28} ry={18} fill="url(#mc_faceLight)" opacity={0.45} clipPath="url(#mc_billClip)" />
            <Path d="M86 90 C112 76, 170 76, 206 92" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth={7} strokeLinecap="round" opacity={0.35} />
            {/* money print details */}
            <Circle cx={108} cy={104} r={10} fill="rgba(255,255,255,0.10)" />
            <Circle cx={188} cy={210} r={9}  fill="rgba(255,255,255,0.14)" />
            <Path d="M98 90 H112 M104 84 V96" stroke="rgba(255,255,255,0.22)" strokeWidth={3} strokeLinecap="round" />
            <Path d="M184 92 h18" stroke="rgba(255,255,255,0.18)" strokeWidth={4} strokeLinecap="round" />
            <Path d="M185 87 h14" stroke="rgba(255,255,255,0.13)" strokeWidth={3} strokeLinecap="round" />
          </G>

          {/* eyebrows */}
          <Path d={eyebrowLeft}  fill="none" stroke="#182017" strokeWidth={6} strokeLinecap="round" />
          <Path d={eyebrowRight} fill="none" stroke="#182017" strokeWidth={6} strokeLinecap="round" />

          {/* eyes */}
          <G transform={`translate(0 ${isIdle ? 4 : 0})`}>
            <Ellipse cx={112} cy={118} rx={17} ry={17 * eyeRY} fill="#fff" />
            <Ellipse cx={160} cy={118} rx={17} ry={17 * eyeRY} fill="#fff" />
            {!isDone && (
              <>
                <Circle cx={114} cy={120} r={8} fill="#102A1A" />
                <Circle cx={162} cy={120} r={8} fill="#102A1A" />
                <Circle cx={117} cy={117} r={3} fill="#fff" />
                <Circle cx={165} cy={117} r={3} fill="#fff" />
              </>
            )}
          </G>

          {/* rosy cheeks */}
          {!isActive && (
            <>
              <Ellipse cx={101} cy={148} rx={7} ry={4} fill="#F2A5A5" opacity={0.45} />
              <Ellipse cx={175} cy={148} rx={7} ry={4} fill="#F2A5A5" opacity={0.45} />
            </>
          )}

          {/* mouth */}
          <Path
            d={mouthPath}
            fill={isActive ? '#912A22' : 'none'}
            stroke={isActive ? 'none' : '#1A2B17'}
            strokeWidth={isActive ? 0 : 5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {isActive ? (
            <Path d="M121 153 C130 160, 138 160, 146 153" fill="none" stroke="#FF7D7D" strokeWidth={5} strokeLinecap="round" />
          ) : null}

          {/* left arm */}
          <G transform={`translate(70 ${130 + armRaise})`}>
            <Path d={leftArmPath} fill="none" stroke="url(#mc_limbGreen)" strokeWidth={16} strokeLinecap="round" />
            <Circle cx={leftHandX} cy={leftHandY} r={14} fill="#fff" />
          </G>

          {/* right arm */}
          <G transform={`translate(224 ${130 + armRaise})`}>
            <Path d={rightArmPath} fill="none" stroke="url(#mc_limbGreen)" strokeWidth={16} strokeLinecap="round" />
            <Circle cx={rightHandX} cy={rightHandY} r={14} fill="#fff" />
          </G>

          {/* standing legs */}
          {!isDone && !isBreak ? (
            <>
              <G transform={`translate(126 ${236 + legLift})`}>
                <Path d={isActive ? 'M0 0 C-6 10,-9 28,-1 42' : 'M0 0 C0 12,0 25,0 40'} fill="none" stroke="url(#mc_limbGreen)" strokeWidth={16} strokeLinecap="round" />
                <G transform={isActive ? 'translate(-7 46) rotate(-12)' : 'translate(-2 44)'}>
                  <Rect x={-18} y={0} rx={10} ry={10} width={38} height={18} fill="url(#mc_shoeGrad)" />
                  <Rect x={-18} y={10} rx={8}  ry={8}  width={38} height={10} fill="#C9D1DB" />
                </G>
              </G>
              <G transform={`translate(172 ${236 - legLift})`}>
                <Path d={isActive ? 'M0 0 C8 8,16 22,18 38' : 'M0 0 C0 12,0 25,0 40'} fill="none" stroke="url(#mc_limbGreen)" strokeWidth={16} strokeLinecap="round" />
                <G transform={isActive ? 'translate(10 44) rotate(10)' : 'translate(0 44)'}>
                  <Rect x={-18} y={0} rx={10} ry={10} width={38} height={18} fill="url(#mc_shoeGrad)" />
                  <Rect x={-18} y={10} rx={8}  ry={8}  width={38} height={10} fill="#C9D1DB" />
                </G>
              </G>
            </>
          ) : null}

          {/* break legs — splayed out */}
          {isBreak ? (
            <>
              <G transform="translate(128 236) rotate(28 0 0)">
                <Path d="M0 0 C8 8,18 18,34 20" fill="none" stroke="url(#mc_limbGreen)" strokeWidth={16} strokeLinecap="round" />
                <G transform="translate(42 16) rotate(-12)">
                  <Rect x={-18} y={0} rx={10} ry={10} width={38} height={18} fill="url(#mc_shoeGrad)" />
                  <Rect x={-18} y={10} rx={8}  ry={8}  width={38} height={10} fill="#C9D1DB" />
                </G>
              </G>
              <G transform="translate(165 238) rotate(-22 0 0)">
                <Path d="M0 0 C-6 10,-12 18,-28 22" fill="none" stroke="url(#mc_limbGreen)" strokeWidth={16} strokeLinecap="round" />
                <G transform="translate(-36 18) rotate(10)">
                  <Rect x={-18} y={0} rx={10} ry={10} width={38} height={18} fill="url(#mc_shoeGrad)" />
                  <Rect x={-18} y={10} rx={8}  ry={8}  width={38} height={10} fill="#C9D1DB" />
                </G>
              </G>
            </>
          ) : null}

          {/* done/sleeping legs — splayed resting */}
          {isDone ? (
            <>
              <G transform="translate(124 232) rotate(28 0 0)">
                <Path d="M0 0 C10 6,18 16,36 20" fill="none" stroke="url(#mc_limbGreen)" strokeWidth={16} strokeLinecap="round" />
                <G transform="translate(44 18) rotate(-5)">
                  <Rect x={-18} y={0} rx={10} ry={10} width={38} height={18} fill="url(#mc_shoeGrad)" />
                  <Rect x={-18} y={10} rx={8}  ry={8}  width={38} height={10} fill="#C9D1DB" />
                </G>
              </G>
              <G transform="translate(168 232) rotate(-18 0 0)">
                <Path d="M0 0 C-8 6,-16 18,-28 26" fill="none" stroke="url(#mc_limbGreen)" strokeWidth={16} strokeLinecap="round" />
                <G transform="translate(-35 24) rotate(8)">
                  <Rect x={-18} y={0} rx={10} ry={10} width={38} height={18} fill="url(#mc_shoeGrad)" />
                  <Rect x={-18} y={10} rx={8}  ry={8}  width={38} height={10} fill="#C9D1DB" />
                </G>
              </G>
            </>
          ) : null}

        </G>
      </Svg>
    </Animated.View>
  );
}
