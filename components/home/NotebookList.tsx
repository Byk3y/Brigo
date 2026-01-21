/**
 * Notebook list component for home screen
 * Renders ScrollView with notebooks, banners, and refresh control
 */

import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, Platform } from 'react-native';
import { NotebookCard } from '@/components/NotebookCard';
import { LimitedAccessBanner } from '@/components/upgrade/LimitedAccessBanner';
import { StreakFreezeBanner } from '@/components/home/StreakFreezeBanner';
import { AddNotebookCard } from '@/components/home/AddNotebookCard';
import { TikTokLoader } from '@/components/TikTokLoader';
import { useTheme, getThemeColors } from '@/lib/ThemeContext';
import { ResponsiveContainer } from '@/lib/components/ResponsiveContainer';
import type { Notebook } from '@/lib/store';

interface NotebookListProps {
  notebooks: Notebook[];
  isRefreshing: boolean;
  onRefresh: () => void;
  onNotebookPress: (id: string) => void;
  onCreateNotebook: () => void;
  notebooksCount: number;
  streakDays: number;
  showLimitedAccess: boolean;
  accessibleCount: number;
  totalCount: number;
  onUpgrade: () => void;
  showStreakRestore?: boolean;
  previousStreak?: number;
  freezesLeft?: number;
  onApplyFreeze?: () => Promise<void>;
  onDismissStreakRestore?: () => void;
}

export function NotebookList({
  notebooks,
  isRefreshing,
  onRefresh,
  onNotebookPress,
  onCreateNotebook,
  notebooksCount,
  streakDays,
  showLimitedAccess,
  accessibleCount,
  totalCount,
  onUpgrade,
  showStreakRestore,
  previousStreak = 0,
  freezesLeft = 0,
  onApplyFreeze,
  onDismissStreakRestore,
}: NotebookListProps) {
  const { isDarkMode } = useTheme();
  const colors = getThemeColors(isDarkMode);
  const isPad = Platform.OS === 'ios' && Platform.isPad;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{
        paddingHorizontal: 24,
        paddingTop: 4,
        paddingBottom: 160,
        flexGrow: 1, // allow pull-to-refresh from anywhere
      }}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={onRefresh}
          tintColor="transparent"
          colors={['transparent']}
          style={{ backgroundColor: 'transparent' }}
        />
      }
    >
      <ResponsiveContainer maxWidth={isPad ? 900 : 500}>
        {isRefreshing && (
          <View style={{ alignItems: 'center', paddingVertical: 12 }}>
            <TikTokLoader size={10} color="#6366f1" containerWidth={60} />
          </View>
        )}

        {/* Streak Freeze Banner */}
        {showStreakRestore && onApplyFreeze && onDismissStreakRestore && (
          <StreakFreezeBanner
            previousStreak={previousStreak}
            freezesLeft={freezesLeft}
            onFreeze={onApplyFreeze}
            onDismiss={onDismissStreakRestore}
          />
        )}

        {/* Limited Access Banner (subscription expired) */}
        {showLimitedAccess && (
          <LimitedAccessBanner
            accessibleCount={accessibleCount}
            totalCount={totalCount}
            onUpgrade={onUpgrade}
          />
        )}

        {/* Notebook Cards */}
        <View style={isPad ? { flexDirection: 'row', flexWrap: 'wrap', gap: 20 } : null}>
          {/* Add Notebook Card (Always on iPad, or if empty on mobile) */}
          {((notebooks.length === 0 && !isRefreshing) || isPad) && (
            <AddNotebookCard onPress={onCreateNotebook} />
          )}
          {notebooks.map((notebook) => (
            <NotebookCard
              key={notebook.id}
              notebook={notebook}
              onPress={() => onNotebookPress(notebook.id)}
            />
          ))}
        </View>
      </ResponsiveContainer>
    </ScrollView>
  );
}
