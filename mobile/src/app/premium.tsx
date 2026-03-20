import React, { useEffect } from 'react';
import { useRouter } from 'expo-router';

// The app is free — redirect back home immediately
export default function PremiumScreen() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/(tabs)/' as never);
  }, [router]);

  return null;
}
