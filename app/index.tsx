/**
 * Home Screen - Notebook List (NotebookLM style)
 * Shows empty state or list of study notebooks
 */

import React, { useState } from 'react';
import { View, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useSegments } from 'expo-router';
import { useStore } from '@/lib/store';
import { useNotebookCreation } from '@/lib/hooks/useNotebookCreation';
import { PetBubble } from '@/components/PetBubble';
import MaterialTypeSelector from '@/components/MaterialTypeSelector';
import TextInputModal from '@/components/TextInputModal';
import { TikTokLoader } from '@/components/TikTokLoader';
import { HomeHeader } from '@/components/home/HomeHeader';
import { HomeActionButtons } from '@/components/home/HomeActionButtons';
import { HomeEmptyState } from '@/components/home/HomeEmptyState';
import { NotebookList } from '@/components/home/NotebookList';
import { useTheme, getThemeColors } from '@/lib/ThemeContext';
import { UpgradeModal } from '@/components/upgrade/UpgradeModal';
import { useUpgrade } from '@/lib/hooks/useUpgrade';
import { useHomeSubscriptions } from '@/hooks/useHomeSubscriptions';
import { useHomeNavigation } from '@/hooks/useHomeNavigation';
import { useTrialSubscriptionUI } from '@/hooks/useTrialSubscriptionUI';
import { useNotebookList } from '@/hooks/useNotebookList';
import { useHomeAnalytics } from '@/hooks/useHomeAnalytics';
import { PendingSyncIndicator } from '@/components/PendingSyncIndicator';

