/**
 * NotebookCard - Card component for notebook list
 * Shows notebook info with progress and last studied
 * Styled to match Studio section cards
 */

import React, { useState } from 'react';
import { TouchableOpacity, View, Text, ActivityIndicator, Platform } from 'react-native';
import { MotiViewCompat as MotiView } from '@/components/MotiViewCompat';
import type { Notebook } from '@/lib/store';
import { getTopicEmoji } from '@/lib/emoji-matcher';
import { supabase } from '@/lib/supabase';
import { useStore } from '@/lib/store';
import { TikTokLoader } from '@/components/TikTokLoader';
import { useTheme, getThemeColors } from '@/lib/ThemeContext';
import { useFeedback } from '@/lib/feedback';
import { useIsNotebookGenerating } from '@/hooks/useIsNotebookGenerating';

interface NotebookCardProps {
    notebook: Notebook;
    onPress: () => void;
    animateEntry?: boolean;
}

export const NotebookCard: React.FC<NotebookCardProps> = ({
    notebook,
    onPress,
    animateEntry = true,
}) => {
    const [isRetrying, setIsRetrying] = useState(false);
    const { notebooks, setNotebooks } = useStore();
    const { isDarkMode } = useTheme();
    const colors = getThemeColors(isDarkMode);
    const { play } = useFeedback();
    const isPad = Platform.OS === 'ios' && Platform.isPad;
    const isGenerating = useIsNotebookGenerating(notebook.id);

    // Simplified theme-aware notebook card background colors
    const getNotebookColor = () => {
        const color = notebook.color || 'blue'; // Default fallback

        const palettes = {
            light: {
                blue: '#dbeafe',
                green: '#d1fae5',
                orange: '#fde68a',
                purple: '#ede9fe',
                pink: '#fecdd3',
            },
            dark: {
                blue: '#3d3d4a',   // Slate blue
                green: '#3d4a3d',  // Olive green
                orange: '#4a4540', // Bronze/brown
                purple: '#453d4a', // Muted purple
                pink: '#4a3d45',   // Muted rose
            }
        };

        const themePalette = isDarkMode ? palettes.dark : palettes.light;
        const colorKey = (color as keyof typeof themePalette) || 'blue';
        return themePalette[colorKey] || themePalette.blue;
    };

    const handleRetry = async (e: any) => {
        // Prevent triggering onPress when clicking retry
        e.stopPropagation();

        if (!notebook.materials?.[0]?.id) {
            console.error('No material ID found for retry');
            return;
        }

        setIsRetrying(true);

        try {
            // Update notebook status to 'extracting' in database
            await supabase
                .from('notebooks')
                .update({ status: 'pending' })
                .eq('id', notebook.id);

            // Update local state
            setNotebooks(
                notebooks.map((n) =>
                    n.id === notebook.id ? { ...n, status: 'pending' as const } : n
                )
            );

            // Create timeout promise
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Retry timeout after 60s')), 60000)
            );

            // Retry Edge Function
            const result = await Promise.race([
                supabase.functions.invoke('process-material', {
                    body: { material_id: notebook.materials[0].id },
                }),
                timeoutPromise,
            ]);

            const { data, error } = result as any;

            if (error) {
                console.error('Failed to retry Edge Function:', error);
                // Update back to failed
                await supabase
                    .from('notebooks')
                    .update({ status: 'failed' })
                    .eq('id', notebook.id);

                setNotebooks(
                    notebooks.map((n) =>
                        n.id === notebook.id ? { ...n, status: 'failed' as const } : n
                    )
                );
            }
        } catch (error) {
            console.error('Error during retry:', error);
            // Update back to failed
            await supabase
                .from('notebooks')
                .update({ status: 'failed' })
                .eq('id', notebook.id);

            setNotebooks(
                notebooks.map((n) =>
                    n.id === notebook.id ? { ...n, status: 'failed' as const } : n
                )
            );
        } finally {
            setIsRetrying(false);
        }
    };

    const getTimeAgoText = () => {
        if (!notebook.createdAt) return 'Just now';

        const createdDate = new Date(notebook.createdAt);
        const now = new Date();
        const diffInMs = now.getTime() - createdDate.getTime();
        const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
        const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
        const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

        if (diffInMinutes < 1) return 'Just now';
        if (diffInMinutes < 60) return `${diffInMinutes} minute${diffInMinutes !== 1 ? 's' : ''} ago`;
        if (diffInHours < 24) return `${diffInHours} hour${diffInHours !== 1 ? 's' : ''} ago`;
        if (diffInDays < 7) return `${diffInDays} day${diffInDays !== 1 ? 's' : ''} ago`;

        // For dates older than a week, show the date
        const months = ['January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'];
        const month = months[createdDate.getMonth()];
        const day = createdDate.getDate();
        const year = createdDate.getFullYear();
        return `${month} ${day}, ${year}`;
    };

    const materialCount = notebook.materials?.length || 0;

    return (
        <MotiView
            from={animateEntry ? { opacity: 0, translateX: -20 } : { opacity: 1, translateX: 0 }}
            animate={{ opacity: 1, translateX: 0 }}
            transition={{ type: 'timing', duration: 300 }}
            style={{
                width: isPad ? '48.5%' : '100%',
                marginBottom: isPad ? 20 : 12,
            }}
        >
            <TouchableOpacity
                onPress={() => {
                    play('start');
                    onPress();
                }}
                activeOpacity={0.7}
                style={{
                    backgroundColor: getNotebookColor(),
                    borderRadius: isPad ? 24 : 16,
                    padding: isPad ? 20 : 16,
                    flexDirection: 'row',
                    alignItems: 'center',
                    width: '100%',
                }}
            >
                {/* Emoji on the left */}
                <View style={{ marginRight: isPad ? 20 : 14 }}>
                    <Text style={{ fontSize: isPad ? 36 : 28 }}>{notebook.emoji || getTopicEmoji(notebook.title)}</Text>
                </View>

                {/* Content */}
                <View style={{ flex: 1 }}>
                    <Text
                        style={{ fontSize: isPad ? 18 : 16, fontFamily: 'Nunito-SemiBold', color: colors.text, marginBottom: isPad ? 4 : 2 }}
                        numberOfLines={1}
                        ellipsizeMode="tail"
                    >
                        {notebook.title}
                    </Text>
                    <Text style={{ fontSize: isPad ? 14 : 13, color: colors.textSecondary, fontFamily: 'Nunito-Regular' }}>
                        {materialCount} source{materialCount !== 1 ? 's' : ''} • {getTimeAgoText()}
                    </Text>

                    {/* Failed status with retry button */}
                    {notebook.status === 'failed' && (
                        <View style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Text style={{ fontSize: 12, color: isDarkMode ? '#f87171' : '#dc2626', fontFamily: 'Nunito-Medium' }}>Processing failed</Text>
                            <TouchableOpacity
                                onPress={handleRetry}
                                disabled={isRetrying}
                                style={{
                                    backgroundColor: isDarkMode ? 'rgba(127, 29, 29, 0.5)' : '#fee2e2',
                                    paddingHorizontal: 12,
                                    paddingVertical: 4,
                                    borderRadius: 999,
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 4
                                }}
                                activeOpacity={0.7}
                            >
                                {isRetrying ? (
                                    <ActivityIndicator size="small" color="#DC2626" />
                                ) : (
                                    <Text style={{ fontSize: 12, color: isDarkMode ? '#f87171' : '#dc2626', fontFamily: 'Nunito-SemiBold' }}>Retry</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                {/* Right side - loader when extracting or pending, else generation dot */}
                {(notebook.status === 'extracting' || notebook.status === 'pending') ? (
                    <View style={{ marginLeft: 12 }}>
                        <TikTokLoader size={10} color="#6366f1" containerWidth={50} />
                    </View>
                ) : isGenerating ? (
                    <View
                        style={{
                            marginLeft: 12,
                            width: 8,
                            height: 8,
                            borderRadius: 4,
                            backgroundColor: colors.primary,
                        }}
                        accessibilityLabel="Generation in progress"
                    />
                ) : null}
            </TouchableOpacity>
        </MotiView>
    );
};
