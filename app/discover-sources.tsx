/**
 * Discover Sources Screen
 * AI-powered source discovery flow using Gemini with Google Search grounding
 */

import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    StyleSheet,
    Platform,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, getThemeColors } from '@/lib/ThemeContext';
import { DiscoveredSourceCard } from '@/components/discover/DiscoveredSourceCard';
import { DiscoverSourcesSkeleton } from '@/components/discover/DiscoverSourcesSkeleton';
import {
    discoverSources,
    importDiscoveredSources,
    DiscoveredSource,
} from '@/lib/services/discoverService';
import { useStore } from '@/lib/store';
import { useFeedback } from '@/lib/feedback';
import { TikTokLoader } from '@/components/TikTokLoader';

const MAX_SOURCES = 5;

export default function DiscoverSourcesScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ query?: string; notebookId?: string }>();
    const { isDarkMode } = useTheme();
    const colors = getThemeColors(isDarkMode);
    const { play, haptic } = useFeedback();
    const { loadNotebooks } = useStore();

    // State
    const [isSearching, setIsSearching] = useState(true);
    const [isImporting, setIsImporting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [summary, setSummary] = useState<string>('');
    const [sources, setSources] = useState<DiscoveredSource[]>([]);
    const [selectedUrls, setSelectedUrls] = useState<Set<string>>(new Set());

    // Search for sources on mount
    useEffect(() => {
        if (params.query) {
            handleSearch(params.query);
        } else {
            setError('No search query provided');
            setIsSearching(false);
        }
    }, [params.query]);

    const handleSearch = async (query: string) => {
        setIsSearching(true);
        setError(null);

        try {
            const result = await discoverSources(query);
            setSummary(result.summary);
            setSources(result.sources);

            // Auto-select all sources by default
            setSelectedUrls(new Set(result.sources.map((s) => s.url)));
        } catch (err: any) {
            console.error('[DiscoverSources] Search error:', err);
            setError(err.message || 'Failed to discover sources');
        } finally {
            setIsSearching(false);
        }
    };

    const handleToggleSource = (url: string) => {
        play('tap');
        setSelectedUrls((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(url)) {
                newSet.delete(url);
            } else if (newSet.size < MAX_SOURCES) {
                newSet.add(url);
            } else {
                // Already at max
                Alert.alert('Limit Reached', `You can select up to ${MAX_SOURCES} sources.`);
            }
            return newSet;
        });
    };

    const handleSelectAll = () => {
        play('tap');
        if (selectedUrls.size === sources.length) {
            // Deselect all
            setSelectedUrls(new Set());
        } else {
            // Select all (up to max)
            const toSelect = sources.slice(0, MAX_SOURCES).map((s) => s.url);
            setSelectedUrls(new Set(toSelect));
        }
    };

    const handleImport = async () => {
        if (selectedUrls.size === 0) {
            Alert.alert('No Sources Selected', 'Please select at least one source to import.');
            return;
        }

        haptic('success');
        setIsImporting(true);

        try {
            const selectedSources = sources.filter((s) => selectedUrls.has(s.url));

            const { notebookId } = await importDiscoveredSources(
                params.notebookId || null,
                selectedSources,
                params.query
            );

            // Refresh notebooks
            await loadNotebooks();

            // Navigate to the notebook sources tab
            router.replace(`/notebook/${notebookId}?tab=sources`);
        } catch (err: any) {
            console.error('[DiscoverSources] Import error:', err);
            Alert.alert('Import Failed', err.message || 'Failed to import sources');
            setIsImporting(false);
        }
    };

    const handleClose = () => {
        play('tap');
        router.back();
    };

    const allSelected = selectedUrls.size === Math.min(sources.length, MAX_SOURCES);

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top', 'bottom']}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={handleClose} style={styles.headerButton}>
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.headerTitle, { color: colors.text }]}>Discover sources</Text>
                <TouchableOpacity onPress={handleClose} style={styles.headerButton}>
                    <Ionicons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
            </View>

            {/* Content */}
            {isSearching ? (
                <View style={styles.searchingContainer}>
                    <View style={styles.searchingHeader}>
                        <TikTokLoader size={16} color={colors.primary} containerWidth={80} />
                        <Text style={[styles.searchingText, { color: colors.textSecondary }]}>
                            Searching for sources...
                        </Text>
                    </View>
                    <DiscoverSourcesSkeleton />
                </View>
            ) : error ? (
                <View style={styles.errorContainer}>
                    <Ionicons name="warning-outline" size={48} color={colors.error} />
                    <Text style={[styles.errorTitle, { color: colors.text }]}>Search Failed</Text>
                    <Text style={[styles.errorText, { color: colors.textSecondary }]}>{error}</Text>
                    <TouchableOpacity
                        onPress={() => params.query && handleSearch(params.query)}
                        style={[styles.retryButton, { backgroundColor: colors.primary }]}
                    >
                        <Text style={styles.retryButtonText}>Try Again</Text>
                    </TouchableOpacity>
                </View>
            ) : sources.length === 0 ? (
                <View style={styles.errorContainer}>
                    <Ionicons name="search-outline" size={48} color={colors.textSecondary} />
                    <Text style={[styles.errorTitle, { color: colors.text }]}>No Sources Found</Text>
                    <Text style={[styles.errorText, { color: colors.textSecondary }]}>
                        Try a different search term or be more specific.
                    </Text>
                </View>
            ) : (
                <View style={{ flex: 1 }}>
                    <ScrollView
                        style={styles.scrollView}
                        contentContainerStyle={styles.scrollContent}
                        showsVerticalScrollIndicator={false}
                    >
                        {/* Summary */}
                        <View style={styles.summaryContainer}>
                            <Text style={[styles.summaryText, { color: colors.textSecondary }]}>
                                {summary}
                            </Text>
                        </View>

                        {/* Rounded List Container */}
                        <View style={[styles.listContainer, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                            {/* Select All */}
                            <TouchableOpacity
                                onPress={handleSelectAll}
                                activeOpacity={0.7}
                                style={[styles.selectAllRow, { borderBottomColor: colors.border }]}
                            >
                                <Text style={[styles.selectAllText, { color: colors.text }]}>Select All</Text>
                                <View
                                    style={[
                                        styles.checkbox,
                                        {
                                            backgroundColor: allSelected ? colors.primary : 'transparent',
                                            borderColor: allSelected ? colors.primary : colors.textMuted,
                                        },
                                    ]}
                                >
                                    {allSelected && <Ionicons name="checkmark-sharp" size={16} color="#FFFFFF" />}
                                </View>
                            </TouchableOpacity>

                            {/* Sources List */}
                            {sources.map((source, index) => (
                                <React.Fragment key={source.url}>
                                    <DiscoveredSourceCard
                                        title={source.title}
                                        domain={source.domain}
                                        snippet={source.snippet}
                                        url={source.url}
                                        isSelected={selectedUrls.has(source.url)}
                                        onToggle={() => handleToggleSource(source.url)}
                                        disabled={isImporting}
                                    />
                                    {index < sources.length - 1 && (
                                        <View style={{ height: 1, backgroundColor: colors.border, marginHorizontal: 20 }} />
                                    )}
                                </React.Fragment>
                            ))}
                        </View>
                        <View style={{ height: 120 }} />
                    </ScrollView>

                    {/* Footer */}
                    <View style={[styles.footer, { backgroundColor: isDarkMode ? colors.surfaceElevated : colors.white }]}>
                        <Text style={[styles.footerCount, { color: colors.textSecondary }]}>
                            {selectedUrls.size} source{selectedUrls.size !== 1 ? 's' : ''} selected
                        </Text>
                        <TouchableOpacity
                            onPress={handleImport}
                            disabled={isImporting || selectedUrls.size === 0}
                            style={[
                                styles.importButton,
                                {
                                    backgroundColor: colors.primary,
                                    opacity: isImporting || selectedUrls.size === 0 ? 0.4 : 1,
                                },
                            ]}
                        >
                            {isImporting ? (
                                <TikTokLoader size={12} color="#FFFFFF" containerWidth={80} />
                            ) : (
                                <Text style={styles.importButtonText}>Import</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            )}
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
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    headerButton: {
        width: 44,
        height: 44,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontFamily: 'Nunito-Bold',
    },
    searchingContainer: {
        flex: 1,
    },
    searchingHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        paddingVertical: 30,
    },
    searchingText: {
        fontSize: 16,
        fontFamily: 'Nunito-Medium',
    },
    summaryContainer: {
        paddingHorizontal: 22,
        paddingTop: 4,
        paddingBottom: 16,
    },
    summaryText: {
        fontSize: 14,
        fontFamily: 'Nunito-Medium',
        lineHeight: 20,
        opacity: 0.8,
    },
    listContainer: {
        marginHorizontal: 20,
        borderRadius: 24,
        borderWidth: 1,
        overflow: 'hidden',
    },
    selectAllRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
    },
    selectAllText: {
        fontSize: 16,
        fontFamily: 'Nunito-Bold',
    },
    checkbox: {
        width: 22,
        height: 22,
        borderRadius: 6,
        borderWidth: 1.5,
        alignItems: 'center',
        justifyContent: 'center',
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 60,
    },
    footer: {
        position: 'absolute',
        bottom: Platform.OS === 'ios' ? 40 : 36,
        left: 20,
        right: 20,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 24,
        paddingVertical: 14,
        borderRadius: 99,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.2,
        shadowRadius: 24,
        elevation: 12,
    },
    footerCount: {
        fontSize: 15,
        fontFamily: 'Nunito-SemiBold',
        opacity: 0.8,
    },
    importButton: {
        paddingHorizontal: 44,
        paddingVertical: 14,
        borderRadius: 99,
        minWidth: 160,
        alignItems: 'center',
        justifyContent: 'center',
    },
    importButtonText: {
        color: '#FFFFFF',
        fontSize: 18,
        fontFamily: 'Nunito-Bold',
    },
    errorContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 40,
    },
    errorTitle: {
        fontSize: 22,
        fontFamily: 'Nunito-Bold',
        marginTop: 16,
    },
    errorText: {
        fontSize: 16,
        fontFamily: 'Nunito-Regular',
        textAlign: 'center',
        marginTop: 8,
        lineHeight: 22,
    },
    retryButton: {
        marginTop: 24,
        paddingHorizontal: 36,
        paddingVertical: 16,
        borderRadius: 99,
    },
    retryButtonText: {
        color: '#FFFFFF',
        fontSize: 17,
        fontFamily: 'Nunito-SemiBold',
    },
});
