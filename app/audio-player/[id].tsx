import React, { useState, useEffect } from 'react';
import { View, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { PodcastPlayer } from '@/components/PodcastPlayer';
import { podcastService } from '@/lib/services/podcastService';
import { podcastDownloadService } from '@/lib/services/podcastDownloadService';
import { Alert } from 'react-native';
import { useTheme, getThemeColors } from '@/lib/ThemeContext';
import { TikTokLoader } from '@/components/TikTokLoader';
import type { Podcast } from '@/lib/store/types';

export default function AudioPlayerScreen() {
    const { isDarkMode } = useTheme();
    const colors = getThemeColors(isDarkMode);

    const { id } = useLocalSearchParams<{ id: string }>();
    const router = useRouter();

    const [podcast, setPodcast] = useState<Podcast | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isDownloading, setIsDownloading] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState(0);

    // Load podcast on mount
    useEffect(() => {
        loadPodcast();
    }, [id]);

    const loadPodcast = async () => {
        try {
            setLoading(true);
            const data = await podcastService.getById(id);

            if (!data) {
                setError('Podcast not found');
                Alert.alert('Error', 'Podcast not found', [
                    { text: 'OK', onPress: () => router.back() }
                ]);
                return;
            }

            setPodcast(data);
        } catch (err: any) {
            console.error('Failed to load podcast:', err);
            setError(err.message || 'Failed to load podcast');
            Alert.alert('Error', 'Failed to load podcast', [
                { text: 'OK', onPress: () => router.back() }
            ]);
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        router.back();
    };

    const handleDownload = async () => {
        if (!podcast || isDownloading) return;

        try {
            setIsDownloading(true);
            setDownloadProgress(0);

            const result = await podcastDownloadService.downloadPodcastFile(
                podcast.audio_url,
                podcast.title,
                podcast.storage_path,
                (progress: { percentage: number }) => {
                    setDownloadProgress(progress.percentage);
                }
            );

            if (result.success) {
                setDownloadProgress(100);
            } else {
                Alert.alert('Download Failed', result.message);
            }
        } catch (error) {
            console.error('Download error:', error);
            Alert.alert('Download Failed', 'An unexpected error occurred. Please try again.');
        } finally {
            setIsDownloading(false);
            setTimeout(() => setDownloadProgress(0), 1000);
        }
    };

    if (loading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
                <TikTokLoader size={16} color={colors.primary} containerWidth={80} />
                <Text style={{ marginTop: 24, color: colors.textSecondary, fontSize: 16 }}>Loading audio...</Text>
            </View>
        );
    }

    if (error || !podcast) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background, padding: 20 }}>
                <Text style={{ fontSize: 16, color: '#ef4444', textAlign: 'center' }}>
                    {error || 'Podcast not found'}
                </Text>
            </View>
        );
    }

    return (
        <View style={{ flex: 1 }}>
            <PodcastPlayer
                audioUrl={podcast.audio_url}
                podcastId={id}
                notebookId={podcast.notebook_id}
                title={podcast.title}
                duration={podcast.duration}
                script={podcast.script}
                onClose={handleClose}
                onDownload={handleDownload}
                isDownloading={isDownloading}
                downloadProgress={downloadProgress}
            />
        </View>
    );
}
