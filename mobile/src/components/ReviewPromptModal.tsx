import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, SlideOutDown } from 'react-native-reanimated';
import { Star } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

// ─── Theme ────────────────────────────────────────────────────────────────────

const BG_DEEP = '#080E1A';
const BG_CARD = '#0F1729';
const BG_INPUT = '#1A2540';
const BORDER = 'rgba(255,255,255,0.08)';
const TEXT_PRIMARY = '#F0F6FF';
const TEXT_SECONDARY = 'rgba(255,255,255,0.5)';
const ACCENT_BLUE = '#3B82F6';
const STAR_ACTIVE = '#F59E0B';
const STAR_INACTIVE = 'rgba(255,255,255,0.15)';

// ─── Props ────────────────────────────────────────────────────────────────────

interface ReviewPromptModalProps {
  visible: boolean;
  onClose: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ReviewPromptModal({ visible, onClose }: ReviewPromptModalProps) {
  const [rating, setRating] = useState<number>(0);
  const [comment, setComment] = useState<string>('');

  const handleStarPress = useCallback((star: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRating(star);
  }, []);

  const handleSubmit = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setRating(0);
    setComment('');
    onClose();
  }, [onClose]);

  const handleDismiss = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setRating(0);
    setComment('');
    onClose();
  }, [onClose]);

  return (
    <Modal
      transparent
      visible={visible}
      animationType="none"
      onRequestClose={handleDismiss}
      testID="review-prompt-modal"
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        {/* Backdrop */}
        <Animated.View
          entering={FadeIn.duration(250)}
          exiting={FadeOut.duration(200)}
          style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.7)',
          }}
        >
          <Pressable style={{ flex: 1 }} onPress={handleDismiss} testID="review-modal-backdrop" />
        </Animated.View>

        {/* Sheet */}
        <Animated.View
          entering={SlideInDown.springify().damping(18).stiffness(120)}
          exiting={SlideOutDown.duration(220)}
          style={{
            position: 'absolute',
            bottom: 0, left: 0, right: 0,
            backgroundColor: BG_CARD,
            borderTopLeftRadius: 28,
            borderTopRightRadius: 28,
            paddingHorizontal: 24,
            paddingTop: 20,
            paddingBottom: 40,
            borderTopWidth: 1,
            borderLeftWidth: 1,
            borderRightWidth: 1,
            borderColor: 'rgba(59,130,246,0.15)',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -8 },
            shadowOpacity: 0.4,
            shadowRadius: 24,
            elevation: 20,
          }}
        >
          {/* Drag handle */}
          <View style={{ alignItems: 'center', marginBottom: 20 }}>
            <View style={{ width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)' }} />
          </View>

          {/* Icon */}
          <View style={{ alignItems: 'center', marginBottom: 16 }}>
            <View style={{
              width: 64, height: 64, borderRadius: 32,
              backgroundColor: 'rgba(59,130,246,0.12)',
              borderWidth: 1.5,
              borderColor: 'rgba(59,130,246,0.3)',
              alignItems: 'center', justifyContent: 'center',
            }}>
              <Star
                size={30}
                color={ACCENT_BLUE}
                fill={rating > 0 ? ACCENT_BLUE : 'transparent'}
                strokeWidth={2}
              />
            </View>
          </View>

          {/* Title */}
          <Text style={{
            fontSize: 20,
            fontWeight: '800',
            color: TEXT_PRIMARY,
            textAlign: 'center',
            marginBottom: 8,
            letterSpacing: 0.2,
          }}>
            {'מה דעתך על האפליקציה?'}
          </Text>

          {/* Subtitle */}
          <Text style={{
            fontSize: 13,
            color: TEXT_SECONDARY,
            textAlign: 'center',
            marginBottom: 28,
            lineHeight: 19,
            paddingHorizontal: 12,
          }}>
            {'הדעה שלך חשובה לנו ועוזרת לשפר את החוויה'}
          </Text>

          {/* Star rating */}
          <View style={{
            flexDirection: 'row-reverse',
            justifyContent: 'center',
            gap: 10,
            marginBottom: 24,
          }}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Pressable
                key={star}
                onPress={() => handleStarPress(star)}
                testID={`review-star-${star}`}
                style={({ pressed }) => ({
                  transform: [{ scale: pressed ? 0.85 : 1 }],
                  padding: 4,
                })}
              >
                <Star
                  size={38}
                  color={star <= rating ? STAR_ACTIVE : STAR_INACTIVE}
                  fill={star <= rating ? STAR_ACTIVE : 'transparent'}
                  strokeWidth={star <= rating ? 0 : 1.5}
                />
              </Pressable>
            ))}
          </View>

          {/* Comment input */}
          <View style={{
            backgroundColor: BG_INPUT,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: BORDER,
            marginBottom: 20,
            overflow: 'hidden',
          }}>
            <TextInput
              value={comment}
              onChangeText={setComment}
              placeholder={'ספר לנו עוד... (אופציונלי)'}
              placeholderTextColor={TEXT_SECONDARY}
              multiline
              numberOfLines={3}
              textAlign="right"
              style={{
                color: TEXT_PRIMARY,
                fontSize: 14,
                padding: 14,
                minHeight: 80,
                textAlignVertical: 'top',
              }}
              testID="review-comment-input"
            />
          </View>

          {/* Primary button */}
          <Pressable
            onPress={handleSubmit}
            testID="review-submit-button"
            style={({ pressed }) => ({
              backgroundColor: ACCENT_BLUE,
              borderRadius: 16,
              height: 52,
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 12,
              opacity: pressed ? 0.85 : 1,
              shadowColor: ACCENT_BLUE,
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.35,
              shadowRadius: 14,
              elevation: 6,
            })}
          >
            <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700', letterSpacing: 0.2 }}>
              {'שלח משוב'}
            </Text>
          </Pressable>

          {/* Ghost dismiss button */}
          <Pressable
            onPress={handleDismiss}
            testID="review-dismiss-button"
            style={({ pressed }) => ({
              height: 44,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Text style={{ color: TEXT_SECONDARY, fontSize: 15, fontWeight: '500' }}>
              {'אולי אחר כך'}
            </Text>
          </Pressable>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
