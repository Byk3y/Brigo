/**
 * SourceSelectionModal - Modal for selecting which sources to use in chat
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    View,
    Text,
    Pressable,
    Modal,
    ScrollView,
    StyleSheet,
    Animated,
    Dimensions,
    Easing,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, getThemeColors } from '@/lib/ThemeContext';
import type { Material } from '@/lib/store';

interface SourceSelectionModalProps {
    visible: boolean;
    onDismiss: () => void;
    materials: Material[];
    selectedMaterialIds: string[];
    onToggleMaterial: (id: string) => void;
    onSelectAll: () => void;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const getMaterialIcon = (type: string) => {
    switch (type) {
        case 'pdf': return 'document-text';
        case 'audio': return 'musical-notes';
        case 'image':
        case 'photo': return 'image';
        case 'website': return 'globe';
        case 'youtube': return 'logo-youtube';
        case 'copied-text': return 'document';
        default: return 'document';
    }
};

export const SourceSelectionModal: React.FC<SourceSelectionModalProps> = ({
    visible,
    onDismiss,
    materials,
    selectedMaterialIds,
    onToggleMaterial,
    onSelectAll,
}) => {
    const { isDarkMode } = useTheme();
    const colors = getThemeColors(isDarkMode);
    const insets = useSafeAreaInsets();

    const allSelected = selectedMaterialIds.length === materials.length && materials.length > 0;

    // Drive the backdrop fade and sheet slide independently. Modal's built-in
    // animationType="slide" would slide the backdrop up with the sheet, which
    // looks like the tint is rolling in rather than just applied.
    const backdropOpacity = useRef(new Animated.Value(0)).current;
    const sheetTranslateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
    const [mounted, setMounted] = useState(visible);

    useEffect(() => {
        if (visible) {
            setMounted(true);
            Animated.parallel([
                Animated.timing(backdropOpacity, {
                    toValue: 1,
                    duration: 220,
                    easing: Easing.out(Easing.quad),
                    useNativeDriver: true,
                }),
                Animated.spring(sheetTranslateY, {
                    toValue: 0,
                    damping: 26,
                    stiffness: 220,
                    mass: 1,
                    useNativeDriver: true,
                }),
            ]).start();
        } else if (mounted) {
            Animated.parallel([
                Animated.timing(backdropOpacity, {
                    toValue: 0,
                    duration: 180,
                    easing: Easing.in(Easing.quad),
                    useNativeDriver: true,
                }),
                Animated.timing(sheetTranslateY, {
                    toValue: SCREEN_HEIGHT,
                    duration: 220,
                    easing: Easing.in(Easing.cubic),
                    useNativeDriver: true,
                }),
            ]).start(({ finished }) => {
                if (finished) setMounted(false);
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [visible]);

    // Swallow presses on the sheet so they don't bubble up to the backdrop
    // Pressable and dismiss the modal.
    const swallowPress = useCallback(() => { }, []);

    if (!mounted) return null;

    return (
        <Modal
            visible={mounted}
            transparent
            animationType="none"
            onRequestClose={onDismiss}
            statusBarTranslucent
            navigationBarTranslucent
        >
            <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
                <Pressable
                    style={StyleSheet.absoluteFill}
                    onPress={onDismiss}
                    accessibilityLabel="Close source picker"
                />
                <Animated.View
                    style={[
                        styles.sheet,
                        {
                            backgroundColor: colors.surfaceElevated,
                            paddingBottom: Math.max(insets.bottom, 16),
                            transform: [{ translateY: sheetTranslateY }],
                        },
                    ]}
                >
                    <Pressable onPress={swallowPress}>
                        {/* Header */}
                        <View style={styles.header}>
                            <Text style={[styles.title, { color: colors.text }]}>Select sources</Text>
                            <Pressable
                                onPress={onDismiss}
                                hitSlop={12}
                                accessibilityLabel="Close"
                                accessibilityRole="button"
                                style={({ pressed }) => [
                                    styles.closeButton,
                                    pressed && { opacity: 0.6 },
                                ]}
                            >
                                <Ionicons name="close" size={22} color={colors.text} />
                            </Pressable>
                        </View>

                        {/* Select All */}
                        {materials.length > 0 && (
                            <Pressable
                                onPress={onSelectAll}
                                accessibilityRole="checkbox"
                                accessibilityState={{ checked: allSelected }}
                                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                            >
                                <View style={[styles.selectAllRow, { borderBottomColor: colors.border }]}>
                                    <Text style={[styles.selectAllText, { color: colors.text }]}>Select all</Text>
                                    <Checkbox
                                        checked={allSelected}
                                        primary={colors.primary}
                                        border={colors.textSecondary}
                                    />
                                </View>
                            </Pressable>
                        )}

                        {/* Sources List */}
                        <ScrollView
                            style={styles.list}
                            keyboardShouldPersistTaps="handled"
                            showsVerticalScrollIndicator={false}
                        >
                            {materials.length === 0 ? (
                                <View style={styles.emptyState}>
                                    <Ionicons name="folder-open-outline" size={28} color={colors.iconMuted} />
                                    <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                                        No sources yet. Add materials to this notebook to chat with them.
                                    </Text>
                                </View>
                            ) : (
                                materials.map((mat, index) => {
                                    const isSelected = selectedMaterialIds.includes(mat.id);
                                    return (
                                        <Pressable
                                            key={mat.id || index}
                                            onPress={() => onToggleMaterial(mat.id)}
                                            accessibilityRole="checkbox"
                                            accessibilityState={{ checked: isSelected }}
                                            style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                                        >
                                            <View style={styles.sourceRow}>
                                                <View style={[styles.sourceIcon, { backgroundColor: colors.surfaceAlt }]}>
                                                    <Ionicons name={getMaterialIcon(mat.type)} size={18} color={colors.iconMuted} />
                                                </View>
                                                <View style={styles.sourceNameWrap}>
                                                    <Text
                                                        style={[styles.sourceName, { color: colors.text }]}
                                                        numberOfLines={2}
                                                    >
                                                        {mat.filename || mat.title || `Source ${index + 1}`}
                                                    </Text>
                                                </View>
                                                <Checkbox
                                                    checked={isSelected}
                                                    primary={colors.primary}
                                                    border={colors.textSecondary}
                                                />
                                            </View>
                                        </Pressable>
                                    );
                                })
                            )}
                            <View style={{ height: 24 }} />
                        </ScrollView>

                        {/* Done Button */}
                        <View style={styles.doneWrap}>
                            <Pressable
                                onPress={onDismiss}
                                accessibilityRole="button"
                                accessibilityLabel="Done"
                                style={({ pressed }) => [
                                    styles.doneButton,
                                    { backgroundColor: colors.primary },
                                    pressed && { opacity: 0.85 },
                                ]}
                            >
                                <Text style={styles.doneText}>Done</Text>
                            </Pressable>
                        </View>
                    </Pressable>
                </Animated.View>
            </Animated.View>
        </Modal>
    );
};

