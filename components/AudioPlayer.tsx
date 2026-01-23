import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    Alert,
    ActivityIndicator,
    Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Slider from '@react-native-community/slider';
import Svg, { Path } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useAudioPlaybackPosition } from '@/lib/hooks/useAudioPlaybackPosition';
import { useErrorHandler } from '@/lib/hooks/useErrorHandler';
import { AudioVisualizer } from './AudioVisualizer';
import { useStore } from '@/lib/store';
import { audioFeedbackService } from '@/lib/services/audioFeedbackService';
import {
    CloseIcon,
    DownloadIcon,
    PlayIcon,
    PauseIcon,
    ThumbUpIcon,
    ThumbDownIcon
} from './AudioIcons';
import { formatTime } from '@/lib/utils';
import { BrigoLogo } from './BrigoLogo';
import { SubtitleDisplay } from './SubtitleDisplay';
import { useTheme, getThemeColors } from '@/lib/ThemeContext';
import { configureForMediaPlayback, configureForMixing } from '@/lib/audioConfig';

interface AudioPlayerProps {
    audioUrl: string;
    audioOverviewId: string;
    notebookId: string;
    title?: string;
    duration?: number;
    script?: string;
    onClose?: () => void;
    onDownload?: () => void;
    isDownloading?: boolean;
    downloadProgress?: number;
}

