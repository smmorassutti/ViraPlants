import React from 'react';
import Svg, {Path} from 'react-native-svg';
import {viraTheme} from '../theme/vira';

interface ViraLeafMarkProps {
  size?: number;
  color?: string;
}

/**
 * Vira brand mark — two overlapping organic leaf shapes.
 * The smaller leaf sits behind and to the upper-left of the primary leaf.
 *
 * Default color is butterMoon (for use on Hemlock backgrounds).
 * Pass viraTheme.colors.hemlock when placed on Butter Moon backgrounds.
 */
export function ViraLeafMark({
  size = 48,
  color = viraTheme.colors.butterMoon,
}: ViraLeafMarkProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {/* Secondary leaf — behind, offset upper-left */}
      <Path
        d="M 28 58 C 52 46 58 14 30 6 C 8 2 2 40 28 58 Z"
        fill={color}
        opacity={0.42}
      />
      {/* Primary leaf — front, slightly larger and shifted right */}
      <Path
        d="M 58 84 C 88 72 92 26 65 12 C 40 4 20 50 58 84 Z"
        fill={color}
      />
    </Svg>
  );
}
