import React from 'react';
import {Image, StyleSheet} from 'react-native';

type Variant = 'butterMoon' | 'hemlock' | 'luxor' | 'thistle' | 'black' | 'white';

interface ViraLeafMarkProps {
  size?: number;
  variant?: Variant;
}

const ASSETS: Record<Variant, ReturnType<typeof require>> = {
  butterMoon: require('../../assets/images/VIRA_Icon_BtrMn_RGB.png'),
  hemlock: require('../../assets/images/VIRA_Icon_Hem_RGB.png'),
  luxor: require('../../assets/images/VIRA_Icon_Lux_RGB.png'),
  thistle: require('../../assets/images/VIRA_Icon_This_RGB.png'),
  black: require('../../assets/images/VIRA_Icon_Blk_RGB.png'),
  white: require('../../assets/images/VIRA_Icon_Wht_RGB.png'),
};

/**
 * Vira brand mark using official PNG assets.
 *
 * variant: which color version of the icon to use (default: 'butterMoon')
 *   - 'butterMoon' → cream icon, for use on Hemlock (dark) backgrounds
 *   - 'hemlock'    → dark green icon, for use on Butter Moon (light) backgrounds
 *   - 'luxor'      → olive gold
 *   - 'thistle'    → muted sage
 *   - 'black' / 'white' → utility variants
 *
 * NOTE: The PNG assets currently have a solid background (non-transparent).
 * If the icon background is visible on screen, transparency versions of the
 * assets are needed. Track at: assets/images/VIRA_Icon_*_RGB.png
 */
export function ViraLeafMark({size = 48, variant = 'butterMoon'}: ViraLeafMarkProps) {
  return (
    <Image
      source={ASSETS[variant]}
      style={StyleSheet.flatten([{width: size, height: size}])}
      resizeMode="contain"
    />
  );
}
