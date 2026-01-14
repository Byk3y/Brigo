import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useStore } from '@/lib/store';
import { SourcesTab } from '@/components/notebook/SourcesTab';
import { ChatTab } from '@/components/notebook/ChatTab';
import { StudioTab } from '@/components/notebook/StudioTab';
import { useTheme, getThemeColors } from '@/lib/ThemeContext';
import { LockedNotebookOverlay } from '@/components/upgrade/LockedNotebookOverlay';
import { SUBSCRIPTION_CONSTANTS } from '@/lib/constants';
import { NotebookHeader } from '@/components/notebook/NotebookHeader';
import { NotebookTabBar, type TabType } from '@/components/notebook/NotebookTabBar';
import { RenameNotebookModal } from '@/components/notebook/RenameNotebookModal';
import { useNotebookDetail } from '@/hooks/useNotebookDetail';
import { useNotebookSubscription } from '@/hooks/useNotebookSubscription';
import { useNotebookAccess } from '@/hooks/useNotebookAccess';
import { useNotebookActions } from '@/hooks/useNotebookActions';
import { useMaterialAddition } from '@/lib/hooks/useMaterialAddition';
import MaterialTypeSelector from '@/components/MaterialTypeSelector';
import TextInputModal from '@/components/TextInputModal';
import { TikTokLoader } from '@/components/TikTokLoader';
import { UpgradeModal } from '@/components/upgrade/UpgradeModal';
import { useUpgrade } from '@/lib/hooks/useUpgrade';

