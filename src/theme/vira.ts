export const colors = {
  // Brand palette (Super Deluxe guidelines)
  hemlock: '#5B5F45',
  butterMoon: '#FCFEE6',
  luxor: '#9A9331',
  thistle: '#D0CE94',
  lagoon: '#181E14',
  vermillion: '#E34234',

  // Derived UI tones
  background: '#F9FAF0',
  card: '#FFFFFF',
  textPrimary: '#181E14',
  textSecondary: '#5B5F45',
  textMuted: '#8A8D7A',
  border: '#E8E8D8',
  borderLight: '#F0F0E4',

  // Semantic
  success: '#4A7A5A',
  warning: '#B87A3A',
  error: '#C04030',
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
};

export const radius = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
};

export const typography = {
  fontFamily: 'Montserrat',
  // Headline 1: Montserrat ExtraBold, uppercase (brand guidelines)
  heading1: {
    fontFamily: 'Montserrat-ExtraBold',
    fontSize: 28,
    fontWeight: '800' as const,
    letterSpacing: -0.3,
  },
  // Headline 2: Montserrat Bold
  heading2: {
    fontFamily: 'Montserrat-Bold',
    fontSize: 22,
    fontWeight: '700' as const,
    letterSpacing: -0.2,
  },
  // Body: Montserrat Regular
  body: {
    fontFamily: 'Montserrat-Regular',
    fontSize: 15,
    fontWeight: '400' as const,
    lineHeight: 22,
  },
  // Labels: Montserrat SemiBold, uppercase (brand guidelines)
  label: {
    fontFamily: 'Montserrat-SemiBold',
    fontSize: 11,
    fontWeight: '600' as const,
    letterSpacing: 1.2,
    textTransform: 'uppercase' as const,
  },
  // Caption: small muted text
  caption: {
    fontFamily: 'Montserrat-Regular',
    fontSize: 12,
    fontWeight: '400' as const,
  },
  // Button: Montserrat Bold, uppercase
  button: {
    fontFamily: 'Montserrat-Bold',
    fontSize: 15,
    fontWeight: '700' as const,
    letterSpacing: 0.5,
  },
};

export const viraTheme = {
  colors,
  spacing,
  radius,
  typography,
};

export type ViraTheme = typeof viraTheme;