/**
 * Study Pals Screen
 */

import React, { useEffect, useCallback, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Share,
  Alert,
  StyleSheet,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useStore } from '@/lib/store';
import { useTheme, getThemeColors } from '@/lib/ThemeContext';
import { BrigoAvatar } from '@/components/BrigoAvatar';
import { ResponsiveContainer } from '@/lib/components/ResponsiveContainer';
import type { FriendStreak } from '@/lib/services/friendService';

const MAX_FRIENDS = 5;

export default function FriendsScreen() {
  const { isDarkMode } = useTheme();
  const colors = getThemeColors(isDarkMode);
  const [nudgingId, setNudgingId] = useState<string | null>(null);
  const insets = useSafeAreaInsets();
  // Android formSheet renders in a Dialog where SafeAreaView's bottom inset is 0,
  // so the gesture bar overlaps the invite button. Enforce a minimum clearance.
  const bottomPad = Platform.OS === 'android' ? Math.max(insets.bottom, 28) : 24;

  const {
    friends,
    loadFriendStreaks,
    createFriendInvite,
    removeFriend,
    nudgeFriend,
  } = useStore();

  useEffect(() => {
    loadFriendStreaks();
  }, []);

  const handleInvite = useCallback(async () => {
    const result = await createFriendInvite();
    if (result.success && result.invite_code) {
      await Share.share({
        message: `Study with me on Brigo and keep our streak alive! 🔥\n\nhttps://brigo.app/invite/${result.invite_code}`,
      });
    } else {
      Alert.alert('Error', result.error || 'Failed to create invite');
    }
  }, [createFriendInvite]);

  const handleNudge = useCallback(async (friendStreakId: string, friendName: string) => {
    setNudgingId(friendStreakId);
    try {
      const result = await nudgeFriend(friendStreakId);
      if (result.success) {
        Alert.alert('Nudged!', `${friendName} will get a reminder to study`);
      } else {
        Alert.alert('Oops', result.error || 'Could not nudge');
      }
    } finally {
      setNudgingId(null);
    }
  }, [nudgeFriend]);

  const handleRemove = useCallback((friendStreakId: string, friendName: string) => {
    Alert.alert(
      'Remove Study Pal',
      `Remove ${friendName}? Your shared streak will be lost.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => removeFriend(friendStreakId) },
      ]
    );
  }, [removeFriend]);

  const slotsRemaining = MAX_FRIENDS - friends.length;
  const hasFriends = friends.length > 0;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <SafeAreaView edges={Platform.OS === 'android' ? ['top'] : ['top', 'bottom']}>
        {/* Header — no back button (sheet has grabber) */}
        <ResponsiveContainer maxWidth={560}>
          <View style={styles.header}>
            <Text style={[styles.headerTitle, { color: colors.text }]}>Study Pals</Text>
            {hasFriends && (
              <View style={[styles.countPill, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)' }]}>
                <Text style={[styles.countText, { color: colors.textSecondary }]}>{friends.length}/{MAX_FRIENDS}</Text>
              </View>
            )}
          </View>
        </ResponsiveContainer>

        <ResponsiveContainer maxWidth={560} style={styles.scrollContent}>
          {/* Empty State */}
          {!hasFriends && (
            <View style={styles.emptyContainer}>
              <View style={[styles.emptyCard, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.02)' }]}>
                <View style={styles.emptyAvatarStack}>
                  <View style={[styles.emptyAvatar, { backgroundColor: isDarkMode ? '#3B3B4F' : '#E5E7EB' }]}>
                    <Ionicons name="person" size={18} color={isDarkMode ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)'} />
                  </View>
                  <View style={[styles.emptyAvatar, { marginLeft: -14, backgroundColor: isDarkMode ? '#4B3B5F' : '#DDD5EB' }]}>
                    <Ionicons name="person" size={18} color={isDarkMode ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)'} />
                  </View>
                </View>
                <Text style={[styles.emptyTitle, { color: colors.text }]}>Study better together</Text>
                <Text style={[styles.emptyDesc, { color: colors.textSecondary }]}>
                  Invite a friend and keep each other accountable.{'\n'}Both study daily to grow your shared streak.
                </Text>
                <View style={styles.steps}>
                  {[
                    { icon: 'link-outline' as const, label: 'Share your invite link' },
                    { icon: 'flame-outline' as const, label: 'Both study every day' },
                    { icon: 'trending-up-outline' as const, label: 'Streak grows together' },
                  ].map((s, i) => (
                    <View key={i} style={styles.stepRow}>
                      <View style={[styles.stepDot, { backgroundColor: isDarkMode ? 'rgba(255,140,0,0.15)' : 'rgba(255,95,6,0.1)' }]}>
                        <Ionicons name={s.icon} size={14} color="#FF5F06" />
                      </View>
                      <Text style={[styles.stepLabel, { color: colors.textSecondary }]}>{s.label}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          )}

          {/* Friend Cards */}
          {hasFriends && (
            <View style={{ paddingTop: 4 }}>
              {friends.map((fs: FriendStreak) => {
                const { friend, streak } = fs;
                const avatarIdentifier = friend.avatar_url || friend.id;
                const name = friend.first_name || friend.name || 'Friend';
                const studied = friend.studied_today;
                const ringColor = studied ? '#22C55E' : '#F59E0B';

                // Check if we should show a restart banner (died within last 48 hours, streak was 7+)
                const lostStreak = fs.meta?.last_lost_streak ?? 0;
                const diedAt = fs.meta?.died_at;
                const showRestartBanner =
                  lostStreak > 0 &&
                  !!diedAt &&
                  (Date.now() - new Date(diedAt).getTime()) < 48 * 60 * 60 * 1000;

                return (
                  <View key={fs.id}>
                    {/* Restart banner — shown above card if streak recently died */}
                    {showRestartBanner && (
                      <View
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          backgroundColor: isDarkMode ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.08)',
                          borderRadius: 14,
                          paddingHorizontal: 14,
                          paddingVertical: 10,
                          marginBottom: 6,
                          gap: 10,
                          borderWidth: 1,
                          borderColor: isDarkMode ? 'rgba(239,68,68,0.25)' : 'rgba(239,68,68,0.18)',
                        }}
                      >
                        <Text style={{ fontSize: 18 }}>💔</Text>
                        <View style={{ flex: 1 }}>
                          <Text
                            style={{
                              fontSize: 13,
                              fontFamily: 'Outfit-SemiBold',
                              color: isDarkMode ? '#FCA5A5' : '#DC2626',
                            }}
                            numberOfLines={1}
                          >
                            Your {lostStreak}-day streak ended
                          </Text>
                          <Text
                            style={{
                              fontSize: 12,
                              fontFamily: 'Outfit-Regular',
                              color: isDarkMode ? 'rgba(252,165,165,0.75)' : 'rgba(220,38,38,0.75)',
                              marginTop: 1,
                            }}
                            numberOfLines={1}
                          >
                            Study today to start fresh with {name}
                          </Text>
                        </View>
                      </View>
                    )}

                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        width: '100%',
                        padding: 14,
                        borderRadius: 18,
                        borderWidth: 1,
                        marginBottom: 10,
                        backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : '#FFFFFF',
                        borderColor: isDarkMode ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                      }}
                    >
                    {/* LEFT: Avatar + name/meta (flex:1 so it takes remaining width) */}
                    <Pressable
                      onLongPress={() => handleRemove(fs.id, name)}
                      style={{
                        flex: 1,
                        flexDirection: 'row',
                        alignItems: 'center',
                        minWidth: 0,
                      }}
                    >
                      {/* Avatar with studied-state ring */}
                      <View
                        style={{
                          width: 56,
                          height: 56,
                          borderRadius: 28,
                          borderWidth: 2.5,
                          borderColor: ringColor,
                          padding: 2,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <BrigoAvatar
                          identifier={avatarIdentifier}
                          size={46}
                          containerStyle={{ backgroundColor: '#E5E7EB' }}
                        />
                      </View>

                      {/* Middle: Name + streak chip + status */}
                      <View style={{ flex: 1, minWidth: 0, marginLeft: 12 }}>
                        <Text
                          style={{ fontSize: 16, fontFamily: 'Outfit-Bold', marginBottom: 5, letterSpacing: -0.2, color: colors.text }}
                          numberOfLines={1}
                        >
                          {name}
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <View
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              paddingHorizontal: 9,
                              paddingVertical: 4,
                              borderRadius: 9,
                              backgroundColor: 'rgba(255,95,6,0.12)',
                              marginRight: 8,
                            }}
                          >
                            <Ionicons name="flame" size={13} color="#FF5F06" />
                            <Text style={{ fontSize: 15, fontFamily: 'Nunito-Bold', color: '#FF5F06', marginLeft: 4 }}>
                              {streak}
                            </Text>
                          </View>
                          <Text
                            style={{ fontSize: 12, fontFamily: 'Outfit-Medium', color: colors.textMuted, flexShrink: 1 }}
                            numberOfLines={1}
                          >
                            {studied ? 'Studied today' : 'Not yet today'}
                          </Text>
                        </View>
                      </View>
                    </Pressable>

                    {/* RIGHT: Nudge rectangle button or Done check badge */}
                    {!studied ? (
                      <View
                        style={{
                          backgroundColor: isDarkMode ? '#FFFFFF' : '#111111',
                          borderRadius: 12,
                          marginLeft: 10,
                          overflow: 'hidden',
                          opacity: nudgingId === fs.id ? 0.7 : 1,
                        }}
                      >
                        <Pressable
                          onPress={() => handleNudge(fs.id, name)}
                          disabled={nudgingId === fs.id}
                          style={{
                            paddingHorizontal: 18,
                            paddingVertical: 11,
                            minWidth: 88,
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                          hitSlop={8}
                        >
                          <Text
                            style={{
                              fontSize: 13,
                              fontFamily: 'Outfit-Bold',
                              color: isDarkMode ? '#111111' : '#FFFFFF',
                              letterSpacing: -0.1,
                            }}
                          >
                            Nudge
                          </Text>
                        </Pressable>
                      </View>
                    ) : (
                      <View
                        style={{
                          width: 38,
                          height: 38,
                          borderRadius: 19,
                          backgroundColor: '#22C55E',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginLeft: 10,
                          shadowColor: '#22C55E',
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: 0.3,
                          shadowRadius: 5,
                          elevation: 3,
                        }}
                      >
                        <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                      </View>
                    )}
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </ResponsiveContainer>

        {/* Inline Invite */}
        {slotsRemaining > 0 && (
          <ResponsiveContainer maxWidth={560}>
            <View style={[styles.bottom, { borderTopColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', paddingBottom: bottomPad }]}>
              <Pressable onPress={handleInvite} style={styles.inviteWrap}>
                <LinearGradient
                  colors={['#FF6B1A', '#FF5F06']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.inviteBtn}
                >
                  <Ionicons name="paper-plane" size={17} color="#FFF" />
                  <Text style={styles.inviteText}>Invite a Study Pal</Text>
                </LinearGradient>
              </Pressable>
              {hasFriends && (
                <Text style={[styles.slotsText, { color: colors.textMuted }]}>
                  {slotsRemaining} {slotsRemaining === 1 ? 'slot' : 'slots'} remaining
                </Text>
              )}
            </View>
          </ResponsiveContainer>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {},

  // Header
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 16, paddingBottom: 18 },
  headerTitle: { fontSize: 26, fontFamily: 'Outfit-Bold', letterSpacing: -0.5 },
  countPill: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12 },
  countText: { fontSize: 13, fontFamily: 'Outfit-SemiBold' },

  // Content
  scrollContent: { paddingHorizontal: 16 },

  // Empty
  emptyContainer: { paddingTop: 20 },
  emptyCard: { borderRadius: 24, padding: 28, alignItems: 'center' },
  emptyAvatarStack: { flexDirection: 'row', marginBottom: 20 },
  emptyAvatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: 'transparent' },
  emptyTitle: { fontSize: 20, fontFamily: 'Nunito-Bold', marginBottom: 8 },
  emptyDesc: { fontSize: 14, lineHeight: 20, textAlign: 'center', marginBottom: 24, paddingHorizontal: 4 },
  steps: { width: '100%', gap: 12 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepDot: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  stepLabel: { fontSize: 14, fontFamily: 'Outfit-Medium' },

  // Bottom invite (inline)
  bottom: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 24, borderTopWidth: 1, alignItems: 'center' },
  inviteWrap: { width: '100%', borderRadius: 16, overflow: 'hidden' },
  inviteBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, gap: 8 },
  inviteText: { color: '#FFF', fontSize: 16, fontFamily: 'Outfit-Bold', letterSpacing: -0.2 },
  slotsText: { fontSize: 12, fontFamily: 'Outfit-Medium', marginTop: 8 },
});
