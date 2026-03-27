import React from 'react';
import { View } from 'react-native';
import Svg, {
  Defs, G, Rect, Ellipse, Path,
  LinearGradient,
  RadialGradient,
  Stop,
} from 'react-native-svg';

export type MoneyCharacterState = 'idle' | 'working' | 'break' | 'done' | 'sleeping';

interface MoneyCharacterProps {
  state?: MoneyCharacterState;
  size?: number;
}

// ── Bill geometry ─────────────────────────────────────────────────────────────
// ViewBox: 200 × 260
// Bill front face: rounded rect starting at (38, 48), size 124 × 130, radius 18
const BX = 38, BY = 48, BW = 124, BH = 130, BR = 18;
const BCX = BX + BW / 2;  // 100 — horizontal center
const BCY = BY + BH / 2;  // 113 — vertical center
// Right-edge depth thickness
const DX = 12; // how many px the 3D edge sticks out to the right
const DY = -6; // how many px the 3D edge recedes upward (perspective)

export default function MoneyCharacter({ state = 'idle', size = 180 }: MoneyCharacterProps) {
  const scale = size / 200;

  return (
    <View style={{ width: size, height: size * 1.3, alignItems: 'center', justifyContent: 'center' }}>
      <Svg
        width={size}
        height={size * 1.3}
        viewBox="0 0 200 260"
      >
        <Defs>
          {/* Front bill: radial gradient — bright lime center → rich green edges */}
          <RadialGradient id="billFront" cx="42%" cy="38%" rx="62%" ry="65%">
            <Stop offset="0%"   stopColor="#A4E85A" />
            <Stop offset="35%"  stopColor="#6DC82E" />
            <Stop offset="75%"  stopColor="#4BA018" />
            <Stop offset="100%" stopColor="#326E0F" />
          </RadialGradient>

          {/* Back stack bills gradient — darker */}
          <LinearGradient id="billBack1" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%"   stopColor="#4BAA1A" />
            <Stop offset="100%" stopColor="#2A6A0A" />
          </LinearGradient>
          <LinearGradient id="billBack2" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%"   stopColor="#38880F" />
            <Stop offset="100%" stopColor="#1C5206" />
          </LinearGradient>

          {/* Right-side edge: dark shadowed gradient */}
          <LinearGradient id="edgeRight" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%"   stopColor="#2A6A0A" />
            <Stop offset="100%" stopColor="#163D04" />
          </LinearGradient>

          {/* Bottom edge */}
          <LinearGradient id="edgeBottom" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%"   stopColor="#2A6A0A" />
            <Stop offset="100%" stopColor="#163D04" />
          </LinearGradient>

          {/* Top highlight strip */}
          <LinearGradient id="topHighlight" x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%"   stopColor="white" stopOpacity={0.28} />
            <Stop offset="100%" stopColor="white" stopOpacity={0} />
          </LinearGradient>
        </Defs>

        {/* ── STACK DEPTH: 2 bills behind, rotated slightly ── */}
        {/* Back bill 2 — most rotated, darkest */}
        <G rotation="-8" originX={BCX} originY={BCY}>
          <Rect
            x={BX} y={BY}
            width={BW} height={BH}
            rx={BR} ry={BR}
            fill="url(#billBack2)"
            stroke="#163D04"
            strokeWidth={1.5}
          />
          {/* Inner frame on back bill */}
          <Rect
            x={BX + 9} y={BY + 9}
            width={BW - 18} height={BH - 18}
            rx={10} ry={10}
            fill="none"
            stroke="#1C5206"
            strokeWidth={1}
            opacity={0.6}
          />
        </G>

        {/* Back bill 1 — less rotated */}
        <G rotation="-4" originX={BCX} originY={BCY}>
          <Rect
            x={BX} y={BY}
            width={BW} height={BH}
            rx={BR} ry={BR}
            fill="url(#billBack1)"
            stroke="#1E5208"
            strokeWidth={1.5}
          />
          <Rect
            x={BX + 9} y={BY + 9}
            width={BW - 18} height={BH - 18}
            rx={10} ry={10}
            fill="none"
            stroke="#2A6A0A"
            strokeWidth={1}
            opacity={0.55}
          />
        </G>

        {/* ── 3D RIGHT EDGE (thickness illusion) ── */}
        {/* This parallelogram sits between back bills and front bill */}
        <Path
          d={`
            M ${BX + BW - BR}   ${BY}
            L ${BX + BW - BR + DX}  ${BY + DY}
            L ${BX + BW + DX}    ${BY + DY + BR}
            L ${BX + BW + DX}    ${BY + BH + DY - BR}
            L ${BX + BW - BR + DX}  ${BY + BH + DY}
            L ${BX + BW - BR}    ${BY + BH}
            L ${BX + BW}         ${BY + BH - BR}
            L ${BX + BW}         ${BY + BR}
            Z
          `}
          fill="url(#edgeRight)"
        />

        {/* ── FRONT BILL FACE ── */}
        <Rect
          x={BX} y={BY}
          width={BW} height={BH}
          rx={BR} ry={BR}
          fill="url(#billFront)"
          stroke="#2A6210"
          strokeWidth={2.5}
        />

        {/* Inner decorative border (dollar bill feel) */}
        <Rect
          x={BX + 9} y={BY + 9}
          width={BW - 18} height={BH - 18}
          rx={10} ry={10}
          fill="none"
          stroke="#5CB822"
          strokeWidth={1.8}
          opacity={0.45}
        />

        {/* Center oval decoration (like real dollar bill oval ring) */}
        <Ellipse
          cx={BCX} cy={BCY + 8}
          rx={34} ry={26}
          fill="none"
          stroke="#5CB822"
          strokeWidth={1.4}
          opacity={0.35}
        />

        {/* ── SURFACE HIGHLIGHTS ── */}
        {/* Top-left sheen — rounded strip */}
        <Rect
          x={BX + 10} y={BY + 6}
          width={BW - 20} height={34}
          rx={12} ry={12}
          fill="url(#topHighlight)"
        />

        {/* Left edge rim light */}
        <Rect
          x={BX + 4} y={BY + BR}
          width={7} height={BH - BR * 2}
          rx={3} ry={3}
          fill="white"
          opacity={0.08}
        />

        {/* Center ambient glow */}
        <Ellipse
          cx={BCX - 6} cy={BCY - 10}
          rx={28} ry={20}
          fill="white"
          opacity={0.1}
        />

        {/* Drop shadow underneath bill */}
        <Ellipse
          cx={BCX + 4} cy={BY + BH + 14}
          rx={50} ry={8}
          fill="black"
          opacity={0.12}
        />
      </Svg>
    </View>
  );
}
