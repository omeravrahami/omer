import React, { useEffect } from 'react';
import { View, Text, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  runOnJS,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useToastStore } from '@/lib/state/toast-store';
import { X } from 'lucide-react-native';

const COLORS = {
  success: { bg: '#059669', text: '#FFFFFF' },
  error: { bg: '#DC2626', text: '#FFFFFF' },
  info: { bg: '#2563EB', text: '#FFFFFF' },
};

export function Toast() {
  const visible = useToastStore((s) => s.visible);
  const message = useToastStore((s) => s.message);
  const type = useToastStore((s) => s.type);
  const hideToast = useToastStore((s) => s.hideToast);
  const insets = useSafeAreaInsets();

  const translateY = useSharedValue(-100);

  useEffect(() => {
    if (visible) {
      translateY.value = withTiming(0, { duration: 300 });
      translateY.value = withDelay(2200, withTiming(-100, { duration: 300 }, () => {
        runOnJS(hideToast)();
      }));
    } else {
      translateY.value = withTiming(-100, { duration: 200 });
    }
  }, [visible, hideToast, translateY]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  if (!visible) return null;

  const colors = COLORS[type];

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          top: insets.top + 8,
          left: 16,
          right: 16,
          backgroundColor: colors.bg,
          borderRadius: 12,
          paddingHorizontal: 16,
          paddingVertical: 14,
          flexDirection: 'row-reverse',
          alignItems: 'center',
          justifyContent: 'space-between',
          zIndex: 9999,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.2,
          shadowRadius: 8,
          elevation: 8,
        },
        animStyle,
      ]}
      testID="toast-container"
    >
      <Pressable onPress={hideToast} testID="toast-dismiss">
        <X size={18} color={colors.text} />
      </Pressable>
      <Text
        style={{
          color: colors.text,
          fontSize: 15,
          fontWeight: '600',
          flex: 1,
          textAlign: 'right',
          marginLeft: 8,
        }}
      >
        {message}
      </Text>
    </Animated.View>
  );
}
