import React, { useState } from 'react';
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

interface Screen4_EducationProps {
    colors: ReturnType<typeof getThemeColors>;
}

const EDUCATION_OPTIONS = [
    { id: 'middle_high', label: 'Middle / high school', description: 'Studying for school exams or grades', icon: 'school-outline' },
    { id: 'college', label: 'College / university', description: 'Undergrad or grad-level coursework', icon: 'library-outline' },
    { id: 'professional', label: 'Working professional', description: 'Career-focused learning', icon: 'briefcase-outline' },
    { id: 'lifelong', label: 'Lifelong learner', description: 'Learning for curiosity & growth', icon: 'sparkles-outline' },
];

export function Screen4_Education({ colors }: Screen4_EducationProps) {
    const { educationLevel, setEducationLevel } = useStore();

    const handleSelect = (id: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setEducationLevel(id);
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
                        What describes you best?
                    </Text>
                    <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                        This helps personalize your experience
                    </Text>
                </View>

                {/* Options List */}
                <View style={styles.optionsSection}>
                    {EDUCATION_OPTIONS.map((option, index) => {
                        const isSelected = educationLevel === option.id;
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
