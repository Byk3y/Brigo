/**
 * Source Viewer Screen
 * Displays the full extracted content of a material source
 * Similar to NotebookLM's source detail view - plain text, no clickable links
 */

import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
    StyleSheet,
    Linking,
    Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, getThemeColors } from '@/lib/ThemeContext';
import { supabase } from '@/lib/supabase';

/**
 * Clean extracted content for display
 * Removes markdown syntax, URLs, and formatting artifacts
 * to produce clean, readable text like NotebookLM
 */
function cleanContentForDisplay(content: string): string {
    if (!content) return '';

    let cleaned = content
        // Remove markdown links [text](url) -> text
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        // Remove standalone URLs (http/https)
        .replace(/https?:\/\/[^\s\)]+/g, '')
        // Remove markdown images ![alt](url)
        .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
        // Remove bold/italic markers
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .replace(/\*([^*]+)\*/g, '$1')
        .replace(/__([^_]+)__/g, '$1')
        .replace(/_([^_]+)_/g, '$1')
        // Remove code blocks ```...```
        .replace(/```[\s\S]*?```/g, '')
        // Remove inline code `...`
        .replace(/`([^`]+)`/g, '$1')
        // Remove separator lines (=== --- ___)
        .replace(/^[=\-_]{3,}$/gm, '')
        // Remove markdown headers # ## ### etc
        .replace(/^#{1,6}\s*/gm, '')
        // Remove bullet points * - + at start of lines
        .replace(/^\s*[\*\-\+]\s+/gm, '')
        // Remove numbered lists 1. 2. etc
        .replace(/^\s*\d+\.\s+/gm, '')
        // Remove HTML tags
        .replace(/<[^>]+>/g, '')
        // Remove multiple consecutive blank lines
        .replace(/\n{3,}/g, '\n\n')
        // Remove excessive spaces
        .replace(/[ \t]{2,}/g, ' ')
        // Remove leading/trailing whitespace from lines
        .replace(/^[ \t]+/gm, '')
        .replace(/[ \t]+$/gm, '')
        // Trim overall
        .trim();

    return cleaned;
}

interface MaterialDetail {
    id: string;
    title: string;
    content: string;
    kind: string;
    external_url?: string;
    meta?: {
        domain?: string;
        snippet?: string;
        title?: string;
    };
    created_at: string;
}

export default function SourceViewerScreen() {
    const router = useRouter();
    const { id: materialId } = useLocalSearchParams<{ id: string }>();
    const { isDarkMode } = useTheme();
    const colors = getThemeColors(isDarkMode);

    const [material, setMaterial] = useState<MaterialDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (materialId) {
            loadMaterial();
        }
    }, [materialId]);

    const loadMaterial = async () => {
        try {
            setLoading(true);
            setError(null);

            // SECURITY: Get current user to verify ownership
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                throw new Error('Not authenticated');
            }

            // SECURITY: Only fetch if material belongs to current user (IDOR Prevention)
            const { data, error: fetchError } = await supabase
                .from('materials')
                .select('id, kind, content, external_url, meta, created_at')
                .eq('id', materialId)
                .eq('user_id', user.id)  // IDOR Prevention
                .single();

            if (fetchError) {
                // Don't reveal if material exists but belongs to another user
                throw new Error('Source not found or access denied');
            }

            if (!data) {
                throw new Error('Source not found');
            }

            setMaterial({
                id: data.id,
                title: (data.meta as any)?.title || 'Source',
                content: cleanContentForDisplay(data.content || '') || 'No content extracted yet.',
                kind: data.kind,
                external_url: data.external_url || undefined,
                meta: data.meta as any,
                created_at: data.created_at || new Date().toISOString(),
            });
        } catch (err: any) {
            setError(err.message || 'Failed to load source');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenExternal = () => {
        if (material?.external_url) {
            Linking.openURL(material.external_url);
        }
    };

    const handleShare = async () => {
        if (!material) return;

        try {
            await Share.share({
                title: material.title,
                message: material.external_url || material.title,
                url: material.external_url,
            });
        } catch (err) {
            console.error('Share failed:', err);
        }
    };

    // Loading state
    if (loading) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
                <View style={[styles.header, { borderBottomColor: colors.border }]}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={24} color={colors.text} />
                    </TouchableOpacity>
                </View>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#6366f1" />
                    <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                        Loading source...
                    </Text>
                </View>
            </SafeAreaView>
        );
    }

    // Error state
    if (error || !material) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
                <View style={[styles.header, { borderBottomColor: colors.border }]}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={24} color={colors.text} />
                    </TouchableOpacity>
                </View>
                <View style={styles.loadingContainer}>
                    <Ionicons name="alert-circle" size={48} color={colors.error} />
                    <Text style={[styles.errorTitle, { color: colors.text }]}>
                        Failed to load source
                    </Text>
                    <Text style={[styles.errorText, { color: colors.textSecondary }]}>
                        {error || 'Source not found'}
                    </Text>
                    <TouchableOpacity onPress={() => router.back()} style={styles.retryButton}>
                        <Text style={styles.retryButtonText}>Go Back</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            {/* Header with title */}
            <View style={[styles.header, { borderBottomColor: colors.border }]}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>

                <Text numberOfLines={1} style={[styles.headerTitle, { color: colors.text }]}>
                    {material.title}
                </Text>

                <View style={styles.headerActions}>
                    {material.external_url && (
                        <TouchableOpacity onPress={handleOpenExternal} style={styles.headerActionButton}>
                            <Ionicons name="open-outline" size={22} color={colors.text} />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* Content */}
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Plain text content - like NotebookLM */}
                <Text style={[styles.content, { color: colors.text }]}>
                    {material.content}
                </Text>
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        gap: 12,
    },
    backButton: {
        padding: 4,
    },
    headerTitle: {
        flex: 1,
        fontSize: 17,
        fontFamily: 'Nunito-SemiBold',
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    headerActionButton: {
        padding: 4,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 40,
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        fontFamily: 'Nunito-Regular',
    },
    errorTitle: {
        fontSize: 18,
        fontFamily: 'Nunito-Bold',
        marginTop: 16,
    },
    errorText: {
        fontSize: 14,
        fontFamily: 'Nunito-Regular',
        marginTop: 8,
        textAlign: 'center',
    },
    retryButton: {
        marginTop: 24,
        backgroundColor: '#6366f1',
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 12,
    },
    retryButtonText: {
        color: '#FFFFFF',
        fontFamily: 'Nunito-SemiBold',
        fontSize: 16,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 20,
        paddingBottom: 60,
    },
    content: {
        fontSize: 16,
        fontFamily: 'Nunito-Regular',
        lineHeight: 26,
    },
});
