import React from 'react';
import { View, StyleSheet, Dimensions, Text, TouchableOpacity, Image } from 'react-native';
import { MotiView } from 'moti';
import { getThemeColors } from '@/lib/ThemeContext';
import { useStore } from '@/lib/store';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { ResponsiveContainer } from '@/lib/components/ResponsiveContainer';

const { width } = Dimensions.get('window');

// Cap dimensions for tablet optimization
const PET_SIZE = Math.min(width * 0.22, 90);
const PET_SECTION_HEIGHT = Math.min(width * 0.28, 110);

// Use Stage 1 pet for consistency
const PetStage1 = require('../../../assets/pets/stage-1/full-view.png');

interface Screen4_LearningStyleProps {
    colors: ReturnType<typeof getThemeColors>;
}

const LEARNING_OPTIONS = [
    { id: 'visual', label: 'Visual', description: 'I like diagrams & images', icon: 'images-outline' },
    { id: 'auditory', label: 'Listening', description: 'I learn by hearing', icon: 'headset-outline' },
    { id: 'reading', label: 'Reading', description: 'I prefer written notes', icon: 'reader-outline' },
    { id: 'practice', label: 'Hands-on', description: 'I learn by doing', icon: 'construct-outline' },
];

export function Screen4_LearningStyle({ colors }: Screen4_LearningStyleProps) {
    const { learningStyle, setLearningStyle } = useStore();

    const handleSelect = (id: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setLearningStyle(id as 'visual' | 'auditory' | 'reading' | 'practice');
    };

    return (
        <View style={styles.container}>
            <ResponsiveContainer>
                {/* Pet Image */}
                <View style={styles.petSection}>
                    <MotiView
                        from={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ type: 'spring', damping: 15 } as any}
                    >
                        <MotiView
                            animate={{ translateY: [-4, 4, -4] }}
                            transition={{ loop: true, type: 'timing', duration: 3000 } as any}
                        >
                            <Image source={PetStage1} style={styles.petImage} resizeMode="contain" />
                        </MotiView>
                    </MotiView>
                </View>

                {/* Headline */}
                <View style={styles.headlineSection}>
                    <Text style={[styles.headline, { color: colors.text }]}>
                        How do you learn best?
                    </Text>
                    <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                        Pick what feels most natural
                    </Text>
                </View>

                {/* Options List */}
                <View style={styles.optionsSection}>
                    {LEARNING_OPTIONS.map((option, index) => {
                        const isSelected = learningStyle === option.id;
                        return (
                            <MotiView
                                key={option.id}
                                from={{ opacity: 0, translateY: 10 }}
                                animate={{ opacity: 1, translateY: 0 }}
                                transition={{ delay: index * 100 } as any}
                            >
                                <TouchableOpacity
                                    onPress={() => handleSelect(option.id)}
                                    activeOpacity={0.7}
                                    style={[
                                        styles.optionItem,
                                        {
                                            backgroundColor: isSelected ? colors.primary : colors.surfaceElevated,
                                            borderColor: isSelected ? colors.primary : colors.border + '40',
                                        },
                                    ]}
                                >
                                    <View style={styles.optionContent}>
                                        <Ionicons
                                            name={option.icon as any}
                                            size={22}
                                            color={isSelected ? 'white' : colors.primary}
                                            style={styles.optionIcon}
                                        />
                                        <View style={styles.optionTextContainer}>
                                            <Text style={[
                                                styles.optionLabel,
                                                { color: isSelected ? 'white' : colors.text }
                                            ]}>
                                                {option.label}
                                            </Text>
                                            <Text style={[
                                                styles.optionDescription,
                                                { color: isSelected ? 'rgba(255,255,255,0.8)' : colors.textSecondary }
                                            ]}>
                                                {option.description}
                                            </Text>
                                        </View>
                                    </View>
                                    <View style={[
                                        styles.radioOuter,
                                        { borderColor: isSelected ? 'white' : colors.border }
                                    ]}>
                                        {isSelected && (
                                            <View style={[styles.radioInner, { backgroundColor: 'white' }]} />
                                        )}
                                    </View>
                                </TouchableOpacity>
                            </MotiView>
                        );
                    })}
                </View>
            </ResponsiveContainer>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingHorizontal: 24,
    },
    petSection: {
        alignItems: 'center',
        height: PET_SECTION_HEIGHT,
        justifyContent: 'center',
    },
    petImage: {
        width: PET_SIZE,
        height: PET_SIZE,
    },
    headlineSection: {
        alignItems: 'center',
        marginBottom: 24,
    },
    headline: {
        fontSize: 24,
        fontWeight: '800',
        fontFamily: 'SpaceGrotesk-Bold',
        textAlign: 'center',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 15,
        fontFamily: 'SpaceGrotesk-Regular',
        textAlign: 'center',
    },
    optionsSection: {
        gap: 12,
    },
    optionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 16,
        paddingHorizontal: 16,
        borderRadius: 16,
        borderWidth: 1.5,
    },
    optionContent: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    optionIcon: {
        marginRight: 14,
    },
    optionTextContainer: {
        flex: 1,
    },
    optionLabel: {
        fontSize: 16,
        fontWeight: '700',
        fontFamily: 'SpaceGrotesk-Bold',
        marginBottom: 2,
    },
    optionDescription: {
        fontSize: 13,
        fontFamily: 'SpaceGrotesk-Regular',
    },
    radioOuter: {
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 2,
        alignItems: 'center',
        justifyContent: 'center',
    },
    radioInner: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
});
