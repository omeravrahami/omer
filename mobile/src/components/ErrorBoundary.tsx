import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Log to crash reporter if available
    console.error('[ErrorBoundary] Caught error:', error.message, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <SafeAreaView className="flex-1 bg-[#0A0A0F]">
          <View className="flex-1 items-center justify-center px-8">
            <Text className="text-5xl mb-6">⚠️</Text>
            <Text
              className="text-white text-2xl font-bold text-center mb-3"
              style={{ fontFamily: 'System', writingDirection: 'rtl' }}
            >
              אופס, משהו השתבש
            </Text>
            <Text
              className="text-[#888] text-base text-center mb-8 leading-6"
              style={{ writingDirection: 'rtl' }}
            >
              אירעה שגיאה בלתי צפויה. אנחנו מתנצלים על אי הנוחות.
            </Text>
            <Pressable
              onPress={this.handleReset}
              className="bg-[#3B82F6] rounded-2xl px-8 py-4 mb-4 w-full items-center"
              style={({ pressed }) => ({ opacity: pressed ? 0.8 : 1 })}
              testID="error-boundary-retry"
            >
              <Text className="text-white text-base font-bold">נסה שוב</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      );
    }
    return this.props.children;
  }
}
