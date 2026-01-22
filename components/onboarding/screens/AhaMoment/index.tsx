/**
 * Screen 3: The Aha Moment - Interactive Memory Demo
 *
 * SIMPLIFIED VERSION:
 * - Simple recognition test (tap what you remember)
 * - Active recall with proper question/answer flow
 * - No time tracking
 */

import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image } from 'react-native';
import { MotiView } from 'moti';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path } from 'react-native-svg';

import { getThemeColors } from '@/lib/ThemeContext';
import { useStore } from '@/lib/store';
import { track } from '@/lib/services/analyticsService';
import { TypewriterText } from '../../components/TypewriterText';
import { styles } from './styles';
import { Phase, getRandomFacts, Fact } from './constants';
import { ActionButton, FactCard, ProgressDots } from './components';

// Mascot images
import BrigoAnalytical from '../../../../assets/onboarding-ui/mascot/brigo_analytical.png';
import BrigoProud from '../../../../assets/onboarding-ui/mascot/brigo_proud.png';
import BrigoSmug from '../../../../assets/onboarding-ui/mascot/brigo_smug.png';

interface Screen3_AhaMomentProps {
    colors: ReturnType<typeof getThemeColors>;
    onComplete: () => void;
}

export function Screen3_AhaMoment({ colors, onComplete }: Screen3_AhaMomentProps) {
    const [phase, setPhase] = useState<Phase>('intro');
    const [currentFactIndex, setCurrentFactIndex] = useState(0);
    const [selectedFacts, setSelectedFacts] = useState<string[]>([]);
    const [passiveScore, setPassiveScore] = useState(0);
    const [activeScore, setActiveScore] = useState(0);
    const [showScrollHint, setShowScrollHint] = useState(false);
    const [scrollContainerHeight, setScrollContainerHeight] = useState(0);

    // Active recall state: 'reading' (showing fact) or 'answering' (showing question)
    const [activeRecallStage, setActiveRecallStage] = useState<'reading' | 'answering'>('reading');

    // Generate random facts once on mount
    const [factsData] = useState(() => getRandomFacts(5));
    const facts = factsData.facts;
    const distractors = factsData.distractors;

    // Mixed options for recognition test (shuffled once)
    const [allOptions] = useState(() => {
        const realFacts = facts.map(f => f.fact);
        const mixed = [...realFacts, ...distractors];
        return mixed.sort(() => Math.random() - 0.5);
    });

    // Pre-shuffle answer options for each fact
    const [shuffledAnswerOptions] = useState(() => {
        const map: { [key: number]: string[] } = {};
        facts.forEach((fact, idx) => {
            map[idx] = [fact.answer, ...fact.wrongOptions].sort(() => Math.random() - 0.5);
        });
        return map;
    });

    const { setStudyGoal } = useStore();
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    // Motivation options
    const MOTIVATION_OPTIONS = [
        { value: 'exam_prep' as const, label: 'Preparing for exams', icon: 'school-outline' as const, desc: 'Tests, finals, certifications' },
        { value: 'retention' as const, label: 'Learning for the long term', icon: 'library-outline' as const, desc: 'Career, skills, growth' },
        { value: 'quick_review' as const, label: 'Quick refreshers', icon: 'flash-outline' as const, desc: 'Staying sharp on things I know' },
        { value: 'all' as const, label: 'Just exploring', icon: 'compass-outline' as const, desc: 'Curious what Brigo can do' },
    ];

    // Cleanup
    useEffect(() => {
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, []);

    // Auto-advance through fact display
    useEffect(() => {
        if (phase === 'showFacts') {
            if (currentFactIndex < facts.length) {
                timerRef.current = setTimeout(() => {
                    setCurrentFactIndex((prev) => prev + 1);
                }, 1800); // Faster - 1.8 seconds per fact
            } else {
                timerRef.current = setTimeout(() => {
                    setPhase('distraction');
                }, 500);
            }
        }
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [phase, currentFactIndex, facts.length]);

    // Auto-transition from reading to answering in active recall
    useEffect(() => {
        if (phase === 'activeRecall' && activeRecallStage === 'reading') {
            timerRef.current = setTimeout(() => {
                setActiveRecallStage('answering');
            }, 2000); // Show fact for 2 seconds, then show question
        }
        return () => {
            if (timerRef.current) clearTimeout(timerRef.current);
        };
    }, [phase, activeRecallStage, currentFactIndex]);

    // === HANDLERS ===

    const handleStartDemo = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setPhase('showFacts');
        setCurrentFactIndex(0);
    };

    const handleMotivationSelect = (value: 'exam_prep' | 'retention' | 'quick_review' | 'all') => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setStudyGoal(value);
        setPhase('passiveTest');
        // Reset scroll hint - it will be set based on actual content size
        setShowScrollHint(false);
    };

    const handleFactSelect = (fact: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setSelectedFacts((prev) =>
            prev.includes(fact) ? prev.filter((f) => f !== fact) : [...prev, fact]
        );
    };

    const handlePassiveTestSubmit = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        const correctFacts = facts.map((f) => f.fact);
        const score = selectedFacts.filter((f) => correctFacts.includes(f)).length;
        const wrongSelections = selectedFacts.filter((f) => !correctFacts.includes(f)).length;
        const finalScore = Math.max(0, score - wrongSelections);
        setPassiveScore(finalScore);
        setSelectedFacts([]);

        // Track passive test result
        track('aha_moment_passive_test', {
            score: finalScore,
            out_of: facts.length,
            wrong_selections: wrongSelections,
        });

        setPhase('passiveResult');
    };

    const handleTryBrigoWay = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setPhase('brigoIntro');
    };

    const handleStartActiveRecall = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setPhase('activeRecall');
        setCurrentFactIndex(0);
        setActiveRecallStage('reading');
    };

    const handleActiveRecallAnswer = (selectedAnswer: string) => {
        const currentFact = facts[currentFactIndex];
        const isCorrect = selectedAnswer === currentFact.answer;

        Haptics.impactAsync(
            isCorrect ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light
        );

        // Track correct answers
        if (isCorrect) {
            setActiveScore(prev => prev + 1);
        }

        if (currentFactIndex < facts.length - 1) {
            setCurrentFactIndex((prev) => prev + 1);
            setActiveRecallStage('reading');
        } else {
            // Track active recall result (activeScore + this answer)
            const finalActiveScore = isCorrect ? activeScore + 1 : activeScore;
            track('aha_moment_active_test', {
                score: finalActiveScore,
                out_of: facts.length,
                improvement: finalActiveScore - passiveScore,
            });

            // Skip the second tap-test, go directly to result
            setPhase('finalResult');
        }
    };

    const handleActiveTestSubmit = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        const correctFacts = facts.map((f) => f.fact);
        const score = selectedFacts.filter((f) => correctFacts.includes(f)).length;
        const wrongSelections = selectedFacts.filter((f) => !correctFacts.includes(f)).length;
        const finalScore = Math.max(0, score - wrongSelections);
        setActiveScore(finalScore);
        setSelectedFacts([]);
        setPhase('finalResult');
    };

    // === PHASE RENDERERS ===

    const renderIntro = () => (
        <View style={styles.phaseContainer}>
            <View style={styles.mascotSection}>
                <MotiView
                    animate={{ translateY: [-5, 5, -5] }}
                    transition={{ loop: true, type: 'timing', duration: 3000 } as any}
                >
                    <Image source={BrigoSmug} style={styles.mascotImage} resizeMode="contain" />
                </MotiView>
            </View>

            <MotiView
                from={{ opacity: 0, translateY: 20 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ delay: 500 } as any}
                style={[styles.speechBubble, { backgroundColor: colors.surfaceElevated }]}
            >
                <TypewriterText
                    text="Let me prove something to you. Ready for a quick experiment?"
                    style={[styles.bubbleText, { color: colors.text }]}
                    speed={30}
                    delay={800}
                />
                <View style={styles.bubbleTail}>
                    <Svg width="20" height="12" viewBox="0 0 20 12">
                        <Path d="M10 12C10 12 7.5 4 0 0L20 0C12.5 4 10 12 10 12Z" fill={colors.surfaceElevated} />
                    </Svg>
                </View>
            </MotiView>

            <MotiView
                from={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 2500 } as any}
                style={styles.ctaContainer}
            >
                <TouchableOpacity
                    style={[styles.primaryButton, { backgroundColor: colors.primary }]}
                    onPress={handleStartDemo}
                    activeOpacity={0.8}
                >
                    <Text style={styles.primaryButtonText}>Let's try it</Text>
                    <Ionicons name="arrow-forward" size={18} color="#fff" />
                </TouchableOpacity>
                <Text style={[styles.timeHint, { color: colors.textMuted }]}>Takes about 60 seconds</Text>
            </MotiView>
        </View>
    );

    const renderShowFacts = () => (
        <View style={styles.phaseContainer}>
            <MotiView
                from={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                style={[styles.instructionCard, { backgroundColor: colors.surfaceElevated }]}
            >
                <Text style={[styles.instructionText, { color: colors.textSecondary, fontSize: 16 }]}>
                    <Text style={{ color: colors.primary, fontWeight: '700' }}>Remember</Text> these facts
                </Text>
            </MotiView>

            <View style={styles.factDisplayContainer}>
                {currentFactIndex < facts.length && (
                    <FactCard
                        factNumber={currentFactIndex + 1}
                        totalFacts={facts.length}
                        factText={facts[currentFactIndex].fact}
                        colors={colors}
                    />
                )}
            </View>

            <ProgressDots
                total={facts.length}
                current={currentFactIndex}
                activeColor={colors.primary}
                inactiveColor={colors.border}
            />
        </View>
    );

    const renderDistraction = () => (
        <View style={styles.phaseContainer}>
            <View style={styles.mascotSection}>
                <MotiView
                    animate={{ translateY: [-5, 5, -5] }}
                    transition={{ loop: true, type: 'timing', duration: 3000 } as any}
                >
                    <Image source={BrigoAnalytical} style={styles.mascotImage} resizeMode="contain" />
                </MotiView>
            </View>

            <MotiView
                from={{ opacity: 0, translateY: 20 }}
                animate={{ opacity: 1, translateY: 0 }}
                style={[styles.speechBubble, { backgroundColor: colors.surfaceElevated }]}
            >
                <Text style={[styles.bubbleText, { color: colors.text }]}>
                    Quick question while I prepare the test...
                </Text>
                <View style={styles.bubbleTail}>
                    <Svg width="20" height="12" viewBox="0 0 20 12">
                        <Path d="M10 12C10 12 7.5 4 0 0L20 0C12.5 4 10 12 10 12Z" fill={colors.surfaceElevated} />
                    </Svg>
                </View>
            </MotiView>

            <MotiView
                from={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 600 } as any}
                style={styles.motivationGrid}
            >
                <Text style={[styles.inputLabel, { color: colors.textSecondary, textAlign: 'center', marginBottom: 12 }]}>
                    What brings you to Brigo?
                </Text>
                {MOTIVATION_OPTIONS.map((option, idx) => (
                    <MotiView
                        key={option.value}
                        from={{ opacity: 0, translateX: -20 }}
                        animate={{ opacity: 1, translateX: 0 }}
                        transition={{ delay: 700 + idx * 80 } as any}
                    >
                        <TouchableOpacity
                            style={[
                                styles.motivationCard,
                                { backgroundColor: colors.surfaceElevated, borderColor: colors.border },
                            ]}
                            onPress={() => handleMotivationSelect(option.value)}
                            activeOpacity={0.7}
                        >
                            <View style={[styles.motivationIcon, { backgroundColor: colors.primary + '15' }]}>
                                <Ionicons name={option.icon} size={24} color={colors.primary} />
                            </View>
                            <View style={styles.motivationTextContainer}>
                                <Text style={[styles.motivationTitle, { color: colors.text }]}>
                                    {option.label}
                                </Text>
                                <Text style={[styles.motivationDesc, { color: colors.textMuted }]}>
                                    {option.desc}
                                </Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
                        </TouchableOpacity>
                    </MotiView>
                ))}
            </MotiView>
        </View>
    );

    const renderPassiveTest = () => (
        <View style={styles.phaseContainer}>
            <MotiView
                from={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                style={[styles.instructionCard, { backgroundColor: colors.surfaceElevated }]}
            >
                <Text style={[styles.instructionText, { color: colors.textSecondary, fontSize: 16 }]}>
                    <Text style={{ color: colors.primary, fontWeight: '700' }}>Tap</Text> all the facts you remember
                </Text>
            </MotiView>

            <View
                style={{ flex: 1, width: '100%', position: 'relative' }}
                onLayout={(e) => setScrollContainerHeight(e.nativeEvent.layout.height)}
            >
                <ScrollView
                    style={styles.optionsContainer}
                    showsVerticalScrollIndicator={false}
                    onScroll={() => setShowScrollHint(false)}
                    scrollEventThrottle={16}
                    onContentSizeChange={(_, contentHeight) => {
                        // Only show scroll hint if content is taller than container
                        if (scrollContainerHeight > 0 && contentHeight > scrollContainerHeight) {
                            setShowScrollHint(true);
                        }
                    }}
                >
                    {allOptions.map((option, idx) => (
                        <TouchableOpacity
                            key={idx}
                            style={[
                                styles.optionCard,
                                {
                                    backgroundColor: selectedFacts.includes(option)
                                        ? colors.primary + '20'
                                        : colors.surfaceElevated,
                                    borderColor: selectedFacts.includes(option) ? colors.primary : colors.border,
                                },
                            ]}
                            onPress={() => handleFactSelect(option)}
                            activeOpacity={0.7}
                        >
                            <Text style={[styles.optionText, { color: colors.text }]}>{option}</Text>
                            {selectedFacts.includes(option) && (
                                <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
                            )}
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                {showScrollHint && (
                    <View style={{ position: 'absolute', bottom: 8, left: 0, right: 0, alignItems: 'center', zIndex: 10 }}>
                        <MotiView
                            from={{ opacity: 0, translateY: 10 }}
                            animate={{ opacity: 1, translateY: 0 }}
                            transition={{ type: 'timing', duration: 400, delay: 500 } as any}
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                backgroundColor: colors.primary,
                                paddingHorizontal: 14,
                                paddingVertical: 8,
                                borderRadius: 20,
                            }}
                        >
                            <Text style={{ color: '#fff', fontSize: 13, fontFamily: 'SpaceGrotesk-Bold', marginRight: 6 }}>
                                Scroll for more
                            </Text>
                            <MotiView
                                animate={{ translateY: [0, 4, 0] }}
                                transition={{ loop: true, type: 'timing', duration: 700 } as any}
                            >
                                <Ionicons name="chevron-down" size={16} color="#fff" />
                            </MotiView>
                        </MotiView>
                    </View>
                )}
            </View>

            <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: colors.primary }]}
                onPress={handlePassiveTestSubmit}
                activeOpacity={0.8}
            >
                <Text style={styles.primaryButtonText}>Check my answers</Text>
            </TouchableOpacity>
        </View>
    );

    const renderPassiveResult = () => (
        <View style={styles.phaseContainer}>
            <View style={styles.mascotSection}>
                <MotiView
                    animate={{ translateY: [-5, 5, -5] }}
                    transition={{ loop: true, type: 'timing', duration: 3000 } as any}
                >
                    <Image source={BrigoAnalytical} style={styles.mascotImageSmall} resizeMode="contain" />
                </MotiView>
            </View>

            <MotiView
                from={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                style={[styles.resultCard, { backgroundColor: colors.surfaceElevated }]}
            >
                <Text style={[styles.resultScore, { color: colors.text }]}>
                    {passiveScore} <Text style={{ color: colors.textMuted }}>/ 5</Text>
                </Text>
                <Text style={[styles.resultLabel, { color: colors.textSecondary }]}>facts remembered</Text>

                <View style={[styles.resultDivider, { backgroundColor: colors.border }]} />

                <Text style={[styles.resultMessage, { color: colors.text }]}>
                    {passiveScore <= 2
                        ? "That's completely normal."
                        : passiveScore <= 3
                            ? 'Not bad! But what if it was 5/5?'
                            : 'Good memory! But will it stick tomorrow?'}
                </Text>
                <Text style={[styles.resultSubtext, { color: colors.textMuted }]}>
                    Most people forget 80% within minutes. It's how your brain works.
                </Text>
            </MotiView>

            <MotiView
                from={{ opacity: 0, translateY: 20 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ delay: 1200 } as any}
                style={[styles.speechBubble, { backgroundColor: colors.surfaceElevated }]}
            >
                <Text style={[styles.bubbleText, { color: colors.text }]}>
                    Now let me show you the Brigo way.
                </Text>
                <View style={styles.bubbleTail}>
                    <Svg width="20" height="12" viewBox="0 0 20 12">
                        <Path d="M10 12C10 12 7.5 4 0 0L20 0C12.5 4 10 12 10 12Z" fill={colors.surfaceElevated} />
                    </Svg>
                </View>
            </MotiView>

            <ActionButton
                text="Try the Brigo way"
                onPress={handleTryBrigoWay}
                backgroundColor={colors.primary}
                delay={2000}
            />
        </View>
    );

    const renderBrigoIntro = () => (
        <View style={styles.phaseContainer}>
            <View style={styles.mascotSection}>
                <MotiView
                    animate={{ scale: [1, 1.1, 1], rotate: ['0deg', '5deg', '-5deg', '0deg'] }}
                    transition={{ loop: true, type: 'timing', duration: 2000 } as any}
                >
                    <Image source={BrigoProud} style={styles.mascotImage} resizeMode="contain" />
                </MotiView>
            </View>

            <MotiView
                from={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                style={[styles.speechBubble, { backgroundColor: colors.surfaceElevated }]}
            >
                <Text style={[styles.bubbleText, { color: colors.text, fontSize: 18, fontWeight: '700' }]}>
                    Same facts. But this time, I'll quiz you right after each one.
                </Text>
                <View style={styles.bubbleTail}>
                    <Svg width="20" height="12" viewBox="0 0 20 12">
                        <Path d="M10 12C10 12 7.5 4 0 0L20 0C12.5 4 10 12 10 12Z" fill={colors.surfaceElevated} />
                    </Svg>
                </View>
            </MotiView>

            <ActionButton
                text="I'm ready"
                onPress={handleStartActiveRecall}
                backgroundColor={colors.primary}
                delay={800}
            />
        </View>
    );

    const renderActiveRecall = () => {
        const currentFact = facts[currentFactIndex];
        const options = shuffledAnswerOptions[currentFactIndex] || [];

        return (
            <View style={styles.phaseContainer}>
                <MotiView
                    from={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    style={[styles.instructionCard, { backgroundColor: colors.primary + '15' }]}
                >
                    <Text style={[styles.instructionText, { color: colors.textSecondary, fontSize: 16 }]}>
                        <Text style={{ color: colors.primary, fontWeight: '700' }}>
                            {activeRecallStage === 'reading' ? 'Read' : 'Answer'}
                        </Text>
                        {activeRecallStage === 'reading' ? ' — memorize this fact' : ' — what did you just learn?'}
                    </Text>
                </MotiView>

                <View style={styles.factDisplayContainer}>
                    {activeRecallStage === 'reading' ? (
                        // Stage 1: Show the fact
                        <MotiView
                            key={`reading-${currentFactIndex}`}
                            from={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            style={[styles.activeCard, { backgroundColor: colors.surfaceElevated }]}
                        >
                            <Text style={[styles.activeFactText, { color: colors.text }]}>
                                {currentFact.fact}
                            </Text>
                            <MotiView
                                animate={{ opacity: [0.6, 1, 0.6] }}
                                transition={{ loop: true, type: 'timing', duration: 1500 } as any}
                                style={{ marginTop: 16 }}
                            >
                                <Text style={{ color: colors.textSecondary, fontSize: 14, fontFamily: 'SpaceGrotesk-Medium' }}>
                                    Question coming...
                                </Text>
                            </MotiView>
                        </MotiView>
                    ) : (
                        // Stage 2: Show the question with options
                        <MotiView
                            key={`answering-${currentFactIndex}`}
                            from={{ opacity: 0, translateX: 30 }}
                            animate={{ opacity: 1, translateX: 0 }}
                            style={[styles.questionCard, { backgroundColor: colors.surfaceElevated, borderColor: colors.primary }]}
                        >
                            <Text style={[styles.questionLabel, { color: colors.primary }]}>
                                {currentFactIndex + 1} of {facts.length}
                            </Text>
                            <Text style={[styles.questionText, { color: colors.text }]}>
                                {currentFact.question}
                            </Text>
                            <View style={styles.multiChoiceContainer}>
                                {options.map((option, idx) => (
                                    <TouchableOpacity
                                        key={`option-${idx}`}
                                        style={[
                                            styles.multiChoiceButton,
                                            { backgroundColor: colors.background, borderColor: colors.border },
                                        ]}
                                        onPress={() => handleActiveRecallAnswer(option)}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={[styles.multiChoiceText, { color: colors.text }]}>
                                            {option}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </MotiView>
                    )}
                </View>

                <ProgressDots
                    total={facts.length}
                    current={currentFactIndex}
                    activeColor={colors.primary}
                    inactiveColor={colors.border}
                />
            </View>
        );
    };

    const renderActiveTest = () => (
        <View style={styles.phaseContainer}>
            <MotiView
                from={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                style={[styles.instructionCard, { backgroundColor: colors.surfaceElevated }]}
            >
                <Text style={[styles.instructionText, { color: colors.textSecondary, fontSize: 16 }]}>
                    <Text style={{ color: colors.primary, fontWeight: '700' }}>Final test:</Text> tap the facts you remember
                </Text>
            </MotiView>

            <View
                style={{ flex: 1, width: '100%', position: 'relative' }}
                onLayout={(e) => setScrollContainerHeight(e.nativeEvent.layout.height)}
            >
                <ScrollView
                    style={styles.optionsContainer}
                    showsVerticalScrollIndicator={false}
                    onScroll={() => setShowScrollHint(false)}
                    scrollEventThrottle={16}
                    onContentSizeChange={(_, contentHeight) => {
                        if (scrollContainerHeight > 0 && contentHeight > scrollContainerHeight) {
                            setShowScrollHint(true);
                        }
                    }}
                >
                    {allOptions.map((option, idx) => (
                        <TouchableOpacity
                            key={idx}
                            style={[
                                styles.optionCard,
                                {
                                    backgroundColor: selectedFacts.includes(option)
                                        ? colors.primary + '20'
                                        : colors.surfaceElevated,
                                    borderColor: selectedFacts.includes(option) ? colors.primary : colors.border,
                                },
                            ]}
                            onPress={() => handleFactSelect(option)}
                            activeOpacity={0.7}
                        >
                            <Text style={[styles.optionText, { color: colors.text }]}>{option}</Text>
                            {selectedFacts.includes(option) && (
                                <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
                            )}
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                {showScrollHint && (
                    <View style={{ position: 'absolute', bottom: 8, left: 0, right: 0, alignItems: 'center', zIndex: 10 }}>
                        <MotiView
                            from={{ opacity: 0, translateY: 10 }}
                            animate={{ opacity: 1, translateY: 0 }}
                            transition={{ type: 'timing', duration: 400, delay: 500 } as any}
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                backgroundColor: colors.primary,
                                paddingHorizontal: 14,
                                paddingVertical: 8,
                                borderRadius: 20,
                            }}
                        >
                            <Text style={{ color: '#fff', fontSize: 13, fontFamily: 'SpaceGrotesk-Bold', marginRight: 6 }}>
                                Scroll for more
                            </Text>
                            <MotiView
                                animate={{ translateY: [0, 4, 0] }}
                                transition={{ loop: true, type: 'timing', duration: 700 } as any}
                            >
                                <Ionicons name="chevron-down" size={16} color="#fff" />
                            </MotiView>
                        </MotiView>
                    </View>
                )}
            </View>

            <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: colors.primary }]}
                onPress={handleActiveTestSubmit}
                activeOpacity={0.8}
            >
                <Text style={styles.primaryButtonText}>Check my answers</Text>
            </TouchableOpacity>
        </View>
    );

    const renderFinalResult = () => (
        <View style={styles.phaseContainer}>
            <View style={styles.mascotSection}>
                <MotiView
                    animate={{ scale: [1, 1.15, 1] }}
                    transition={{ loop: true, type: 'timing', duration: 1500 } as any}
                >
                    <Image source={BrigoProud} style={styles.mascotImageSmall} resizeMode="contain" />
                </MotiView>
            </View>

            <MotiView
                from={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                style={[styles.comparisonCard, { backgroundColor: colors.surfaceElevated }]}
            >
                <View style={styles.comparisonRow}>
                    <View style={styles.comparisonItem}>
                        <Text style={[styles.comparisonLabel, { color: colors.textMuted }]}>Before</Text>
                        <Text style={[styles.comparisonScore, { color: colors.textMuted }]}>
                            {passiveScore}/5
                        </Text>
                    </View>

                    <MotiView
                        animate={{ scale: [1, 1.1, 1] }}
                        transition={{ loop: true, type: 'timing', duration: 1000 } as any}
                    >
                        <Ionicons name="arrow-forward" size={28} color={colors.primary} />
                    </MotiView>

                    <View style={styles.comparisonItem}>
                        <Text style={[styles.comparisonLabel, { color: colors.primary }]}>With Brigo</Text>
                        <Text style={[styles.comparisonScore, { color: colors.primary }]}>
                            {activeScore}/5
                        </Text>
                    </View>
                </View>
            </MotiView>

            <MotiView
                from={{ opacity: 0, translateY: 20 }}
                animate={{ opacity: 1, translateY: 0 }}
                transition={{ delay: 800 } as any}
                style={[styles.revelationCard, { backgroundColor: colors.primary + '10' }]}
            >
                <Text style={[styles.revelationTitle, { color: colors.text }]}>Same brain. Same facts.</Text>
                <Text style={[styles.revelationSubtitle, { color: colors.primary, marginTop: 4 }]}>
                    Smarter method.
                </Text>
                <Text style={[styles.revelationText, { color: colors.textSecondary }]}>
                    Brigo uses AI to help you study the right way.
                </Text>
            </MotiView>

            <ActionButton
                text="Continue"
                onPress={onComplete}
                backgroundColor={colors.primary}
                delay={1500}
            />
        </View>
    );

    // === MAIN RENDER ===

    const renderContent = () => {
        switch (phase) {
            case 'intro':
                return renderIntro();
            case 'showFacts':
                return renderShowFacts();
            case 'distraction':
                return renderDistraction();
            case 'passiveTest':
                return renderPassiveTest();
            case 'passiveResult':
                return renderPassiveResult();
            case 'brigoIntro':
                return renderBrigoIntro();
            case 'activeRecall':
                return renderActiveRecall();
            case 'activeTest':
                return renderActiveTest();
            case 'finalResult':
                return renderFinalResult();
            default:
                return null;
        }
    };

    return <View style={styles.container}>{renderContent()}</View>;
}
