import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Platform } from 'react-native';
import { RenderProps } from 'react-native-spotlight-tour';
import { Ionicons } from '@expo/vector-icons';
import {
    HOME_WALKTHROUGH_STEPS,
    NOTEBOOK_WALKTHROUGH_STEPS,
    STUDIO_WALKTHROUGH_STEPS,
    type WalkthroughStep
} from './constants';
import { useStore } from '@/lib/store';
import { useTheme, getThemeColors } from '@/lib/ThemeContext';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const IS_SMALL_DEVICE = SCREEN_WIDTH < 375;

interface GenericTooltipProps extends RenderProps {
    steps: Record<string, WalkthroughStep>;
}

export const GenericWalkthroughTooltip: React.FC<GenericTooltipProps> = ({
    isFirst,
    isLast,
    next,
    previous,
    stop,
    current,
    steps,
}) => {
    const { petState } = useStore();
    const { isDarkMode } = useTheme();
    const colors = getThemeColors(isDarkMode);

    // Convert Record to Array and sort by order to get the correct step by index
    const stepsArray = Object.values(steps).sort((a, b) => a.order - b.order);
    const step = stepsArray[current];

    if (!step) return null;

    // Personalization: Replace "study buddy" with pet name for specific steps
    const petStateName = petState.name;
    const isDefaultName = !petStateName || ['Nova', 'Sparky', 'Pet', 'Bridget', 'Holian', ''].includes(petStateName);
    const petName = isDefaultName ? 'study buddy' : petStateName;

    let displayText = step.text;
    if (step.title.includes('Companion') || step.title.includes('Buddy')) {
        if (isDefaultName) {
            // Keep original "your study buddy" or standard phrasing
            displayText = step.text;
        } else {
            // Natural phrasing: "Tap Max" instead of "Tap your Max"
            displayText = step.text.replace(/your study buddy/gi, petName);
            // Fallback for cases where "your" isn't present
            displayText = displayText.replace(/study buddy/gi, petName);
        }
    }

    return (
        <View style={[styles.container, { backgroundColor: colors.surfaceElevated }]}>
            {/* Header with title */}
            <View style={styles.header}>
                <Text style={[styles.title, { color: colors.text }]}>{step.title}</Text>
                <TouchableOpacity onPress={stop} style={styles.closeButton} activeOpacity={0.7}>
                    <Ionicons name="close" size={20} color={colors.textMuted} />
                </TouchableOpacity>
            </View>

            {/* Body text */}
            <Text style={[styles.text, { color: colors.textSecondary }]}>{displayText}</Text>

            {/* Navigation buttons */}
            <View style={styles.buttonContainer}>
                {!isFirst ? (
                    <TouchableOpacity onPress={previous} style={styles.backButton} activeOpacity={0.7}>
                        <Text style={[styles.backButtonText, { color: colors.textMuted }]}>← Back</Text>
                    </TouchableOpacity>
                ) : (
                    <View style={styles.backButton} />
                )}

                <View style={{ flex: 1 }} />

                {isLast ? (
                    <TouchableOpacity onPress={stop} style={styles.doneButton} activeOpacity={0.8}>
                        <Text style={styles.doneButtonText}>Got it! ✓</Text>
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity onPress={next} style={styles.nextButton} activeOpacity={0.8}>
                        <Text style={styles.nextButtonText}>Next →</Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* Skip option (only if not last step) */}
            {!isLast && (
                <TouchableOpacity onPress={stop} style={styles.skipContainer} activeOpacity={0.6}>
                    <Text style={[styles.skipText, { color: colors.textMuted }]}>Skip tour</Text>
                </TouchableOpacity>
            )}
        </View>
    );
};

// Tour-specific tooltips
export const HomeWalkthroughTooltip = (props: RenderProps) => (
    <GenericWalkthroughTooltip {...props} steps={HOME_WALKTHROUGH_STEPS} />
);

export const NotebookWalkthroughTooltip = (props: RenderProps) => (
    <GenericWalkthroughTooltip {...props} steps={NOTEBOOK_WALKTHROUGH_STEPS} />
);

export const StudioWalkthroughTooltip = (props: RenderProps) => (
    <GenericWalkthroughTooltip {...props} steps={STUDIO_WALKTHROUGH_STEPS} />
);

// Default export for backward compatibility or if needed
export const WalkthroughTooltip = HomeWalkthroughTooltip;

const styles = StyleSheet.create({
    container: {
        borderRadius: 24,
        padding: 24,
        width: Math.min(SCREEN_WIDTH - 40, 320),
        shadowColor: 'rgba(0, 0, 0, 0.4)',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.3,
        shadowRadius: 30,
        elevation: 15,
        margin: 20,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    title: {
        fontSize: 18,
        fontFamily: 'Nunito-Bold',
        flex: 1,
    },
    closeButton: {
        padding: 4,
    },
    text: {
        fontSize: 15,
        fontFamily: 'Nunito-Regular',
        lineHeight: 22,
        marginBottom: 20,
    },
    buttonContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    backButton: {
        paddingVertical: 8,
        paddingHorizontal: 8,
        minWidth: 70,
    },
    backButtonText: {
        fontSize: 14,
        fontFamily: 'Nunito-SemiBold',
    },
    nextButton: {
        backgroundColor: '#6366F1',
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 999,
        minWidth: 100,
        alignItems: 'center',
    },
    nextButtonText: {
        fontSize: 14,
        fontFamily: 'Nunito-Bold',
        color: '#FFFFFF',
    },
    doneButton: {
        backgroundColor: '#10B981',
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 999,
        minWidth: 100,
        alignItems: 'center',
    },
    doneButtonText: {
        fontSize: 14,
        fontFamily: 'Nunito-Bold',
        color: '#FFFFFF',
    },
    skipContainer: {
        alignItems: 'center',
        marginTop: 16,
    },
    skipText: {
        fontSize: 13,
        fontFamily: 'Nunito-Medium',
        color: '#9CA3AF',
        textDecorationLine: 'underline',
    },
});


