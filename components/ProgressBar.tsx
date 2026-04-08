import React from 'react';
import { View, StyleSheet } from 'react-native';

interface Props {
  percentage: number; // 0..100
  height?: number;
  backgroundColor?: string;
  fillColor?: string;
  borderRadius?: number;
}

export default function ProgressBar({
  percentage,
  height = 8,
  backgroundColor = '#e6e6e6',
  fillColor = '#3b82f6',
  borderRadius = 8,
}: Props) {
  const clamped = Math.max(0, Math.min(100, percentage));
  return (
    <View style={[styles.container, { height, backgroundColor, borderRadius }]}>
      <View
        style={[
          styles.fill,
          {
            width: `${clamped}%`,
            backgroundColor: fillColor,
            borderTopLeftRadius: borderRadius,
            borderBottomLeftRadius: borderRadius,
            borderTopRightRadius: clamped === 100 ? borderRadius : 0,
            borderBottomRightRadius: clamped === 100 ? borderRadius : 0,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    width: '100%',
  },
  fill: {
    height: '100%',
  },
});