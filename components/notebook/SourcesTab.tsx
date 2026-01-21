/**
 * SourcesTab - Displays material sources and preview
 * Shows loading state during extraction, preview when ready
 */

import React, { useState, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, StyleSheet, Alert, Modal, Pressable, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import type { Notebook, Material } from '@/lib/store';
import { PreviewSkeleton } from './PreviewSkeleton';
import { storageService } from '@/lib/storage/storageService';
import { useTheme, getThemeColors, getThemeShadows } from '@/lib/ThemeContext';
import { HomeActionButtons } from '@/components/home/HomeActionButtons';
import { TikTokLoader } from '@/components/TikTokLoader';
import { useStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';

interface SourcesTabProps {
  notebook: Notebook;
  onAddPress: () => void;
  onCameraPress: () => void;
  onRetryMaterial?: (materialId: string) => void;
  isAddingMaterial?: boolean; // Phase A: Uploading/Saving
}

export const SourcesTab: React.FC<SourcesTabProps> = ({
  notebook,
  onAddPress,
  onCameraPress,
  onRetryMaterial,
  isAddingMaterial
}) => {
  const isPad = Platform.OS === 'ios' && Platform.isPad;
  const router = useRouter();
  const { isDarkMode } = useTheme();
  const colors = getThemeColors(isDarkMode);
  const shadows = getThemeShadows(isDarkMode);
  const { loadNotebooks } = useStore();
  const [refreshing, setRefreshing] = useState(false);
  const [isDeleteMode, setIsDeleteMode] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Navigation lock to prevent double-tap opening source twice
  const isNavigatingRef = useRef(false);

  const handleManualRefresh = async () => {
    setRefreshing(true);
    await loadNotebooks();
    setRefreshing(false);
  };

  const handleDeleteSource = async (materialId: string, materialTitle: string) => {
    Alert.alert(
      'Delete Source',
      `Are you sure you want to delete "${materialTitle}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeletingId(materialId);

              // SECURITY: Get current user to verify ownership
              const { data: { user } } = await supabase.auth.getUser();
              if (!user) {
                throw new Error('Not authenticated');
              }

              // SECURITY: Only delete if material belongs to current user
              const { error } = await supabase
                .from('materials')
                .delete()
                .eq('id', materialId)
                .eq('user_id', user.id);  // IDOR Prevention

              if (error) throw error;

              // Refresh notebooks to reflect the deletion
              await loadNotebooks();
            } catch (err) {
              console.error('Failed to delete source:', err);
              Alert.alert('Error', 'Failed to delete source. Please try again.');
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]
    );
  };

  const handleMenuPress = () => {
    if (notebook.materials && notebook.materials.length > 0) {
      setShowMenu(true);
    }
  };

  const handleDeleteModeToggle = () => {
    setShowMenu(false);
    setIsDeleteMode(true);
  };

  const handleExitDeleteMode = () => {
    setIsDeleteMode(false);
  };

  const handleViewImage = async (mat: Material) => {
    if (!mat.uri) return;
    const { url, error } = await storageService.getSignedUrl(mat.uri, 3600);
    if (!error && url) {
      router.push({
        pathname: '/image-viewer',
        params: { imageUrl: url, filename: mat.filename || 'Image' },
      });
    }
  };

  const getMaterialIcon = (type?: string) => {
    switch (type) {
      case 'pdf':
        return { name: 'file-pdf-box' as any, color: '#ef4444', library: 'MaterialCommunityIcons' };
      case 'audio':
        return { name: 'musical-notes' as any, color: colors.textSecondary, library: 'Ionicons' };
      case 'image':
      case 'photo':
        return { name: 'image' as any, color: colors.textSecondary, library: 'Ionicons' };
      case 'website':
        return { name: 'newspaper-variant' as any, color: '#3b82f6', library: 'MaterialCommunityIcons' };
      case 'youtube':
        return { name: 'logo-youtube' as any, color: '#ef4444', library: 'Ionicons' };
      default:
        return { name: 'document' as any, color: colors.textSecondary, library: 'Ionicons' };
    }
  };

  const renderIcon = (type?: string, isProcessing?: boolean, isFailed?: boolean) => {
    if (isProcessing) {
      return <TikTokLoader size={10} color="#6366f1" containerWidth={40} />;
    }
    if (isFailed) {
      return <Ionicons name="alert-circle" size={24} color={colors.error} />;
    }

    const config = getMaterialIcon(type);
    if (config.library === 'MaterialCommunityIcons') {
      const IconLib = require('@expo/vector-icons').MaterialCommunityIcons;
      return <IconLib name={config.name} size={24} color={config.color} />;
    }
    if (config.library === 'MaterialIcons') {
      const IconLib = require('@expo/vector-icons').MaterialIcons;
      return <IconLib name={config.name} size={24} color={config.color} />;
    }
    return <Ionicons name={config.name} size={24} color={config.color} />;
  };

  const renderContent = () => {
    // Initial extraction state (no materials yet)
    if (notebook.status === 'extracting' && (!notebook.materials || notebook.materials.length === 0)) {
      return (
        <View style={{ flex: 1, paddingHorizontal: isPad ? 48 : 20, paddingTop: isPad ? 32 : 20 }}>
          <View style={{ maxWidth: isPad ? 800 : '100%', alignSelf: 'center', width: '100%' }}>
            <PreviewSkeleton />
            <View style={{ marginTop: isPad ? 32 : 24 }}>
              <Text style={[styles.sectionTitle, { color: colors.text, fontSize: isPad ? 22 : 18 }]}>Current Sources</Text>
              <View style={[styles.loadingSourceItem, { backgroundColor: colors.surface, borderColor: colors.border, padding: isPad ? 20 : 16 }]}>
                <TikTokLoader size={isPad ? 14 : 12} color="#6366f1" containerWidth={isPad ? 80 : 60} />
                <Text style={{ color: colors.textSecondary, marginLeft: 12, fontSize: isPad ? 17 : 14, fontFamily: 'Nunito-Medium' }}>
                  Uploading and analyzing...
                </Text>
              </View>
            </View>
          </View>
        </View>
      );
    }

    return (
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: isPad ? 48 : 20, paddingBottom: 120, paddingTop: isPad ? 30 : 10 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleManualRefresh} tintColor="#6366f1" />
        }
      >
        <View style={{ maxWidth: isPad ? 800 : '100%', alignSelf: 'center', width: '100%' }}>
          <View style={[styles.header, { marginBottom: isPad ? 32 : 20 }]}>
            <View style={styles.headerLeft}>
              <Text style={[styles.sectionTitle, { color: colors.text, fontSize: isPad ? 22 : 18 }]}>Sources</Text>
            </View>
            {isDeleteMode ? (
              <TouchableOpacity onPress={handleExitDeleteMode} style={styles.doneButton}>
                <Text style={[styles.doneButtonText, { fontSize: isPad ? 17 : 15 }]}>Done</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity onPress={handleMenuPress} style={{ padding: isPad ? 8 : 4 }}>
                <Ionicons name="ellipsis-vertical" size={isPad ? 24 : 20} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>

          {/* Dropdown Menu */}
          <Modal
            visible={showMenu}
            transparent
            animationType="fade"
            onRequestClose={() => setShowMenu(false)}
          >
            <Pressable style={styles.menuOverlay} onPress={() => setShowMenu(false)}>
              <View style={[
                styles.menuContainer,
                {
                  backgroundColor: isDarkMode ? colors.surface : '#FFFFFF',
                  borderColor: colors.border,
                }
              ]}>
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={handleDeleteModeToggle}
                >
                  <Ionicons name="trash-outline" size={18} color={colors.text} />
                  <Text style={[styles.menuItemText, { color: colors.text }]}>Delete a source</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Modal>

          <View style={{ gap: 4 }}>
            {/* Phase A Loading: Uploading (Local State) */}
            {isAddingMaterial && (
              <View style={styles.materialItem}>
                <View style={styles.iconContainer}>
                  <TikTokLoader size={10} color="#6366f1" containerWidth={40} />
                </View>
                <View style={{ flex: 1, marginHorizontal: 8 }}>
                  <Text
                    style={{
                      fontSize: 17,
                      fontFamily: 'Nunito-SemiBold',
                      color: colors.text
                    }}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    Uploading source...
                  </Text>
                </View>
              </View>
            )}

            {/* Phase B Loading: Backend Processing (DB State) */}
            {notebook.materials && notebook.materials.map((mat, index) => {
              const isImage = mat.type === 'image' || mat.type === 'photo';
              const isProcessing = mat.processed === false || mat.status === 'processing';
              const isFailed = mat.status === 'failed';
              const hasContent = mat.status === 'processed' || mat.processed === true;
              const isDeleting = deletingId === mat.id;

              const handleSourcePress = () => {
                // In delete mode, don't navigate
                if (isDeleteMode) return;
                if (isProcessing || isFailed) return;

                // Prevent double-tap navigation
                if (isNavigatingRef.current) return;
                isNavigatingRef.current = true;

                // Reset navigation lock after navigation completes
                setTimeout(() => {
                  isNavigatingRef.current = false;
                }, 1000);

                // For images, open the image viewer
                if (isImage) {
                  handleViewImage(mat);
                  return;
                }

                // For all other sources, open the source content viewer
                router.push({
                  pathname: '/source-viewer',
                  params: { id: mat.id },
                });
              };

              return (
                <TouchableOpacity
                  key={mat.id || index}
                  onPress={handleSourcePress}
                  activeOpacity={isDeleteMode ? 1 : (hasContent ? 0.7 : 1)}
                  style={[styles.materialItem, { opacity: isDeleting ? 0.5 : 1 }]}
                >
                  <View style={styles.iconContainer}>
                    {renderIcon(mat.type, isProcessing, isFailed)}
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text
                      numberOfLines={1}
                      ellipsizeMode="tail"
                      style={[
                        styles.materialTitle,
                        { color: colors.text, opacity: isProcessing ? 0.6 : 1 }
                      ]}
                    >
                      {mat.title || mat.filename || 'Untitled Source'}
                    </Text>
                  </View>
                  {isFailed && !isDeleteMode && (
                    <TouchableOpacity
                      onPress={() => onRetryMaterial?.(mat.id)}
                      style={styles.miniRetryButton}
                    >
                      <Ionicons name="refresh" size={16} color="#FFF" />
                    </TouchableOpacity>
                  )}
                  {hasContent && !isImage && !isDeleteMode && (
                    <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
                  )}
                  {isDeleteMode && (
                    <TouchableOpacity
                      onPress={() => handleDeleteSource(mat.id, mat.title || mat.filename || 'Source')}
                      style={styles.deleteButton}
                      disabled={isDeleting}
                    >
                      {isDeleting ? (
                        <TikTokLoader size={8} color="#ef4444" containerWidth={24} />
                      ) : (
                        <Ionicons name="trash-outline" size={20} color={colors.textSecondary} />
                      )}
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              );
            })}

            {(!isAddingMaterial && (!notebook.materials || notebook.materials.length === 0)) && (
              <View style={[styles.emptyContainer, { backgroundColor: colors.surface, borderColor: colors.border, padding: isPad ? 48 : 32 }]}>
                <Text style={{ fontSize: isPad ? 44 : 32, marginBottom: 12 }}>📥</Text>
                <Text style={[styles.emptyTitle, { color: colors.text, fontSize: isPad ? 20 : 16 }]}>No sources yet</Text>
                <Text style={[styles.emptyText, { color: colors.textSecondary, fontSize: isPad ? 16 : 14 }]}>
                  Add PDFs, notes, or website links to start learning.
                </Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {renderContent()}
      <HomeActionButtons onCameraPress={onCameraPress} onAddPress={onAddPress} />
    </View>
  );
};

const styles = StyleSheet.create({
  sectionTitle: { fontSize: 18, fontFamily: 'Nunito-Bold' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  headerLeft: { flexDirection: 'row', alignItems: 'center' },
  loadingSourceItem: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 12, borderWidth: 1, marginTop: 16 },
  materialItem: { paddingVertical: 12, flexDirection: 'row', alignItems: 'center' },
  iconContainer: { width: 32, height: 32, justifyContent: 'center', alignItems: 'center' },
  materialTitle: { fontSize: 16, fontFamily: 'Nunito-SemiBold' },
  materialSubtitle: { fontSize: 12, fontFamily: 'Nunito-Medium', marginTop: 2 },
  emptyContainer: { borderRadius: 16, padding: 32, alignItems: 'center', borderWidth: 1, borderStyle: 'dashed' },
  emptyTitle: { fontSize: 16, fontFamily: 'Nunito-Bold' },
  emptyText: { fontSize: 14, textAlign: 'center', marginTop: 4, fontFamily: 'Nunito-Regular' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },
  errorTitle: { fontSize: 18, fontFamily: 'Nunito-Bold', textAlign: 'center' },
  errorText: { textAlign: 'center', marginTop: 8, fontFamily: 'Nunito-Regular' },
  retryButton: { marginTop: 24, backgroundColor: '#3B82F6', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  retryButtonText: { color: '#FFFFFF', fontFamily: 'Nunito-SemiBold' },
  miniRetryButton: { backgroundColor: '#6366f1', width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
  // Menu styles
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'flex-start',
    paddingTop: 120,
    paddingRight: 20,
    alignItems: 'flex-end',
  },
  menuContainer: {
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    minWidth: 180,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  menuItemText: {
    fontSize: 15,
    fontFamily: 'Nunito-Medium',
  },
  // Done button styles
  doneButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  doneButtonText: {
    fontSize: 15,
    fontFamily: 'Nunito-SemiBold',
    color: '#3b82f6',
  },
  // Delete button styles
  deleteButton: {
    padding: 8,
    marginLeft: 8,
  },
});