export default function HomeScreen() {
  const router = useRouter();
  const segments = useSegments();
  const {
    notebooks,
    loadNotebooks,
    authUser,
    isInitialized,
    notebooksSyncedAt,
    notebooksUserId,
    user,
    dailyTasks,
    flashcardsStudied,
    showStreakRestoreModal,
    previousStreakForRestore,
    setShowStreakRestoreModal,
    applyStreakFreeze,
  } = useStore();

  // Theme
  const { isDarkMode } = useTheme();
  const colors = getThemeColors(isDarkMode);

  // Custom Hook for creation logic
  const {
    isAddingNotebook,
    handleAudioUpload,
    handlePDFUpload,
    handlePhotoUpload,
    handleCameraUpload,
    handleTextSave,
    handleYouTubeImport,
    handleWebsiteImport,
    showUpgradeModal: showCreateUpgradeModal,
    setShowUpgradeModal: setShowCreateUpgradeModal,
    upgradeModalProps,
  } = useNotebookCreation();

  // Navigation with flash prevention
  const { navigateToNotebook, isNavigatingRef } = useHomeNavigation();

  // Real-time subscriptions (needs navigation ref to prevent flash)
  useHomeSubscriptions(isNavigatingRef);

  // Trial/subscription UI state
  const {
    showTrialReminder,
    showUpgradeModal,
    showLimitedAccess,
    daysRemaining,
    accessibleCount,
    totalCount,
    setShowTrialReminder,
    setShowUpgradeModal,
  } = useTrialSubscriptionUI(notebooks);

  // Notebook list filtering and sorting
  const { accessibleNotebooks } = useNotebookList({
    notebooks,
    showLimitedAccess,
  });

  // Analytics tracking
  useHomeAnalytics();

  // Analytics tracking functions
  const { trackUpgradeModalDismissed } = useUpgrade();

  // Refresh state
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Modal states
  const [showMaterialSelector, setShowMaterialSelector] = useState(false);
  const [showTextInput, setShowTextInput] = useState(false);
  const [textInputType, setTextInputType] = useState<'text' | 'note'>('text');

  const handleCreateNotebook = () => {
    setShowMaterialSelector(true);
  };

  const handleMaterialTypeSelected = async (
    type: 'pdf' | 'audio' | 'image' | 'website' | 'youtube' | 'copied-text',
    providedUrl?: string
  ) => {
    let newNotebookId: string | null | undefined = null;

    switch (type) {
      case 'pdf':
        newNotebookId = await handlePDFUpload();
        break;
      case 'image':
        newNotebookId = await handlePhotoUpload();
        break;
      case 'audio':
        newNotebookId = await handleAudioUpload();
        break;
      case 'website':
        if (providedUrl) {
          newNotebookId = await handleWebsiteImport(providedUrl);
        } else {
          Alert.prompt(
            'Import Website',
            'Paste the website URL below',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Import',
                onPress: async (url: string | undefined) => {
                  if (url) {
                    const id = await handleWebsiteImport(url);
                    if (id) navigateToNotebook(id);
                  }
                }
              }
            ],
            'plain-text'
          );
        }
        break;
      case 'youtube':
        if (providedUrl) {
          newNotebookId = await handleYouTubeImport(providedUrl);
        } else {
          // If no URL provided (clicked the icon), prompt for it
          Alert.prompt(
            'Import YouTube Video',
            'Paste the YouTube video URL below',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Import',
                onPress: async (url: string | undefined) => {
                  if (url) {
                    const id = await handleYouTubeImport(url);
                    if (id) navigateToNotebook(id);
                  }
                }
              }
            ],
            'plain-text'
          );
        }
        break;
      case 'copied-text':
        setTextInputType('text');
        setShowTextInput(true);
        break;
    }

    if (newNotebookId) {
      navigateToNotebook(newNotebookId);
    }
  };

  const onTextSave = async (title: string, content: string) => {
    const newNotebookId = await handleTextSave(title, content, textInputType);
    setShowTextInput(false);
    if (newNotebookId) {
      navigateToNotebook(newNotebookId);
    }
  };

  const onScanNotes = async () => {
    const newNotebookId = await handleCameraUpload();
    if (newNotebookId) {
      navigateToNotebook(newNotebookId);
    }
  };

  const handleNotebookPress = (notebookId: string) => {
    navigateToNotebook(notebookId);
  };

  const handleRefresh = async () => {
    if (!authUser) return;
    try {
      setIsRefreshing(true);
      await loadNotebooks();
    } catch (e) {
      console.error('Refresh failed', e);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Fast-path render: if we have a recent cache for this user, show it immediately
  const isNotebookCacheFresh =
    !!authUser &&
    notebooksUserId === authUser.id &&
    typeof notebooksSyncedAt === 'number' &&
    Date.now() - notebooksSyncedAt < 24 * 60 * 60 * 1000; // 24h freshness window

  const canShowContent = authUser ? isInitialized || isNotebookCacheFresh : false;

  // Show loading state if we're on home route but not signed in (routing will redirect)
  // This prevents "Not Signed In" flash when app loads and routing hasn't redirected yet
  // Check if segments are empty (root route) - routing will redirect to /auth if no user
  const isOnHomeRoute = segments.length < 1 || segments[0] === undefined;
  // Always show loading if on home route without user (routing will handle redirect)
  const shouldShowLoading = isOnHomeRoute && !authUser;

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.background }}
      edges={['top']}
    >
      <HomeHeader />

      {/* Content */}
      {shouldShowLoading ? (
        // Show blank loading state while routing redirects (prevents flash)
        <View style={{ flex: 1, backgroundColor: colors.background }} />
      ) : !canShowContent ? (
        <HomeEmptyState isSignedIn={!!authUser} />
      ) : (
        <NotebookList
          notebooks={accessibleNotebooks}
          isRefreshing={isRefreshing}
          onRefresh={handleRefresh}
          onNotebookPress={handleNotebookPress}
          onCreateNotebook={handleCreateNotebook}
          showTrialReminder={showTrialReminder}
          daysRemaining={daysRemaining}
          notebooksCount={notebooks.length}
          streakDays={user.streak || 0}
          showLimitedAccess={showLimitedAccess}
          accessibleCount={accessibleCount}
          totalCount={totalCount}
          onUpgrade={() => router.push('/upgrade')}
          onDismissTrialReminder={() => setShowTrialReminder(false)}
          showStreakRestore={(() => {
            // Guard: Don't show anything until user is loaded and initialized
            if (!user.id || !isInitialized) return false;
            if (showStreakRestoreModal) return true;

            // Get user's timezone or fall back to device timezone
            const userTz = user.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
            const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: userTz });

            // Safety check for dailyTasks
            const tasks = Array.isArray(dailyTasks) ? dailyTasks : [];
            const secureTask = tasks.find(t => t.task_key === 'secure_pet');

            const isSecuredToday = !!(secureTask?.completed && (
              !secureTask.completed_at || secureTask.completed_at.startsWith(todayStr)
            ));

            const isAtRisk = user.streak > 0 && user.last_streak_date !== todayStr && !isSecuredToday;
            const hasRecoverable = (user.meta?.last_recoverable_streak || 0) > 0;
            return isAtRisk || (user.streak === 0 && hasRecoverable);
          })()}
          previousStreak={previousStreakForRestore || (user.meta?.last_recoverable_streak ?? user.streak)}
          freezesLeft={user.streak_freezes}
          onApplyFreeze={async () => {
            await applyStreakFreeze();
          }}
          onDismissStreakRestore={() => setShowStreakRestoreModal(false)}
        />
      )}

      {/* Loading Overlay */}
      {isAddingNotebook && (
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000,
            pointerEvents: 'none',
          }}
        >
          <View
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: isDarkMode ? 'rgba(17, 24, 39, 0.6)' : 'rgba(255, 255, 255, 0.6)',
            }}
          />
          <TikTokLoader size={16} color="#6366f1" containerWidth={80} />
        </View>
      )}

      {/* Floating Pet */}
      <PetBubble />

      {/* Bottom Action Buttons */}
      <HomeActionButtons
        onCameraPress={onScanNotes}
        onAddPress={handleCreateNotebook}
        bottom={50}
      />

      {/* Pending Sync Indicator */}
      <PendingSyncIndicator />


      {/* Modals */}
      <MaterialTypeSelector
        visible={showMaterialSelector}
        onClose={() => setShowMaterialSelector(false)}
        onSelectType={handleMaterialTypeSelected}
      />

      <TextInputModal
        visible={showTextInput}
        type={textInputType}
        onClose={() => setShowTextInput(false)}
        onSave={onTextSave}
      />

      {/* Upgrade Modal (trial expired on first app open) */}
      <UpgradeModal
        visible={showUpgradeModal && !showCreateUpgradeModal}
        onDismiss={() => {
          trackUpgradeModalDismissed('trial_expired');
          setShowUpgradeModal(false);
        }}
        source="trial_expired"
        notebooksCount={notebooks.length}
        flashcardsStudied={flashcardsStudied}
        streakDays={user.streak || 0}
        petName={user.name || 'Sparky'}
        petLevel={Math.floor((user.streak || 0) / 7) + 1} // Simple level calculation
      />

      {/* Upgrade Modal (create attempt blocked) */}
      <UpgradeModal
        visible={showCreateUpgradeModal}
        onDismiss={() => {
          trackUpgradeModalDismissed('create_attempt');
          setShowCreateUpgradeModal(false);
        }}
        source="create_attempt"
        {...upgradeModalProps}
      />
    </SafeAreaView>
  );
}
