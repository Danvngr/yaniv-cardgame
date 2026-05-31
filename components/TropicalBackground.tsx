import React from 'react';
import { ImageBackground, StyleSheet, View, ViewStyle } from 'react-native';
import { BACKGROUND_IMAGES } from '../lib/assetPreloader';
import { tropicalColors } from '../lib/tropicalTheme';

type TropicalBackgroundProps = {
  children: React.ReactNode;
  style?: ViewStyle;
};

export function TropicalBackground({ children, style }: TropicalBackgroundProps) {
  return (
    <ImageBackground
      source={BACKGROUND_IMAGES['tropical-background']}
      style={[styles.background, style]}
      resizeMode="cover"
    >
      <View style={styles.overlay}>{children}</View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: tropicalColors.overlay,
  },
});