export function AudioPlayer({
    audioUrl,
    audioOverviewId,
    notebookId,
    title = 'Podcast',
    duration = 0,
    script,
    onClose,
    onDownload,
    isDownloading = false,
    downloadProgress = 0,
}: AudioPlayerProps) {
    const { handleError } = useErrorHandler();
    const { isDarkMode } = useTheme();
    const colors = getThemeColors(isDarkMode);
    const isPad = Platform.OS === 'ios' && Platform.isPad;

    const [currentTime, setCurrentTime] = useState(0);
    const [audioDuration, setAudioDuration] = useState(duration);
    const [playbackSpeed, setPlaybackSpeed] = useState(1);
    const [liked, setLiked] = useState<boolean | null>(null);
    const [loading, setLoading] = useState(true);
    const [showSubtitles, setShowSubtitles] = useState(true);

    const isDraggingSlider = useRef(false);
    const hasAwardedTaskRef = useRef(false);
    const feedbackLoadingRef = useRef(false);
    const feedbackOperationRef = useRef(false);
    const lastTimeRef = useRef(0);

    const { checkAndAwardTask, authUser, audioSettings } = useStore();

    const {
        savedPosition,
        saveCurrentPosition,
        clearSavedPosition,
    } = useAudioPlaybackPosition(audioOverviewId, notebookId, audioUrl, audioDuration);

    // Create audio player using expo-audio hook
    const player = useAudioPlayer({ uri: audioUrl });
    const status = useAudioPlayerStatus(player);

    // Configure audio mode for background playback
    useEffect(() => {
        configureForMediaPlayback();
        return () => {
            configureForMixing();
        };
    }, []);

    // Set up lock screen controls when player is ready
    useEffect(() => {
        if (!player || !status.isLoaded) return;

        // Enable lock screen controls with metadata
        try {
            player.setActiveForLockScreen(true, {
                title: title || 'Study Podcast',
                artist: 'Brigo',
            });
        } catch (error) {
            console.warn('[AudioPlayer] Failed to set lock screen controls:', error);
        }

        return () => {
            // Clear lock screen controls when component unmounts
            try {
                player.clearLockScreenControls();
            } catch (error) {
                // Ignore cleanup errors
            }
        };
    }, [player, status.isLoaded, title]);

    // Initialize player when ready
    useEffect(() => {
        if (!player) return;

        const initPlayer = async () => {
            try {
                // Wait for player to load
                if (status.isLoaded) {
                    // Set duration
                    if (status.duration) {
                        setAudioDuration(status.duration);
                    }

                    // Seek to saved position
                    if (savedPosition && savedPosition > 5) {
                        player.seekTo(savedPosition);
                        setCurrentTime(savedPosition);
                    }

                    // Set volume and playback rate
                    player.volume = audioSettings.voiceVolume;
                    player.playbackRate = playbackSpeed;

                    setLoading(false);
                }
            } catch (error: any) {
                setLoading(false);
                await handleError(error, {
                    operation: 'init_audio_player',
                    component: 'audio-player',
                    metadata: { audioUrl }
                });
            }
        };

        initPlayer();
    }, [player, status.isLoaded, status.duration, savedPosition, title, audioSettings.voiceVolume, playbackSpeed]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            // Save final position before cleanup using the ref for latest value
            if (lastTimeRef.current > 0) {
                saveCurrentPosition(lastTimeRef.current);
            }
            // No need to call player.remove() as useAudioPlayer hook handles cleanup.
        };
    }, [player]);

    // Track playback status
    useEffect(() => {
        if (!status.isLoaded || isDraggingSlider.current) return;

        const positionInSeconds = status.currentTime || 0;
        lastTimeRef.current = positionInSeconds;

        if (status.playing) {
            setCurrentTime(positionInSeconds);
            saveCurrentPosition(positionInSeconds);

            if (positionInSeconds >= 60 && !hasAwardedTaskRef.current && checkAndAwardTask) {
                hasAwardedTaskRef.current = true;
                checkAndAwardTask('podcast_3_min');
            }
        }

        // Handle playback completion
        if (status.currentTime >= status.duration && status.duration > 0 && !status.playing) {
            setCurrentTime(0);
            player.seekTo(0);
            clearSavedPosition();
        }
    }, [status.currentTime, status.playing, status.isLoaded, status.duration]);

    // Load feedback
    useEffect(() => {
        if (!authUser?.id || feedbackLoadingRef.current) return;
        let isMounted = true;
        const loadFeedback = async () => {
            try {
                feedbackLoadingRef.current = true;
                const feedback = await audioFeedbackService.getFeedback(authUser.id, audioOverviewId);
                if (isMounted && feedback) setLiked(feedback.is_liked);
            } catch (error) {
                console.error('Failed to load audio feedback:', error);
            } finally {
                if (isMounted) feedbackLoadingRef.current = false;
            }
        };
        loadFeedback();
        return () => { isMounted = false; };
    }, [authUser?.id, audioOverviewId]);

    const handleSlidingStart = useCallback(() => {
        isDraggingSlider.current = true;
    }, []);

    const handleSlidingComplete = useCallback(async (value: number) => {
        if (!player) return;
        try {
            player.seekTo(value);
            setCurrentTime(value);
        } catch (e) { }
        isDraggingSlider.current = false;
    }, [player]);

    const handlePlayPause = useCallback(async () => {
        if (!player || loading) return;
        try {
            if (status.playing) {
                player.pause();
                saveCurrentPosition(status.currentTime || 0);
            } else {
                player.play();
            }
        } catch (error) {
            console.error('Play/Pause error:', error);
        }
    }, [player, loading, status.playing, status.currentTime, saveCurrentPosition]);

    const handleSeekBack = useCallback(async () => {
        if (!player || loading) return;
        const newPos = Math.max(0, (status.currentTime || 0) - 10);
        player.seekTo(newPos);
        setCurrentTime(newPos);
    }, [player, loading, status.currentTime]);

    const handleSeekForward = useCallback(async () => {
        if (!player || loading) return;
        const maxDuration = status.duration || audioDuration || 0;
        const newPos = Math.min(maxDuration, (status.currentTime || 0) + 10);
        player.seekTo(newPos);
        setCurrentTime(newPos);
    }, [player, loading, status.currentTime, status.duration, audioDuration]);

    const handleSpeedChange = useCallback(async () => {
        if (!player || loading) return;
        const newSpeed = playbackSpeed === 1 ? 1.5 : playbackSpeed === 1.5 ? 2 : 1;
        player.playbackRate = newSpeed;
        setPlaybackSpeed(newSpeed);
    }, [player, playbackSpeed, loading]);

    const handleLike = useCallback(async () => {
        if (feedbackOperationRef.current) return;
        const previousValue = liked;
        const newValue = liked === true ? null : true;
        setLiked(newValue);
        feedbackOperationRef.current = true;
        if (authUser?.id) {
            try {
                if (newValue === null) await audioFeedbackService.removeFeedback(authUser.id, audioOverviewId);
                else await audioFeedbackService.saveFeedback(authUser.id, audioOverviewId, true);
                if (checkAndAwardTask) checkAndAwardTask('audio_feedback_given');
            } catch (error) {
                setLiked(previousValue);
            } finally { feedbackOperationRef.current = false; }
        } else feedbackOperationRef.current = false;
    }, [liked, authUser?.id, audioOverviewId]);

    const handleDislike = useCallback(async () => {
        if (feedbackOperationRef.current) return;
        const previousValue = liked;
        const newValue = liked === false ? null : false;
        setLiked(newValue);
        feedbackOperationRef.current = true;
        if (authUser?.id) {
            try {
                if (newValue === null) await audioFeedbackService.removeFeedback(authUser.id, audioOverviewId);
                else await audioFeedbackService.saveFeedback(authUser.id, audioOverviewId, false);
                if (checkAndAwardTask) checkAndAwardTask('audio_feedback_given');
            } catch (error) {
                setLiked(previousValue);
            } finally { feedbackOperationRef.current = false; }
        } else feedbackOperationRef.current = false;
    }, [liked, authUser?.id, audioOverviewId]);

    const isPlaying = status.playing;
    const displayDuration = status.duration || audioDuration || 0;
    const displayTime = isDraggingSlider.current ? currentTime : (status.currentTime || currentTime);

    return (
        <View style={{ flex: 1, backgroundColor: colors.background }}>
            <SafeAreaView className="flex-1">
                <View style={{
                    flexDirection: 'row',
                    itemsCenter: 'center',
                    justifyContent: 'space-between',
                    paddingHorizontal: isPad ? 40 : 16,
                    paddingVertical: isPad ? 24 : 12,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border
                }}>
                    <TouchableOpacity onPress={onClose} style={{ padding: 8 }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        <CloseIcon size={isPad ? 28 : 22} color={colors.text} />
                    </TouchableOpacity>
                    <View style={{ flex: 1, marginHorizontal: 16 }}>
                        <Text style={{ color: colors.text, fontSize: isPad ? 18 : 16, fontWeight: '500', textAlign: 'center' }} numberOfLines={1} ellipsizeMode="tail">{title}</Text>
                    </View>
                    <TouchableOpacity onPress={onDownload} disabled={isDownloading} style={{ padding: 8, opacity: isDownloading ? 0.5 : 1 }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        {isDownloading ? <ActivityIndicator size="small" color={colors.text} /> : <DownloadIcon size={isPad ? 28 : 22} color={colors.text} />}
                    </TouchableOpacity>
                </View>

                {isDownloading && downloadProgress > 0 && (
                    <View style={{ height: 3, backgroundColor: colors.border }}>
                        <View className="h-full bg-[#4F5BD5]" style={{ width: `${downloadProgress}%` }} />
                    </View>
                )}

                <View style={{ flex: 1, justifyContent: 'flex-end', maxWidth: isPad ? 700 : '100%', alignSelf: 'center', width: '100%' }}>
                    <View style={{ width: '100%', height: 2, backgroundColor: '#4F5BD5', marginBottom: isPad ? 24 : 16 }} />
                    <View style={{ flex: 1, paddingHorizontal: isPad ? 40 : 24 }}>
                        <View style={{ flex: 1, justifyContent: 'center', marginTop: isPad ? -120 : -80 }}>
                            {script ? (
                                <SubtitleDisplay
                                    script={script}
                                    currentTime={displayTime}
                                    duration={displayDuration}
                                    isVisible={showSubtitles}
                                    onToggleVisibility={() => setShowSubtitles(!showSubtitles)}
                                />
                            ) : <View style={{ height: 140 }} />}
                        </View>
                        <View style={{ height: isPad ? 60 : 44, marginTop: isPad ? -140 : -110, marginBottom: isPad ? 32 : 20, alignItems: 'center', justifyContent: 'center' }}>
                            <AudioVisualizer isPlaying={isPlaying} height={isPad ? 60 : 44} />
                        </View>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: isPad ? 64 : 48, marginBottom: isPad ? 48 : 32, paddingHorizontal: 24 }}>
                        <TouchableOpacity onPress={handleSpeedChange} style={{ alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={{ color: colors.text, fontSize: isPad ? 20 : 16, fontWeight: '600' }}>{playbackSpeed}X</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={handleLike} style={{ alignItems: 'center', justifyContent: 'center' }}>
                            <ThumbUpIcon size={isPad ? 32 : 24} color={liked === true ? '#4F5BD5' : colors.iconMuted} filled={liked === true} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={handleDislike} style={{ alignItems: 'center', justifyContent: 'center' }}>
                            <ThumbDownIcon size={isPad ? 32 : 24} color={liked === false ? '#ef4444' : colors.iconMuted} filled={liked === false} />
                        </TouchableOpacity>
                    </View>

                    <View style={{ paddingHorizontal: isPad ? 40 : 24, marginBottom: isPad ? 48 : 32 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Text style={{ color: colors.textSecondary, fontSize: isPad ? 16 : 14, width: isPad ? 60 : 48, fontWeight: '500' }}>{formatTime(displayTime)}</Text>
                            <View style={{ flex: 1, marginHorizontal: 12 }}>
                                <Slider
                                    style={{ width: '100%', height: 40 }}
                                    minimumValue={0}
                                    maximumValue={displayDuration || 1}
                                    value={displayTime}
                                    onSlidingStart={handleSlidingStart}
                                    onSlidingComplete={handleSlidingComplete}
                                    minimumTrackTintColor="#4F5BD5"
                                    maximumTrackTintColor={isDarkMode ? '#404042' : '#E5E7EB'}
                                    thumbTintColor="#4F5BD5"
                                    tapToSeek={true}
                                />
                            </View>
                            <Text style={{ color: colors.textSecondary, fontSize: isPad ? 16 : 14, width: isPad ? 60 : 48, textAlign: 'right', fontWeight: '500' }}>{formatTime(displayDuration)}</Text>
                        </View>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: isPad ? 64 : 40, marginBottom: isPad ? 80 : 80 }}>
                        <TouchableOpacity onPress={handleSeekBack} style={{ width: isPad ? 72 : 56, height: isPad ? 72 : 56, alignItems: 'center', justifyContent: 'center' }}>
                            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                                <Svg width={isPad ? 44 : 32} height={isPad ? 44 : 32} viewBox="0 0 32 32" fill="none">
                                    <Path d="M16 6C10.477 6 6 10.477 6 16s4.477 10 10 10 10-4.477 10-10" stroke={isDarkMode ? '#818CF8' : '#4F5BD5'} strokeWidth={2} strokeLinecap="round" />
                                    <Path d="M16 2v8l-4-4" stroke={isDarkMode ? '#818CF8' : '#4F5BD5'} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                                </Svg>
                                <Text style={{ color: isDarkMode ? '#818CF8' : '#4F5BD5', fontSize: isPad ? 14 : 12, fontWeight: 'bold', position: 'absolute' }}>10</Text>
                            </View>
                        </TouchableOpacity>

                        <TouchableOpacity onPress={handlePlayPause} disabled={loading} style={{
                            width: isPad ? 100 : 80,
                            height: isPad ? 100 : 80,
                            borderRadius: isPad ? 50 : 40,
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: isDarkMode ? '#818CF8' : '#4F5BD5',
                            shadowColor: isDarkMode ? '#000' : '#4F5BD5',
                            shadowOffset: { width: 0, height: 8 },
                            shadowOpacity: isDarkMode ? 0.5 : 0.4,
                            shadowRadius: 12,
                            elevation: 12,
                            opacity: loading ? 0.7 : 1,
                        }}>
                            {loading ? <ActivityIndicator size="small" color="#fff" /> : isPlaying ? <PauseIcon size={isPad ? 44 : 36} color="#fff" /> : <PlayIcon size={isPad ? 44 : 36} color="#fff" />}
                        </TouchableOpacity>

                        <TouchableOpacity onPress={handleSeekForward} style={{ width: isPad ? 72 : 56, height: isPad ? 72 : 56, alignItems: 'center', justifyContent: 'center' }}>
                            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                                <Svg width={isPad ? 44 : 32} height={isPad ? 44 : 32} viewBox="0 0 32 32" fill="none">
                                    <Path d="M16 6c5.523 0 10 4.477 10 10s-4.477 10-10 10S6 21.523 6 16" stroke={isDarkMode ? '#818CF8' : '#4F5BD5'} strokeWidth={2} strokeLinecap="round" />
                                    <Path d="M16 2v8l4-4" stroke={isDarkMode ? '#818CF8' : '#4F5BD5'} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                                </Svg>
                                <Text style={{ color: isDarkMode ? '#818CF8' : '#4F5BD5', fontSize: isPad ? 14 : 12, fontWeight: 'bold', position: 'absolute' }}>10</Text>
                            </View>
                        </TouchableOpacity>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: isPad ? 24 : 16, gap: 6, opacity: 0.4 }}>
                        <Text style={{ fontSize: isPad ? 14 : 11, fontFamily: 'Outfit-Light', color: colors.textMuted }}>Powered by</Text>
                        <BrigoLogo size={isPad ? 16 : 12} textColor={colors.textMuted} />
                    </View>
                </View>

                <LinearGradient
                    colors={isDarkMode ? ['rgba(41,41,43,0)', 'rgba(64,82,77,0.4)', 'rgba(58,87,80,0.5)'] : ['rgba(255,255,255,0)', 'rgba(167,243,208,0.4)', 'rgba(153,246,228,0.5)']}
                    locations={[0, 0.5, 1]}
                    className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none"
                />
            </SafeAreaView>
        </View>
    );
}

export default AudioPlayer;
