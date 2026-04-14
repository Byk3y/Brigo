/**
 * Friend Invite Deep-Link Handler
 * Receives https://brigo.app/invite/:code, stashes the code for useInviteHandler
 * to accept post-auth, then redirects home.
 */

import React, { useEffect } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useStore } from '@/lib/store';

export default function InviteScreen() {
  const router = useRouter();
  const { code } = useLocalSearchParams<{ code: string }>();

  useEffect(() => {
    const normalized = code?.trim().toUpperCase();
    if (normalized) {
      useStore.getState().setPendingInviteCode(normalized, 'deeplink');
    }
    router.replace('/');
  }, [code]);

  return (
    <View className="flex-1 items-center justify-center bg-neutral-50">
      <ActivityIndicator size="large" color="#FF5F06" />
      <Text className="mt-4 text-neutral-600">Opening invite…</Text>
    </View>
  );
}
