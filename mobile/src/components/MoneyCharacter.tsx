import React, { useEffect } from 'react';
import { View, Text } from 'react-native';
import Svg, {
  Defs, G, Rect, Circle, Ellipse, Path,
  LinearGradient as SvgLinearGradient,
  RadialGradient as SvgRadialGradient,
  Stop, ClipPath,
  Text as SvgText,
} from 'react-native-svg';
import Animated, {
  useSharedValue, useAnimatedStyle, useAnimatedProps,
  withRepeat, withSequence, withTiming, withSpring,
  Easing, cancelAnimation,
} from 'react-native-reanimated';

export type MoneyCharacterState = 'idle' | 'working' | 'break' | 'done' | 'sleeping';
interface MoneyCharacterProps {
  state?: MoneyCharacterState;
  size?: number;
}

const AnimatedG = Animated.createAnimatedComponent(G);

// ── ViewBox & key coordinates ─────────────────────────────────────────────────
const VW = 200, VH = 265;
const BX = 50, BY = 35, BW = 100, BH = 128; // main bill rect
const AL = { x: 50, y: 88 };   // left arm pivot  (bill left edge)
const AR = { x: 150, y: 88 };  // right arm pivot (bill right edge)
const LL = { x: 80, y: 163 };  // left leg pivot  (bill bottom)
const LR = { x: 120, y: 163 }; // right leg pivot
const EL = { cx: 77, cy: 83 }; // left eye center
const ER = { cx: 123, cy: 83 };// right eye center
const ERX = 13, ERY = 15;      // eye radii
const IRIS = 8.5, PUPIL = 5.5; // iris & pupil radii
const ARM_LEN = 37, ARM_RX = 6;
const LEG_LEN = 26, LEG_RX = 5.5;
const GLOVE_R = 11;