export default function NotebookDetailScreen() {
  const router = useRouter();
  const { id, tab } = useLocalSearchParams<{ id: string; tab?: string }>();
  const { user, flashcardsStudied, notebooks } = useStore();
  const [activeTab, setActiveTab] = useState<TabType>((tab as TabType) || 'chat');
  const [triggerQuizGeneration, setTriggerQuizGeneration] = useState(false);

  // Set initial tab if provided in params
  React.useEffect(() => {
    if (tab && (tab === 'sources' || tab === 'chat' || tab === 'studio')) {
      setActiveTab(tab as TabType);
    }
  }, [tab]);


  // Load notebook data
  const { notebook, loading, setNotebook } = useNotebookDetail(id);

  // Set up real-time subscription
  useNotebookSubscription(id, setNotebook);

  // Check access control
  const { showLockedOverlay, setShowLockedOverlay } = useNotebookAccess(id);

  // Material Addition Logic (Hoisted to parent to survive tab switches)
  const {
    isAddingMaterial,
    handleAudioUpload,
    handlePDFUpload,
    handlePhotoUpload,
    handleCameraUpload,
    handleTextSave,
    handleYouTubeImport,
    handleWebsiteImport,
    handleRetryMaterial,
    showUpgradeModal: showAddUpgradeModal,
    setShowUpgradeModal: setShowAddUpgradeModal,
    limitReason,
  } = useMaterialAddition(id || '');

  const { trackUpgradeModalDismissed } = useUpgrade();

  // Modal states for material addition
  const [showMaterialSelector, setShowMaterialSelector] = useState(false);
  const [showTextInput, setShowTextInput] = useState(false);
  const [textInputType, setTextInputType] = useState<'text' | 'note'>('text');

  const handleMaterialTypeSelected = async (
    type: 'pdf' | 'audio' | 'image' | 'website' | 'youtube' | 'copied-text',
    providedUrl?: string
  ) => {
    switch (type) {
      case 'pdf': await handlePDFUpload(); break;
      case 'image': await handlePhotoUpload(); break;
      case 'audio': await handleAudioUpload(); break;
      case 'website':
        if (providedUrl) {
          await handleWebsiteImport(providedUrl);
        } else {
          Alert.prompt('Import Website', 'Paste URL below', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Import', onPress: (url: string | undefined) => url && handleWebsiteImport(url) }
          ], 'plain-text');
        }
        break;
      case 'youtube':
        if (providedUrl) await handleYouTubeImport(providedUrl);
        else {
          Alert.prompt('Import YouTube', 'Paste URL below', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Import', onPress: (url: string | undefined) => url && handleYouTubeImport(url) }
          ], 'plain-text');
        }
        break;
      case 'copied-text':
        setTextInputType('text');
        setShowTextInput(true);
        break;
    }
  };

  const onTextSave = async (title: string, content: string) => {
    await handleTextSave(title, content, textInputType);
    setShowTextInput(false);
  };

  // Notebook actions
  const {
    handleTakeQuiz,
    handleMenuPress,
    handleRenameNotebook,
    handleSaveRename,
    renameModalVisible,
    setRenameModalVisible,
    renameValue,
    setRenameValue,
  } = useNotebookActions(notebook, id, setNotebook, setActiveTab, setTriggerQuizGeneration);

  // Theme
  const { isDarkMode } = useTheme();
  const colors = getThemeColors(isDarkMode);

  // Loading state
  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#6366f1" />
          <Text style={{ color: colors.textSecondary, marginTop: 16, fontFamily: 'Nunito-Regular' }}>
            Loading notebook...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // Not found state
  if (!notebook) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 }}>
          <Text style={{ fontSize: 24 }}>📚</Text>
          <Text style={{ fontSize: 18, fontFamily: 'Nunito-SemiBold', color: colors.text, marginTop: 16 }}>
            Notebook not found
          </Text>
          <Text style={{ color: colors.textSecondary, marginTop: 8, textAlign: 'center', fontFamily: 'Nunito-Regular' }}>
            This notebook may have been deleted or doesn't exist.
          </Text>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ marginTop: 24, backgroundColor: '#3B82F6', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 }}
          >
            <Text style={{ color: '#FFFFFF', fontFamily: 'Nunito-SemiBold' }}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      {/* Header */}
      <NotebookHeader
        title={notebook.title}
        onBack={() => router.back()}
        onMenuPress={handleMenuPress}
      />

      {/* Tab Content */}
      <View style={{ flex: 1 }}>
        {activeTab === 'sources' && (
          <SourcesTab
            notebook={notebook}
            onAddPress={() => setShowMaterialSelector(true)}
            onCameraPress={handleCameraUpload}
            onRetryMaterial={handleRetryMaterial}
            isAddingMaterial={isAddingMaterial}
          />
        )}
        {activeTab === 'chat' && <ChatTab notebook={notebook} onTakeQuiz={handleTakeQuiz} />}
        {activeTab === 'studio' && (
          <StudioTab
            notebook={notebook}
            onGenerateQuiz={triggerQuizGeneration ? () => { } : undefined}
          />
        )}
      </View>

      {/* Tab Bar */}
      <NotebookTabBar activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Rename Modal */}
      <RenameNotebookModal
        visible={renameModalVisible}
        value={renameValue}
        onValueChange={setRenameValue}
        onSave={handleSaveRename}
        onDismiss={setRenameModalVisible}
      />

      {/* Shared Modals for Material Addition */}
      <MaterialTypeSelector
        visible={showMaterialSelector}
        onClose={() => setShowMaterialSelector(false)}
        onSelectType={handleMaterialTypeSelected}
        notebookId={id}
      />

      <TextInputModal
        visible={showTextInput}
        type={textInputType}
        onClose={() => setShowTextInput(false)}
        onSave={onTextSave}
      />

      <UpgradeModal
        visible={showAddUpgradeModal}
        onDismiss={() => {
          trackUpgradeModalDismissed('create_attempt');
          setShowAddUpgradeModal(false);
        }}
        source="create_attempt"
        notebooksCount={notebooks.length}
        flashcardsStudied={flashcardsStudied}
        streakDays={user.streak || 0}
        petName={user.name || 'Sparky'}
        petLevel={Math.floor((user.streak || 0) / 7) + 1}
        limitReason={limitReason}
      />

      {/* Locked Notebook Overlay */}
      <LockedNotebookOverlay
        visible={showLockedOverlay}
        totalNotebooks={notebooks.length}
        notebookId={id}
        delayMs={SUBSCRIPTION_CONSTANTS.LOCKED_NOTEBOOK_OVERLAY_DELAY_MS}
        onUpgrade={() => {
          setShowLockedOverlay(false);
          router.push('/upgrade');
        }}
        onDismiss={() => setShowLockedOverlay(false)}
      />
    </SafeAreaView>
  );
}
