import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {viraTheme} from '../theme/vira';
import {getInitials} from '../utils/getInitials';

type Props = {
  displayName: string | null;
};

export const CareEventAvatar: React.FC<Props> = ({displayName}) => (
  <View
    style={styles.circle}
    accessibilityRole="image"
    accessibilityLabel={
      displayName ? `Logged by ${displayName}` : 'Logged by another caretaker'
    }>
    <Text style={styles.initials}>{getInitials(displayName)}</Text>
  </View>
);

const styles = StyleSheet.create({
  circle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: viraTheme.colors.luxor,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontFamily: 'Montserrat-SemiBold',
    fontSize: 10,
    color: viraTheme.colors.butterMoon,
  },
});
