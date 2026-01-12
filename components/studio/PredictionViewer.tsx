import React, { useState, useMemo } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    StyleSheet,
    Dimensions,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Markdown from 'react-native-markdown-display';
import { LinearGradient } from 'expo-linear-gradient';
import { MotiView, AnimatePresence } from 'moti';
import * as Clipboard from 'expo-clipboard';
import { useTheme, getThemeColors } from '@/lib/ThemeContext';
import { useFeedback } from '@/lib/feedback';
import type { ExamPrediction, PredictionTopic, PredictedQuestion } from '@/lib/store/types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface PredictionViewerProps {
    prediction: ExamPrediction;
    onClose: () => void;
}

export const PredictionViewer: React.FC<PredictionViewerProps> = ({ prediction, onClose }) => {
    const { isDarkMode } = useTheme();
    const colors = getThemeColors(isDarkMode);
    const { play, haptic } = useFeedback();

    const [activeTab, setActiveTab] = useState<'topics' | 'predictions'>('predictions');
    const [expandedQuestions, setExpandedQuestions] = useState<Set<number>>(new Set());

    const reportData = prediction.report_data;
    const topics = reportData?.topics || [];
    const predictions = reportData?.predictions || [];
    const summary = reportData?.summary;

    const toggleQuestion = (index: number) => {
        haptic('selection');
        setExpandedQuestions((prev) => {
            const next = new Set(prev);
            if (next.has(index)) {
                next.delete(index);
            } else {
                next.add(index);
            }
            return next;
        });
    };

    const handleCopy = async (text: string) => {
        await Clipboard.setStringAsync(text);
        haptic('success');
        Alert.alert('Copied', 'The answer has been copied to your clipboard.', [{ text: 'OK' }]);
    };

    const getConfidenceColor = (confidence: 'high' | 'medium' | 'low') => {
        switch (confidence) {
            case 'high':
                return '#22c55e'; // green
            case 'medium':
                return '#f59e0b'; // amber
            case 'low':
                return '#ef4444'; // red
            default:
                return colors.textMuted;
        }
    };

    const getLikelihoodColor = (likelihood: 'high' | 'medium' | 'low') => {
        return getConfidenceColor(likelihood);
    };

    const getTrendIcon = (trend: string): keyof typeof Ionicons.glyphMap => {
        const t = trend.toLowerCase();
        if (t.includes('increasing') || t.includes('rising')) return 'trending-up';
        if (t.includes('decreasing') || t.includes('falling')) return 'trending-down';
        if (t.includes('cyclical')) return 'repeat';
        return 'remove';
    };

    const getTrendColor = (trend: string) => {
        const t = trend.toLowerCase();
        if (t.includes('increasing') || t.includes('rising')) return '#22c55e';
        if (t.includes('decreasing') || t.includes('falling')) return '#ef4444';
        if (t.includes('cyclical')) return '#9333ea';
        return colors.textMuted;
    };

    const getQuestionTypeIcon = (type: 'mcq' | 'short_answer' | 'essay'): keyof typeof Ionicons.glyphMap => {
        switch (type) {
            case 'mcq':
                return 'list-outline';
            case 'short_answer':
                return 'create-outline';
            case 'essay':
                return 'document-text-outline';
            default:
                return 'help-circle-outline';
        }
    };

    // Memoize markdown styles to avoid re-renders
    const markdownStyles = useMemo(() => ({
        body: {
            color: colors.text,
            fontSize: 15,
            lineHeight: 22,
            fontFamily: 'Nunito-Regular',
        },
        bullet_list: {
            marginVertical: 4,
        },
        list_item: {
            marginVertical: 4,
        },
        strong: {
            fontWeight: 'bold',
            color: '#9333ea',
            fontFamily: 'SpaceGrotesk-Bold',
        },
        em: {
            fontStyle: 'italic',
        },
        code_inline: {
            backgroundColor: isDarkMode ? '#3a3a3c' : '#f0f0f0',
            paddingHorizontal: 6,
            paddingVertical: 2,
            borderRadius: 4,
            fontFamily: 'SpaceGrotesk-Medium',
            color: '#9333ea',
        },
    }), [colors, isDarkMode]);

    const renderHeader = () => (
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <TouchableOpacity
                onPress={() => {
                    play('tap');
                    onClose();
                }}
                style={styles.closeButton}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
                <Ionicons name="chevron-back" size={26} color={colors.text} />
            </TouchableOpacity>
            <View style={styles.headerCenter}>
                <Text style={[styles.headerTitle, { color: colors.text }]}>
                    Prediction Insights
                </Text>
                <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
                    {prediction.title}
                </Text>
            </View>
            <View style={{ width: 40 }} />
        </View>
    );

    const renderSummary = () => (
        <MotiView
            from={{ opacity: 0, scale: 0.9, translateY: -20 }}
            animate={{ opacity: 1, scale: 1, translateY: 0 }}
            transition={{ type: 'spring', damping: 15 }}
        >
            <LinearGradient
                colors={isDarkMode ? ['#4c1d95', '#1e1b4b'] : ['#9333ea', '#4f46e5']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.summaryCard}
            >
                <View style={[styles.summaryGlassOverlay, { backgroundColor: 'rgba(255,255,255,0.05)' }]} />
                <View style={styles.summaryRow}>
                    <View style={styles.summaryItem}>
                        <Text style={styles.summaryValue}>{predictions.length}</Text>
                        <Text style={styles.summaryLabel}>Predictions</Text>
                    </View>
                    <View style={styles.summaryDivider} />
                    <View style={styles.summaryItem}>
                        <Text style={styles.summaryValue}>{topics.length}</Text>
                        <Text style={styles.summaryLabel}>Key Topics</Text>
                    </View>
                    {summary && (
                        <>
                            <View style={styles.summaryDivider} />
                            <View style={styles.summaryItem}>
                                <Text style={styles.summaryValue}>{summary.papers_analyzed}</Text>
                                <Text style={styles.summaryLabel}>Sources</Text>
                            </View>
                        </>
                    )}
                </View>
            </LinearGradient>
        </MotiView>
    );

    const renderTabs = () => (
        <View style={{ backgroundColor: colors.background, paddingTop: 8, paddingBottom: 16 }}>
            <View style={[styles.tabContainer, { backgroundColor: isDarkMode ? '#1e1e20' : '#f0f0f2' }]}>
                <MotiView
                    animate={{ x: activeTab === 'predictions' ? 0 : (SCREEN_WIDTH - 64) / 2 }}
                    transition={{ type: 'spring', damping: 20, stiffness: 150 }}
                    style={[styles.activeTabIndicator, { width: (SCREEN_WIDTH - 64) / 2, backgroundColor: colors.surface }]}
                />
                <TouchableOpacity
                    style={styles.tab}
                    onPress={() => {
                        haptic('selection');
                        setActiveTab('predictions');
                    }}
                >
                    <Ionicons
                        name="bulb"
                        size={16}
                        color={activeTab === 'predictions' ? '#9333ea' : colors.textMuted}
                    />
                    <Text style={[styles.tabText, { color: activeTab === 'predictions' ? colors.text : colors.textMuted, fontFamily: activeTab === 'predictions' ? 'SpaceGrotesk-Bold' : 'SpaceGrotesk-Medium' }]}>
                        Predictions
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.tab}
                    onPress={() => {
                        haptic('selection');
                        setActiveTab('topics');
                    }}
                >
                    <Ionicons
                        name="analytics"
                        size={16}
                        color={activeTab === 'topics' ? '#9333ea' : colors.textMuted}
                    />
                    <Text style={[styles.tabText, { color: activeTab === 'topics' ? colors.text : colors.textMuted, fontFamily: activeTab === 'topics' ? 'SpaceGrotesk-Bold' : 'SpaceGrotesk-Medium' }]}>
                        Analytics
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    const renderTopicItem = (topic: PredictionTopic, index: number) => (
        <MotiView
            key={index}
            from={{ opacity: 0, translateY: 20 }}
            animate={{ opacity: 1, translateY: 0 }}
            transition={{ delay: index * 100 }}
            style={[styles.topicCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
            <View style={styles.topicHeader}>
                <Text style={[styles.topicName, { color: colors.text }]}>{topic.name}</Text>
                <View style={[styles.likelihoodBadge, { backgroundColor: getLikelihoodColor(topic.likelihood) + '20' }]}>
                    <Text style={[styles.likelihoodText, { color: getLikelihoodColor(topic.likelihood) }]}>
                        {topic.likelihood}
                    </Text>
                </View>
            </View>
            <View style={styles.topicMeta}>
                <View style={styles.metaRow}>
                    <Ionicons name="bar-chart-outline" size={14} color={colors.textSecondary} />
                    <Text style={[styles.topicMetaText, { color: colors.textSecondary }]}>
                        Frequency: {topic.frequency}/10
                    </Text>
                </View>
                <View style={styles.metaRow}>
                    <Ionicons name={getTrendIcon(topic.trend)} size={14} color={getTrendColor(topic.trend)} />
                    <Text style={[styles.topicMetaText, { color: getTrendColor(topic.trend), fontFamily: 'SpaceGrotesk-SemiBold' }]}>
                        {topic.trend}
                    </Text>
                </View>
            </View>
            <View style={[styles.frequencyBarBg, { backgroundColor: isDarkMode ? '#353537' : '#efeee9' }]}>
                <MotiView
                    from={{ width: '0%' }}
                    animate={{ width: `${(topic.frequency / 10) * 100}%` }}
                    transition={{ type: 'timing', duration: 1000, delay: 300 + index * 100 }}
                    style={[styles.frequencyBarFill, { backgroundColor: getLikelihoodColor(topic.likelihood) }]}
                />
            </View>
        </MotiView>
    );

    const renderPredictionItem = (q: PredictedQuestion, index: number) => {
        const isExpanded = expandedQuestions.has(index);
        const accentColor = getConfidenceColor(q.confidence);

        return (
            <MotiView
                key={index}
                from={{ opacity: 0, translateX: -20 }}
                animate={{ opacity: 1, translateX: 0 }}
                transition={{ delay: index * 80 }}
            >
                <TouchableOpacity
                    style={[styles.predictionCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                    onPress={() => toggleQuestion(index)}
                    activeOpacity={0.7}
                >
                    <View style={[styles.confidenceSideBar, { backgroundColor: accentColor }]} />

                    <View style={styles.predictionContent}>
                        <View style={styles.predictionHeader}>
                            <View style={[styles.predictionTypeIcon, { backgroundColor: isDarkMode ? '#3a3a3c' : '#f0f0f2' }]}>
                                <Ionicons
                                    name={getQuestionTypeIcon(q.question_type)}
                                    size={18}
                                    color="#9333ea"
                                />
                            </View>
                            <View style={styles.predictionHeaderText}>
                                <Text style={[styles.predictionQuestion, { color: colors.text }]} numberOfLines={isExpanded ? undefined : 2}>
                                    {q.question}
                                </Text>
                            </View>
                        </View>

                        <AnimatePresence>
                            {isExpanded && (
                                <MotiView
                                    from={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ type: 'timing', duration: 300 }}
                                    style={{ overflow: 'hidden' }}
                                >
                                    <View style={[styles.predictionExpanded, { borderTopWidth: 1, borderTopColor: colors.border + '40' }]}>
                                        <View style={styles.tagsContainer}>
                                            <View style={[styles.topicTag, { backgroundColor: isDarkMode ? '#3a3a3c' : '#f0f0f2' }]}>
                                                <Text style={[styles.tagText, { color: colors.textSecondary }]}>{q.topic}</Text>
                                            </View>
                                            <View style={[styles.typeTag, { backgroundColor: '#9333ea15' }]}>
                                                <Text style={[styles.typeTagText, { color: '#9333ea' }]}>
                                                    {q.question_type.replace('_', ' ')}
                                                </Text>
                                            </View>
                                            <View style={[styles.confidencePill, { backgroundColor: accentColor + '15' }]}>
                                                <Text style={[styles.confidencePillText, { color: accentColor }]}>
                                                    {q.confidence} Confidence
                                                </Text>
                                            </View>
                                        </View>

                                        <View style={[styles.answerBlock, { backgroundColor: colors.surfaceAlt }]}>
                                            <View style={styles.answerHeader}>
                                                <Text style={styles.answerLabel}>✨ AI GENERATED SOLUTION</Text>
                                                <TouchableOpacity
                                                    onPress={() => handleCopy(q.answer)}
                                                    style={styles.copyButton}
                                                >
                                                    <Ionicons name="copy-outline" size={16} color="#9333ea" />
                                                    <Text style={styles.copyButtonText}>Copy</Text>
                                                </TouchableOpacity>
                                            </View>
                                            <Markdown style={markdownStyles}>
                                                {q.answer}
                                            </Markdown>
                                        </View>

                                        <View style={styles.reasoningBlock}>
                                            <View style={styles.reasoningRow}>
                                                <Ionicons name="bulb-outline" size={16} color={colors.textMuted} />
                                                <Text style={[styles.reasoningLabel, { color: colors.textMuted }]}>PROBABILITY REASONING</Text>
                                            </View>
                                            <Text style={[styles.reasoningText, { color: colors.textSecondary }]}>
                                                {q.reasoning}
                                            </Text>
                                        </View>
                                    </View>
                                </MotiView>
                            )}
                        </AnimatePresence>

                        <View style={styles.expandRow}>
                            <Ionicons
                                name={isExpanded ? 'chevron-up' : 'chevron-down'}
                                size={18}
                                color={colors.textMuted}
                            />
                        </View>
                    </View>
                </TouchableOpacity>
            </MotiView>
        );
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top']}>
            {renderHeader()}
            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                stickyHeaderIndices={[1]}
            >
                {renderSummary()}
                {renderTabs()}

                <AnimatePresence exitBeforeEnter>
                    {activeTab === 'predictions' ? (
                        <MotiView
                            key="predictions-list"
                            from={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 300 }}
                        >
                            {predictions.length > 0 ? (
                                predictions.map((q, i) => renderPredictionItem(q, i))
                            ) : (
                                <View style={styles.emptyState}>
                                    <Ionicons name="bulb-outline" size={48} color={colors.textMuted} />
                                    <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                                        No predictions available
                                    </Text>
                                </View>
                            )}
                        </MotiView>
                    ) : (
                        <MotiView
                            key="topics-list"
                            from={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 300 }}
                        >
                            {topics.length > 0 ? (
                                topics.map((t, i) => renderTopicItem(t, i))
                            ) : (
                                <View style={styles.emptyState}>
                                    <Ionicons name="analytics-outline" size={48} color={colors.textMuted} />
                                    <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                                        No topic analysis available
                                    </Text>
                                </View>
                            )}
                        </MotiView>
                    )}
                </AnimatePresence>
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
    },
    closeButton: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerCenter: {
        flex: 1,
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontFamily: 'Outfit-Bold',
        letterSpacing: -0.5,
    },
    headerSubtitle: {
        fontSize: 12,
        fontFamily: 'SpaceGrotesk-Medium',
        marginTop: 2,
    },
    summaryCard: {
        marginHorizontal: 16,
        marginTop: 16,
        borderRadius: 20,
        padding: 24,
        overflow: 'hidden',
        position: 'relative',
    },
    summaryGlassOverlay: {
        ...StyleSheet.absoluteFillObject,
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        zIndex: 1,
    },
    summaryItem: {
        alignItems: 'center',
        flex: 1,
    },
    summaryDivider: {
        width: 1,
        height: 30,
        backgroundColor: 'rgba(255,255,255,0.2)',
    },
    summaryValue: {
        fontSize: 28,
        fontFamily: 'Outfit-Bold',
        color: '#FFFFFF',
    },
    summaryLabel: {
        fontSize: 11,
        fontFamily: 'SpaceGrotesk-SemiBold',
        color: 'rgba(255,255,255,0.8)',
        marginTop: 4,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    tabContainer: {
        marginHorizontal: 16,
        height: 44,
        padding: 4,
        borderRadius: 22,
        flexDirection: 'row',
        position: 'relative',
    },
    activeTabIndicator: {
        position: 'absolute',
        top: 4,
        bottom: 4,
        left: 4,
        borderRadius: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        zIndex: 1,
    },
    tabText: {
        fontSize: 14,
    },
    scrollContent: {
        paddingBottom: 40,
    },
    topicCard: {
        marginHorizontal: 16,
        padding: 20,
        borderRadius: 16,
        borderWidth: 1,
        marginBottom: 12,
    },
    topicHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    topicName: {
        fontSize: 17,
        fontFamily: 'Outfit-SemiBold',
        flex: 1,
        marginRight: 12,
    },
    likelihoodBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
    },
    likelihoodText: {
        fontSize: 11,
        fontFamily: 'SpaceGrotesk-Bold',
        textTransform: 'uppercase',
    },
    topicMeta: {
        flexDirection: 'row',
        gap: 20,
        marginBottom: 16,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    topicMetaText: {
        fontSize: 13,
    },
    frequencyBarBg: {
        height: 6,
        borderRadius: 3,
        overflow: 'hidden',
    },
    frequencyBarFill: {
        height: '100%',
        borderRadius: 3,
    },
    predictionCard: {
        marginHorizontal: 16,
        borderRadius: 16,
        borderWidth: 1,
        marginBottom: 16,
        overflow: 'hidden',
        flexDirection: 'row',
    },
    confidenceSideBar: {
        width: 5,
        height: '100%',
    },
    predictionContent: {
        flex: 1,
        paddingTop: 16,
        paddingRight: 16,
        paddingBottom: 8,
    },
    predictionHeader: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        alignItems: 'flex-start',
        marginBottom: 8,
    },
    predictionTypeIcon: {
        width: 32,
        height: 32,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    predictionHeaderText: {
        flex: 1,
    },
    predictionQuestion: {
        fontSize: 15,
        fontFamily: 'Outfit-Medium',
        lineHeight: 22,
    },
    predictionExpanded: {
        paddingHorizontal: 16,
        marginTop: 12,
    },
    tagsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 16,
    },
    topicTag: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 8,
    },
    tagText: {
        fontSize: 11,
        fontFamily: 'SpaceGrotesk-Medium',
    },
    typeTag: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 8,
    },
    typeTagText: {
        fontSize: 11,
        fontFamily: 'SpaceGrotesk-Bold',
        textTransform: 'uppercase',
    },
    confidencePill: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 8,
    },
    confidencePillText: {
        fontSize: 11,
        fontFamily: 'SpaceGrotesk-Bold',
    },
    answerBlock: {
        padding: 16,
        borderRadius: 12,
        marginBottom: 16,
    },
    answerHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    answerLabel: {
        fontSize: 10,
        fontFamily: 'SpaceGrotesk-Bold',
        color: '#9333ea',
        letterSpacing: 1,
    },
    copyButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    copyButtonText: {
        fontSize: 12,
        fontFamily: 'SpaceGrotesk-Bold',
        color: '#9333ea',
    },
    reasoningBlock: {
        paddingBottom: 8,
    },
    reasoningRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 6,
    },
    reasoningLabel: {
        fontSize: 10,
        fontFamily: 'SpaceGrotesk-Bold',
        letterSpacing: 0.5,
    },
    reasoningText: {
        fontSize: 13,
        lineHeight: 20,
        fontFamily: 'Nunito-Medium',
        fontStyle: 'italic',
    },
    expandRow: {
        alignItems: 'center',
        paddingVertical: 4,
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
    },
    emptyText: {
        fontSize: 16,
        fontFamily: 'SpaceGrotesk-Medium',
        marginTop: 12,
    },
});
