/**
 * AhaMoment Styles
 * All StyleSheet definitions for the Aha Moment screen
 */

import { StyleSheet, Dimensions } from 'react-native';

const { width } = Dimensions.get('window');

// Cap dimensions for tablet optimization
const MASCOT_SIZE = Math.min(width * 0.32, 130);
const MASCOT_SIZE_SMALL = Math.min(width * 0.25, 100);
const MASCOT_SECTION_HEIGHT = Math.min(width * 0.35, 140);
const MAX_CONTENT_WIDTH = 500;

export const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: 24,
    },
    phaseContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 10,
    },

    // Mascot styles
    mascotSection: {
        height: MASCOT_SECTION_HEIGHT,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    mascotImage: {
        width: MASCOT_SIZE,
        height: MASCOT_SIZE,
    },
    mascotImageSmall: {
        width: MASCOT_SIZE_SMALL,
        height: MASCOT_SIZE_SMALL,
    },

    // Speech bubble styles
    speechBubble: {
        padding: 20,
        borderRadius: 24,
        width: '100%',
        maxWidth: MAX_CONTENT_WIDTH,
        alignSelf: 'center',
        marginBottom: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 3,
    },
    bubbleText: {
        fontSize: 17,
        fontFamily: 'SpaceGrotesk-Medium',
        lineHeight: 24,
        textAlign: 'center',
    },
    bubbleTail: {
        position: 'absolute',
        top: -11,
        left: '50%',
        marginLeft: -10,
        transform: [{ rotate: '180deg' }],
    },

    // Button styles
    ctaContainer: {
        alignItems: 'center',
        width: '100%',
    },
    primaryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        paddingHorizontal: 32,
        borderRadius: 16,
        gap: 8,
        width: '100%',
        maxWidth: MAX_CONTENT_WIDTH,
        alignSelf: 'center',
    },
    primaryButtonText: {
        color: '#fff',
        fontSize: 17,
        fontFamily: 'SpaceGrotesk-Bold',
    },
    timeHint: {
        fontSize: 13,
        fontFamily: 'SpaceGrotesk-Regular',
        marginTop: 12,
    },

    // Instruction card styles
    instructionCard: {
        padding: 10,
        borderRadius: 16,
        width: '100%',
        maxWidth: MAX_CONTENT_WIDTH,
        alignSelf: 'center',
        marginBottom: 8,
        alignItems: 'center',
    },
    instructionTitle: {
        fontSize: 12,
        fontFamily: 'SpaceGrotesk-Bold',
        letterSpacing: 1.5,
        marginBottom: 4,
    },
    instructionText: {
        fontSize: 15,
        fontFamily: 'SpaceGrotesk-Medium',
    },

    // Fact display styles
    factDisplayContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
        minHeight: 200,
    },
    factCard: {
        padding: 32,
        borderRadius: 24,
        width: '100%',
        alignItems: 'center',
        borderWidth: 2,
    },
    factNumber: {
        fontSize: 12,
        fontFamily: 'SpaceGrotesk-Bold',
        letterSpacing: 1,
        marginBottom: 12,
    },
    factText: {
        fontSize: 22,
        fontFamily: 'SpaceGrotesk-Bold',
        textAlign: 'center',
        lineHeight: 30,
    },
    progressDots: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 24,
    },
    progressDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },

    // Input styles
    inputCard: {
        padding: 24,
        borderRadius: 24,
        width: '100%',
    },
    inputLabel: {
        fontSize: 15,
        fontFamily: 'SpaceGrotesk-Medium',
        marginBottom: 12,
    },
    textInput: {
        padding: 16,
        borderRadius: 12,
        fontSize: 16,
        fontFamily: 'SpaceGrotesk-Medium',
        borderWidth: 1,
        marginBottom: 16,
    },
    submitButton: {
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    submitButtonText: {
        color: '#fff',
        fontSize: 16,
        fontFamily: 'SpaceGrotesk-Bold',
    },

    // Motivation selection styles
    motivationGrid: {
        width: '100%',
        maxWidth: MAX_CONTENT_WIDTH,
        alignSelf: 'center',
        gap: 12,
    },
    motivationCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderRadius: 16,
        borderWidth: 2,
        gap: 12,
    },
    motivationIcon: {
        width: 44,
        height: 44,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    motivationTextContainer: {
        flex: 1,
    },
    motivationTitle: {
        fontSize: 16,
        fontFamily: 'SpaceGrotesk-Bold',
    },
    motivationDesc: {
        fontSize: 13,
        fontFamily: 'SpaceGrotesk-Regular',
        marginTop: 2,
    },

    // Options/test styles
    optionsContainer: {
        flex: 1,
        width: '100%',
        maxWidth: MAX_CONTENT_WIDTH,
        alignSelf: 'center',
        marginBottom: 16,
    },
    optionCard: {
        padding: 16,
        borderRadius: 16,
        marginBottom: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderWidth: 2,
    },
    optionText: {
        fontSize: 15,
        fontFamily: 'SpaceGrotesk-Medium',
        flex: 1,
    },

    // Result styles
    resultCard: {
        padding: 32,
        borderRadius: 24,
        width: '100%',
        alignItems: 'center',
        marginBottom: 24,
    },
    resultScore: {
        fontSize: 64,
        fontFamily: 'SpaceGrotesk-Bold',
    },
    resultLabel: {
        fontSize: 16,
        fontFamily: 'SpaceGrotesk-Medium',
        marginTop: 4,
    },
    resultDivider: {
        width: 60,
        height: 2,
        marginVertical: 20,
    },
    resultMessage: {
        fontSize: 18,
        fontFamily: 'SpaceGrotesk-Bold',
        textAlign: 'center',
    },
    resultSubtext: {
        fontSize: 14,
        fontFamily: 'SpaceGrotesk-Regular',
        textAlign: 'center',
        marginTop: 8,
    },

    // Question styles
    questionCard: {
        padding: 24,
        borderRadius: 24,
        width: '100%',
        maxWidth: MAX_CONTENT_WIDTH,
        alignSelf: 'center',
        alignItems: 'center',
        borderWidth: 2,
    },
    questionLabel: {
        fontSize: 12,
        fontFamily: 'SpaceGrotesk-Bold',
        letterSpacing: 1,
        marginBottom: 12,
    },
    questionText: {
        fontSize: 18,
        fontFamily: 'SpaceGrotesk-Bold',
        textAlign: 'center',
        marginBottom: 20,
        lineHeight: 26,
    },
    answerButtons: {
        flexDirection: 'row',
        gap: 12,
        width: '100%',
    },
    answerButton: {
        flex: 1,
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    answerButtonText: {
        color: '#fff',
        fontSize: 15,
        fontFamily: 'SpaceGrotesk-Bold',
    },

    // Multiple choice styles (for active test)
    multiChoiceContainer: {
        width: '100%',
        maxWidth: MAX_CONTENT_WIDTH,
        alignSelf: 'center',
        gap: 10,
    },
    multiChoiceButton: {
        width: '100%',
        padding: 16,
        borderRadius: 12,
        borderWidth: 2,
        alignItems: 'center',
    },
    multiChoiceText: {
        fontSize: 16,
        fontFamily: 'SpaceGrotesk-Medium',
    },

    // Comparison/final result styles
    comparisonCard: {
        padding: 32,
        borderRadius: 24,
        width: '100%',
        marginBottom: 24,
    },
    comparisonRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    comparisonItem: {
        alignItems: 'center',
        flex: 1,
    },
    comparisonLabel: {
        fontSize: 14,
        fontFamily: 'SpaceGrotesk-Medium',
        marginBottom: 8,
    },
    comparisonScore: {
        fontSize: 42,
        fontFamily: 'SpaceGrotesk-Bold',
    },
    revelationCard: {
        padding: 24,
        borderRadius: 24,
        width: '100%',
        marginBottom: 24,
        alignItems: 'center',
    },
    revelationTitle: {
        fontSize: 22,
        fontFamily: 'SpaceGrotesk-Bold',
        textAlign: 'center',
    },
    revelationSubtitle: {
        fontSize: 22,
        fontFamily: 'SpaceGrotesk-Bold',
        textAlign: 'center',
    },
    revelationText: {
        fontSize: 15,
        fontFamily: 'SpaceGrotesk-Medium',
        textAlign: 'center',
        marginTop: 16,
        lineHeight: 22,
    },

    // Active recall card styles
    activeCard: {
        padding: 24,
        borderRadius: 24,
        width: '100%',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 3,
    },
    activeFactText: {
        fontSize: 20,
        fontFamily: 'SpaceGrotesk-Bold',
        textAlign: 'center',
        lineHeight: 28,
        marginBottom: 16,
    },
    activeDivider: {
        width: 60,
        height: 2,
        borderRadius: 1,
        marginBottom: 16,
    },
    activeQuestion: {
        fontSize: 16,
        fontFamily: 'SpaceGrotesk-Medium',
        textAlign: 'center',
        marginBottom: 12,
    },
    activeAnswer: {
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 12,
    },
    activeAnswerText: {
        fontSize: 18,
        fontFamily: 'SpaceGrotesk-Bold',
        textAlign: 'center',
    },
});
