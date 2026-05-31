import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { tropicalColors, tropicalGradients } from '../lib/tropicalTheme';

type TropicalWoodButtonProps = {
  label: string;
  onPress: () => void;
  icon?: React.ReactNode;
  variant?: 'primary' | 'secondary';
  style?: ViewStyle;
};

export function TropicalWoodButton({
  label,
  onPress,
  icon,
  variant = 'primary',
  style,
}: TropicalWoodButtonProps) {
  const isPrimary = variant === 'primary';
  const gradient = isPrimary ? tropicalGradients.woodButton : tropicalGradients.wickerWood;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.pressable, style, pressed && styles.pressed]}
    >
      <View style={[styles.outerFrame, !isPrimary && styles.outerFrameSecondary]}>
        <LinearGradient
          colors={[...gradient]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.gradient}
        >
          <View style={styles.topBevel} />
          <View style={styles.content}>
            <Text style={[styles.label, isPrimary ? styles.labelPrimary : styles.labelSecondary]}>
              {label}
            </Text>
            {icon}
          </View>
          <View style={styles.bottomBevel} />
        </LinearGradient>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    width: '100%',
  },
  pressed: {
    opacity: 0.94,
    transform: [{ scale: 0.98 }],
  },
  outerFrame: {
    borderRadius: 14,
    borderWidth: 3,
    borderColor: tropicalColors.woodDeep,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 8,
  },
  outerFrameSecondary: {
    borderColor: tropicalColors.woodMid,
    borderWidth: 2,
    elevation: 5,
    shadowOpacity: 0.28,
  },
  gradient: {
    position: 'relative',
    minHeight: 52,
    justifyContent: 'center',
  },
  topBevel: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
  },
  bottomBevel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.22)',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 15,
    paddingHorizontal: 20,
  },
  label: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  labelPrimary: {
    color: tropicalColors.cream,
    textShadowColor: 'rgba(0, 0, 0, 0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  labelSecondary: {
    color: tropicalColors.woodDeep,
  },
});