interface CheckboxProps {
    checked: boolean;
    primary: string;
    border: string;
}

const Checkbox: React.FC<CheckboxProps> = ({ checked, primary, border }) => (
    <View
        style={[
            styles.checkbox,
            {
                backgroundColor: checked ? primary : 'transparent',
                borderWidth: checked ? 0 : 2,
                borderColor: border,
            },
        ]}
    >
        {checked && <Ionicons name="checkmark" size={14} color="#FFFFFF" />}
    </View>
);

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'flex-end',
    },
    sheet: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '80%',
        paddingTop: 16,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        marginBottom: 12,
    },
    title: {
        fontSize: 18,
        fontFamily: 'Nunito-Bold',
    },
    closeButton: {
        padding: 8,
        margin: -8,
    },
    selectAllRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderBottomWidth: 1,
    },
    selectAllText: {
        fontSize: 16,
        fontFamily: 'Nunito-SemiBold',
    },
    list: {
        paddingHorizontal: 20,
        paddingTop: 12,
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 40,
        gap: 12,
    },
    emptyText: {
        fontSize: 14,
        fontFamily: 'Nunito-Regular',
        textAlign: 'center',
        maxWidth: 260,
        lineHeight: 20,
    },
    sourceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 12,
    },
    sourceIcon: {
        width: 40,
        height: 40,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sourceNameWrap: {
        flex: 1,
    },
    sourceName: {
        fontSize: 15,
        fontFamily: 'Nunito-Medium',
    },
    checkbox: {
        width: 20,
        height: 20,
        borderRadius: 4,
        alignItems: 'center',
        justifyContent: 'center',
    },
    doneWrap: {
        paddingHorizontal: 20,
        paddingTop: 12,
    },
    doneButton: {
        borderRadius: 24,
        paddingVertical: 14,
        alignItems: 'center',
    },
    doneText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontFamily: 'Nunito-Bold',
    },
});