// ── ZZZ overlay ───────────────────────────────────────────────────────────────
function ZzzOverlay({ size }: { size: number }) {
  const op = useSharedValue(0);
  const ty = useSharedValue(0);
  useEffect(() => {
    op.value = withRepeat(withSequence(
      withTiming(0, { duration: 0 }),
      withTiming(1, { duration: 450 }),
      withTiming(1, { duration: 720 }),
      withTiming(0, { duration: 450 }),
      withTiming(0, { duration: 280 }),
    ), -1, false);
    ty.value = withRepeat(withSequence(
      withTiming(0, { duration: 0 }),
      withTiming(-size * 0.26, { duration: 1620 }),
      withTiming(0, { duration: 0 }),
      withTiming(0, { duration: 280 }),
    ), -1, false);
  }, []);
  const s = useAnimatedStyle(() => ({ opacity: op.value, transform: [{ translateY: ty.value }] }));
  return (
    <Animated.View style={[{ position: 'absolute', top: size * 0.08, right: size * 0.5, zIndex: 30 }, s]}>
      <Text style={{ fontSize: size * 0.155, fontWeight: '900', color: '#818cf8',
        textShadowColor: 'rgba(129,140,248,0.45)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 6 }}>
        ZZZ
      </Text>
    </Animated.View>
  );
}

// ── Arm group (reusable for left & right) ─────────────────────────────────────
function ArmShapes({ px, py, flip }: { px: number; py: number; flip?: boolean }) {
  const sx = flip ? -1 : 1;
  const bx = flip ? px - ARM_RX : px;
  return (
    <G>
      {/* arm body - pill shape */}
      <Ellipse cx={px} cy={py + ARM_LEN / 2} rx={ARM_RX} ry={ARM_LEN / 2}
        fill="#1fad56" stroke="#052e16" strokeWidth="1.8" />
      {/* arm highlight (left edge light) */}
      <Ellipse cx={px - ARM_RX * 0.4 * sx} cy={py + ARM_LEN * 0.35} rx={ARM_RX * 0.3} ry={ARM_LEN * 0.22}
        fill="rgba(166,243,208,0.5)" />
      {/* arm shadow (right edge dark) */}
      <Ellipse cx={px + ARM_RX * 0.38 * sx} cy={py + ARM_LEN * 0.55} rx={ARM_RX * 0.28} ry={ARM_LEN * 0.25}
        fill="rgba(5,46,22,0.3)" />
      {/* glove outer shadow */}
      <Circle cx={px} cy={py + ARM_LEN + GLOVE_R * 0.85 + 2} r={GLOVE_R}
        fill="rgba(0,0,0,0.18)" />
      {/* glove white */}
      <Circle cx={px} cy={py + ARM_LEN + GLOVE_R * 0.85} r={GLOVE_R}
        fill="#f8fafc" stroke="#cbd5e1" strokeWidth="1.8" />
      {/* finger nubs */}
      <Ellipse cx={px - 4} cy={py + ARM_LEN + GLOVE_R * 0.05} rx={3.2} ry={2.2} fill="#e2e8f0" />
      <Ellipse cx={px}     cy={py + ARM_LEN + GLOVE_R * 0.02} rx={3.4} ry={2.4} fill="#e2e8f0" />
      <Ellipse cx={px + 4} cy={py + ARM_LEN + GLOVE_R * 0.05} rx={3.2} ry={2.2} fill="#e2e8f0" />
      {/* glove top highlight */}
      <Ellipse cx={px - 2} cy={py + ARM_LEN + GLOVE_R * 0.28} rx={GLOVE_R * 0.42} ry={GLOVE_R * 0.28}
        fill="rgba(255,255,255,0.55)" />
      {/* wrist cuff */}
      <Ellipse cx={px} cy={py + ARM_LEN + GLOVE_R * 1.55} rx={GLOVE_R * 0.88} ry={GLOVE_R * 0.3}
        fill="#dde1e7" stroke="#cbd5e1" strokeWidth="0.8" />
    </G>
  );
}

// ── Shoe group ────────────────────────────────────────────────────────────────
function ShoeShapes({ px, py, flip }: { px: number; py: number; flip?: boolean }) {
  // Left shoe: toe points left (-x). Right shoe: toe points right (+x).
  const tx = flip ? 1 : -1; // toe direction
  const tx2 = flip ? 5 : -5;
  return (
    <G>
      {/* Sole */}
      <Ellipse cx={px + tx2 * 0.6} cy={py + 8} rx={14} ry={5.5}
        fill="#f1f5f9" stroke="#94a3b8" strokeWidth="1" />
      {/* Upper body */}
      <Path
        d={`M ${px - 8 * tx},${py}
            Q ${px + 14 * tx},${py} ${px + 14 * tx},${py + 5}
            L ${px - 8 * tx},${py + 5}
            Q ${px - 14 * tx},${py + 4} ${px - 14 * tx},${py} Z`}
        fill="#1e293b" stroke="#0f172a" strokeWidth="1.2"
      />
      {/* Toe cap */}
      <Path
        d={`M ${px - 8 * tx},${py + 1}
            Q ${px - 14 * tx},${py + 1} ${px - 14 * tx},${py + 3.5}
            Q ${px - 14 * tx},${py + 5.5} ${px - 6 * tx},${py + 5.5}
            L ${px - 6 * tx},${py + 1} Z`}
        fill="#334155"
      />
      {/* Lace zone */}
      <Rect x={px + 1 * tx} y={py + 0.5} width={9} height={5} rx={1.5}
        fill="#e2e8f0" />
      {[1.5, 3.2].map((yy, i) => (
        <Path key={i}
          d={`M ${px + 2 * tx},${py + yy} L ${px + 9 * tx},${py + yy}`}
          stroke="#94a3b8" strokeWidth="1" strokeLinecap="round" />
      ))}
      {/* Heel */}
      <Path
        d={`M ${px - 8 * tx},${py} L ${px - 8 * tx},${py + 5.5}`}
        stroke="#0f172a" strokeWidth="1" />
      {/* Top upper highlight */}
      <Path
        d={`M ${px - 4 * tx},${py + 0.5} Q ${px + 10 * tx},${py + 0.5} ${px + 14 * tx},${py + 2}`}
        stroke="rgba(255,255,255,0.18)" strokeWidth="1.5" strokeLinecap="round" fill="none" />
    </G>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function MoneyCharacter({ state = 'idle', size = 120 }: MoneyCharacterProps) {
  const bodyY  = useSharedValue(0);
  const bodySc = useSharedValue(1);
  const bodyRt = useSharedValue(0);
  const alRot  = useSharedValue(-20);
  const arRot  = useSharedValue(20);
  const llRot  = useSharedValue(0);
  const lrRot  = useSharedValue(0);

  useEffect(() => {
    [bodyY, bodySc, bodyRt, alRot, arRot, llRot, lrRot].forEach(v => cancelAnimation(v));
    bodyY.value = 0; bodySc.value = 1; bodyRt.value = 0;
    llRot.value = 0; lrRot.value = 0;

    const s = Easing.inOut(Easing.ease);
    switch (state) {
      case 'idle':
        bodySc.value = withRepeat(withSequence(
          withTiming(1.022, { duration: 2000, easing: s }),
          withTiming(0.982, { duration: 2000, easing: s }),
        ), -1, false);
        alRot.value = withRepeat(withSequence(
          withTiming(-22, { duration: 1800, easing: s }),
          withTiming(-8,  { duration: 1800, easing: s }),
        ), -1, true);
        arRot.value = withRepeat(withSequence(
          withTiming(8,  { duration: 1800, easing: s }),
          withTiming(22, { duration: 1800, easing: s }),
        ), -1, true);
        break;
      case 'working':
        bodyY.value = withRepeat(withSequence(
          withTiming(-15, { duration: 235, easing: Easing.out(Easing.quad) }),
          withTiming(0,   { duration: 235, easing: Easing.in(Easing.quad) }),
        ), -1, false);
        bodyRt.value = withRepeat(withSequence(
          withTiming(-8, { duration: 235 }),
          withTiming(8,  { duration: 235 }),
        ), -1, false);
        alRot.value = withRepeat(withSequence(
          withTiming(-115, { duration: 235 }),
          withTiming(-42,  { duration: 235 }),
        ), -1, false);
        arRot.value = withRepeat(withSequence(
          withTiming(42,  { duration: 235 }),
          withTiming(115, { duration: 235 }),
        ), -1, false);
        llRot.value = withRepeat(withSequence(
          withTiming(-30, { duration: 235 }),
          withTiming(30,  { duration: 235 }),
        ), -1, false);
        lrRot.value = withRepeat(withSequence(
          withTiming(30,  { duration: 235 }),
          withTiming(-30, { duration: 235 }),
        ), -1, false);
        break;
      case 'break':
        bodySc.value = withRepeat(withSequence(
          withTiming(1.015, { duration: 1400, easing: s }),
          withTiming(0.99,  { duration: 1400, easing: s }),
        ), -1, false);
        alRot.value = withRepeat(withSequence(
          withTiming(-58, { duration: 1000, easing: s }),
          withTiming(-42, { duration: 1000, easing: s }),
        ), -1, true);
        arRot.value = withRepeat(withSequence(
          withTiming(42, { duration: 1000, easing: s }),
          withTiming(58, { duration: 1000, easing: s }),
        ), -1, true);
        break;
      case 'done':
        bodyY.value = withRepeat(withSequence(
          withSpring(-19, { damping: 5, stiffness: 235 }),
          withSpring(0,   { damping: 9, stiffness: 185 }),
          withTiming(0, { duration: 340 }),
        ), -1, false);
        alRot.value = withRepeat(withSequence(
          withTiming(-132, { duration: 205 }),
          withTiming(-95,  { duration: 205 }),
        ), -1, true);
        arRot.value = withRepeat(withSequence(
          withTiming(95,  { duration: 205 }),
          withTiming(132, { duration: 205 }),
        ), -1, true);
        break;
      case 'sleeping':
        bodyRt.value = withTiming(15, { duration: 700 });
        bodySc.value = withRepeat(withSequence(
          withTiming(1.045, { duration: 3200, easing: s }),
          withTiming(0.962, { duration: 3200, easing: s }),
        ), -1, false);
        alRot.value = withTiming(-6, { duration: 700 });
        arRot.value = withTiming(6,  { duration: 700 });
        break;
    }
  }, [state]);

  const bodyStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: bodyY.value },
      { scale: bodySc.value },
      { rotate: `${bodyRt.value}deg` },
    ],
  }));

  const alProps = useAnimatedProps(() => ({ rotation: alRot.value, originX: AL.x, originY: AL.y }));
  const arProps = useAnimatedProps(() => ({ rotation: arRot.value, originX: AR.x, originY: AR.y }));
  const llProps = useAnimatedProps(() => ({ rotation: llRot.value, originX: LL.x, originY: LL.y }));
  const lrProps = useAnimatedProps(() => ({ rotation: lrRot.value, originX: LR.x, originY: LR.y }));

  // ── State-derived face values ────────────────────────────────────────────────
  const closed  = state === 'sleeping' || state === 'done';
  const wide    = state === 'working';
  const squint  = state === 'break';
  const eyeRY   = closed ? 0 : squint ? ERY * 0.44 : wide ? ERY * 1.06 : ERY;
  const pupilDY = wide ? -1.5 : 2;

  const browLY  = state === 'working' ? 67 : state === 'sleeping' ? 75 : 71;
  const browRY  = browLY;
  const browLRt = state === 'working' ? -14 : state === 'sleeping' ? 9 : -5;
  const browRRt = -browLRt;

  // bill gradient colors per state
  const g0 = state === 'working' ? '#a7f3d0' : state === 'done' ? '#d1fae5' : state === 'sleeping' ? '#ecfdf5' : '#86efac';
  const g1 = state === 'sleeping' ? '#6ee7b7' : '#22c55e';
  const g2 = state === 'working' ? '#15803d' : '#14532d';

  const svgH = size * VH / VW;

  return (
    <View style={{ alignItems: 'center' }}>
      {/* floating props */}
      {state === 'working'  && <Text style={{ position: 'absolute', top: 0, right: 0, fontSize: size * 0.24, zIndex: 40 }}>⏰</Text>}
      {state === 'break'    && <Text style={{ position: 'absolute', top: size * 0.02, left: size * 0.12, fontSize: size * 0.25, zIndex: 40 }}>🍔</Text>}
      {state === 'done'     && <Text style={{ position: 'absolute', top: 0, left: 0, fontSize: size * 0.2, zIndex: 40 }}>✨</Text>}
      {state === 'sleeping' && <ZzzOverlay size={size} />}

      <Animated.View style={bodyStyle}>
        <Svg width={size} height={svgH} viewBox={`0 0 ${VW} ${VH}`}>
          <Defs>
            {/* ── Gradients ── */}
            <SvgLinearGradient id="billG" x1="0.08" y1="0" x2="0.92" y2="1">
              <Stop offset="0"   stopColor={g0} />
              <Stop offset="0.4" stopColor={g1} />
              <Stop offset="1"   stopColor={g2} />
            </SvgLinearGradient>

            <SvgLinearGradient id="topH" x1="0.5" y1="0" x2="0.5" y2="1">
              <Stop offset="0" stopColor="white" stopOpacity="0.24" />
              <Stop offset="1" stopColor="white" stopOpacity="0" />
            </SvgLinearGradient>

            <SvgLinearGradient id="botS" x1="0.5" y1="0" x2="0.5" y2="1">
              <Stop offset="0" stopColor="black" stopOpacity="0" />
              <Stop offset="1" stopColor="black" stopOpacity="0.28" />
            </SvgLinearGradient>

            <SvgRadialGradient id="glow" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={wide ? '#a3e635' : '#22c55e'} stopOpacity="0.14" />
              <Stop offset="1" stopColor="#22c55e" stopOpacity="0" />
            </SvgRadialGradient>

            <SvgLinearGradient id="irisG" x1="0.2" y1="0" x2="0.8" y2="1">
              <Stop offset="0" stopColor={wide ? '#d9f99d' : '#86efac'} />
              <Stop offset="1" stopColor={wide ? '#65a30d' : '#16a34a'} />
            </SvgLinearGradient>

            {/* ── Clip paths ── */}
            <ClipPath id="billClip">
              <Rect x={BX} y={BY} width={BW} height={BH} rx={12} />
            </ClipPath>
            <ClipPath id="elClip">
              <Ellipse cx={EL.cx} cy={EL.cy} rx={ERX} ry={eyeRY} />
            </ClipPath>
            <ClipPath id="erClip">
              <Ellipse cx={ER.cx} cy={ER.cy} rx={ERX} ry={eyeRY} />
            </ClipPath>
          </Defs>

          {/* ── Ambient glow ── */}
          <Ellipse cx="100" cy="140" rx="96" ry="108" fill="url(#glow)" />

          {/* ── Floor shadow ── */}
          <Ellipse cx="100" cy="258" rx="50" ry="7" fill="black" fillOpacity="0.16" />

          {/* ── Bill stack (back bills) ── */}
          <Rect x={BX} y={BY} width={BW} height={BH} rx={12}
            fill="#0f4424" transform="rotate(6.5, 100, 99)" />
          <Rect x={BX} y={BY} width={BW} height={BH} rx={12}
            fill="#155e33" transform="rotate(3, 100, 99)" />

          {/* ── Left arm (behind bill) ── */}
          <AnimatedG animatedProps={alProps}>
            <ArmShapes px={AL.x} py={AL.y} />
          </AnimatedG>

          {/* ── Right arm (behind bill) ── */}
          <AnimatedG animatedProps={arProps}>
            <ArmShapes px={AR.x} py={AR.y} flip />
          </AnimatedG>

          {/* ── Main bill ── */}
          {/* Drop shadow */}
          <Rect x={BX + 3} y={BY + 6} width={BW} height={BH} rx={12}
            fill="#052e16" fillOpacity="0.38" />
          {/* Body */}
          <Rect x={BX} y={BY} width={BW} height={BH} rx={12}
            fill="url(#billG)" stroke="#052e16" strokeWidth="2.2" />
          {/* Top light */}
          <Rect x={BX} y={BY} width={BW} height={BH * 0.38} rx={12}
            fill="url(#topH)" clipPath="url(#billClip)" />
          {/* Bottom shadow */}
          <Rect x={BX} y={BY + BH * 0.63} width={BW} height={BH * 0.37}
            fill="url(#botS)" clipPath="url(#billClip)" />
          {/* Rim light left */}
          <Rect x={BX} y={BY} width={BW * 0.12} height={BH} rx={0}
            fill="rgba(166,243,208,0.12)" clipPath="url(#billClip)" />
          {/* Inner border */}
          <Rect x={BX + 8} y={BY + 8} width={BW - 16} height={BH - 16} rx={8}
            fill="none" stroke="rgba(255,255,255,0.24)" strokeWidth="1.5" />
          {/* Corner seals */}
          {([
            { cx: BX + 14, cy: BY + 14 },
            { cx: BX + BW - 14, cy: BY + 14 },
            { cx: BX + 14, cy: BY + BH - 14 },
            { cx: BX + BW - 14, cy: BY + BH - 14 },
          ]).map((p, i) => (
            <G key={i}>
              <Circle cx={p.cx} cy={p.cy} r={7} fill="none"
                stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
              <Circle cx={p.cx} cy={p.cy} r={3} fill="rgba(255,255,255,0.18)" />
            </G>
          ))}
          {/* Serial bars */}
          <Rect x={BX + 24} y={BY + 12} width={40} height={5} rx={2.5}
            fill="rgba(255,255,255,0.14)" />
          <Rect x={BX + 36} y={BY + BH - 17} width={40} height={5} rx={2.5}
            fill="rgba(255,255,255,0.14)" />
          {/* Security thread */}
          <Rect x={BX + 18} y={BY} width={2.5} height={BH} rx={1.2}
            fill="rgba(255,255,255,0.13)" />

          {/* ₪ watermark */}
          <SvgText x="100" y="136" textAnchor="middle"
            fontSize="84" fontWeight="900" fill="rgba(20,83,45,0.13)"
            letterSpacing="-3">₪</SvgText>

          {/* ── FACE ── */}

          {/* Eyebrows */}
          <Path
            d={`M ${EL.cx - 10},${browLY + 2} Q ${EL.cx},${browLY - 4} ${EL.cx + 10},${browLY + 2}`}
            stroke="#052e16" strokeWidth="5" strokeLinecap="round" fill="none"
            transform={`rotate(${browLRt}, ${EL.cx}, ${browLY})`}
          />
          <Path
            d={`M ${ER.cx - 10},${browRY + 2} Q ${ER.cx},${browRY - 4} ${ER.cx + 10},${browRY + 2}`}
            stroke="#052e16" strokeWidth="5" strokeLinecap="round" fill="none"
            transform={`rotate(${browRRt}, ${ER.cx}, ${browRY})`}
          />

          {/* Left eye */}
          {closed ? (
            <Path
              d={`M ${EL.cx - 12},${EL.cy} Q ${EL.cx},${EL.cy + 7} ${EL.cx + 12},${EL.cy}`}
              stroke="#052e16" strokeWidth="3.8" strokeLinecap="round" fill="none"
            />
          ) : (
            <G>
              <Ellipse cx={EL.cx} cy={EL.cy + 2.5} rx={ERX + 0.5} ry={eyeRY + 0.5}
                fill="rgba(0,0,0,0.2)" />
              <Ellipse cx={EL.cx} cy={EL.cy} rx={ERX} ry={eyeRY}
                fill="white" stroke="#0f2e1a" strokeWidth="1.8" />
              <G clipPath="url(#elClip)">
                <Ellipse cx={EL.cx} cy={EL.cy + pupilDY} rx={IRIS} ry={IRIS}
                  fill="url(#irisG)" />
                <Ellipse cx={EL.cx} cy={EL.cy + pupilDY - IRIS * 0.38}
                  rx={IRIS * 0.78} ry={IRIS * 0.28} fill="rgba(255,255,255,0.22)" />
                <Circle cx={EL.cx} cy={EL.cy + pupilDY} r={PUPIL} fill="#081410" />
                <Circle cx={EL.cx + 2.5} cy={EL.cy + pupilDY - 2} r={2.2} fill="white" />
                <Circle cx={EL.cx - 2} cy={EL.cy + pupilDY + 2.5} r={1} fill="rgba(255,255,255,0.7)" />
                {squint === true ? (
                  <Rect x={EL.cx - ERX} y={EL.cy - ERY} width={ERX * 2} height={ERY * 0.52}
                    fill="#22c55e" />
                ) : null}
              </G>
              <Ellipse cx={EL.cx} cy={EL.cy - eyeRY * 0.62}
                rx={ERX * 0.75} ry={eyeRY * 0.22} fill="rgba(255,255,255,0.12)" />
            </G>
          )}

          {/* Right eye */}
          {closed ? (
            <Path
              d={`M ${ER.cx - 12},${ER.cy} Q ${ER.cx},${ER.cy + 7} ${ER.cx + 12},${ER.cy}`}
              stroke="#052e16" strokeWidth="3.8" strokeLinecap="round" fill="none"
            />
          ) : (
            <G>
              <Ellipse cx={ER.cx} cy={ER.cy + 2.5} rx={ERX + 0.5} ry={eyeRY + 0.5}
                fill="rgba(0,0,0,0.2)" />
              <Ellipse cx={ER.cx} cy={ER.cy} rx={ERX} ry={eyeRY}
                fill="white" stroke="#0f2e1a" strokeWidth="1.8" />
              <G clipPath="url(#erClip)">
                <Ellipse cx={ER.cx} cy={ER.cy + pupilDY} rx={IRIS} ry={IRIS}
                  fill="url(#irisG)" />
                <Ellipse cx={ER.cx} cy={ER.cy + pupilDY - IRIS * 0.38}
                  rx={IRIS * 0.78} ry={IRIS * 0.28} fill="rgba(255,255,255,0.22)" />
                <Circle cx={ER.cx} cy={ER.cy + pupilDY} r={PUPIL} fill="#081410" />
                <Circle cx={ER.cx + 2.5} cy={ER.cy + pupilDY - 2} r={2.2} fill="white" />
                <Circle cx={ER.cx - 2} cy={ER.cy + pupilDY + 2.5} r={1} fill="rgba(255,255,255,0.7)" />
                {squint === true ? (
                  <Rect x={ER.cx - ERX} y={ER.cy - ERY} width={ERX * 2} height={ERY * 0.52}
                    fill="#22c55e" />
                ) : null}
              </G>
              <Ellipse cx={ER.cx} cy={ER.cy - eyeRY * 0.62}
                rx={ERX * 0.75} ry={eyeRY * 0.22} fill="rgba(255,255,255,0.12)" />
            </G>
          )}

          {/* Mouth */}
          {(state === 'idle') && (
            <Path d="M 88,114 Q 100,124 112,114"
              stroke="#052e16" strokeWidth="3.5" strokeLinecap="round" fill="none" />
          )}
          {(state === 'sleeping' || state === 'done') && (
            <Path d="M 91,113 Q 100,120 109,113"
              stroke="#052e16" strokeWidth="3" strokeLinecap="round" fill="none" />
          )}
          {state === 'working' && (
            <G>
              <Path d="M 84,112 Q 100,132 116,112" fill="#0f172a" stroke="#052e16" strokeWidth="2.2" />
              <Path d="M 86,112 L 86,119 L 93.5,119 L 93.5,112" fill="white" stroke="#e5e7eb" strokeWidth="0.8" />
              <Path d="M 93.5,112 L 93.5,119 L 100.5,119 L 100.5,112" fill="white" stroke="#e5e7eb" strokeWidth="0.8" />
              <Path d="M 100.5,112 L 100.5,119 L 107.5,119 L 107.5,112" fill="white" stroke="#e5e7eb" strokeWidth="0.8" />
              <Path d="M 107.5,112 L 107.5,119 L 114,119 L 114,112" fill="white" stroke="#e5e7eb" strokeWidth="0.8" />
              <Ellipse cx="100" cy="124" rx="7.5" ry="5.5" fill="#f87171" />
              <Path d="M 100,121 L 100,127" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" />
            </G>
          )}
          {state === 'break' && (
            <G>
              <Path d="M 87,113 Q 100,127 113,113" fill="#0f172a" stroke="#052e16" strokeWidth="2.2" />
              <Path d="M 89,113 L 89,119 L 97,119 L 97,113" fill="white" stroke="#e5e7eb" strokeWidth="0.8" />
              <Path d="M 97,113 L 97,119 L 103,119 L 103,113" fill="white" stroke="#e5e7eb" strokeWidth="0.8" />
              <Path d="M 103,113 L 103,119 L 111,119 L 111,113" fill="white" stroke="#e5e7eb" strokeWidth="0.8" />
            </G>
          )}

          {/* Cheeks */}
          <Ellipse cx="62" cy="104" rx="9.5" ry="6" fill="#fda4af" fillOpacity="0.48" />
          <Ellipse cx="138" cy="104" rx="9.5" ry="6" fill="#fda4af" fillOpacity="0.48" />

          {/* ── Left leg ── */}
          <AnimatedG animatedProps={llProps}>
            <Ellipse cx={LL.x} cy={LL.y + LEG_LEN / 2} rx={LEG_RX} ry={LEG_LEN / 2}
              fill="#1fad56" stroke="#052e16" strokeWidth="1.8" />
            <Ellipse cx={LL.x - LEG_RX * 0.35} cy={LL.y + LEG_LEN * 0.3}
              rx={LEG_RX * 0.3} ry={LEG_LEN * 0.22} fill="rgba(166,243,208,0.5)" />
            <ShoeShapes px={LL.x} py={LL.y + LEG_LEN} />
          </AnimatedG>

          {/* ── Right leg ── */}
          <AnimatedG animatedProps={lrProps}>
            <Ellipse cx={LR.x} cy={LR.y + LEG_LEN / 2} rx={LEG_RX} ry={LEG_LEN / 2}
              fill="#1fad56" stroke="#052e16" strokeWidth="1.8" />
            <Ellipse cx={LR.x + LEG_RX * 0.35} cy={LR.y + LEG_LEN * 0.3}
              rx={LEG_RX * 0.3} ry={LEG_LEN * 0.22} fill="rgba(166,243,208,0.5)" />
            <ShoeShapes px={LR.x} py={LR.y + LEG_LEN} flip />
          </AnimatedG>

          {/* Break: red cap */}
          {state === 'break' && (
            <G>
              <Rect x="60" y="24" width="80" height="10" rx="3"
                fill="#dc2626" stroke="#7f1d1d" strokeWidth="1" />
              <Path d="M 65,34 Q 65,18 100,15 Q 135,18 135,34 Z"
                fill="#ef4444" stroke="#7f1d1d" strokeWidth="1.2" />
              <Circle cx="100" cy="24" r="4" fill="rgba(255,255,255,0.7)" />
            </G>
          )}

        </Svg>
      </Animated.View>
    </View>
  );
}
