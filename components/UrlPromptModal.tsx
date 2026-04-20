/**
 * UrlPromptModal — cross-platform URL input prompt.
 *
 * Replaces Alert.prompt() which is iOS-only; on Android the native
 * Alert.prompt silently no-ops, breaking any flow that depends on it
 * (YouTube import, Website import).
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    View,
    Text,
    Pressable,
    Modal,
    TextInput,
    StyleSheet,
    Animated,
    Dimensions,
    Easing,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, getThemeColors } from '@/lib/ThemeContext';

interface UrlPromptModalProps {
    visible: boolean;
    title: string;
    message?: string;
    placeholder?: string;
    submitLabel?: string;
    initialValue?: string;
    onCancel: () => void;
    onSubmit: (url: string) => void;
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export const UrlPromptModal: React.FC<UrlPromptModalProps> = ({
    visible,
    title,
    message,
    placeholder = 'https://...',
    submitLabel = 'Import',
    initialValue = '',
    onCancel,
    onSubmit,
}) => {
    const { isDarkMode } = useTheme();
    const colors = getThemeColors(isDarkMode);
    const insets = useSafeAreaInsets();

    const [value, setValue] = useState(initialValue);
    const inputRef = useRef<TextInput>(null);

    const backdropOpacity = useRef(new Animated.Value(0)).current;
    const sheetTranslateY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
    const [mounted, setMounted] = useState(visible);

    useEffect(() => {
        if (visible) {
            setValue(initialValue);
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
            ]).start(() => {
                // Auto-focus after the slide finishes so the keyboard animation
                // doesn't race the sheet animation on Android.
                inputRef.current?.focus();
            });
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

    const swallowPress = useCallback(() => { }, []);

    const handleSubmit = useCallback(() => {
        const trimmed = value.trim();
        if (!trimmed) return;
        onSubmit(trimmed);
    }, [value, onSubmit]);

    if (!mounted) return null;

    const canSubmit = value.trim().length > 0;

    return (
        <Modal
            visible={mounted}
            transparent
            animationType="none"
            onRequestClose={onCancel}
            statusBarTranslucent
            navigationBarTranslucent
        >
            <Animated.View style={[styles.backdrop, { opacity: backdropOpacity }]}>
                <Pressable
                    style={StyleSheet.absoluteFill}
                    onPress={onCancel}
                    accessibilityLabel="Dismiss"
                />
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    style={styles.kavWrap}
                    pointerEvents="box-none"
                >
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
                            <View style={styles.header}>
                                <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
                                <Pressable
                                    onPress={onCancel}
                                    hitSlop={12}
                                    accessibilityLabel="Cancel"
                                    accessibilityRole="button"
                                    style={({ pressed }) => [
                                        styles.closeButton,
                                        pressed && { opacity: 0.6 },
                                    ]}
                                >
                                    <Ionicons name="close" size={22} color={colors.text} />
                                </Pressable>
                            </View>

                            {message ? (
                                <Text style={[styles.message, { color: colors.textSecondary }]}>
                                    {message}
                                </Text>
                            ) : null}

                            <View style={[styles.inputWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                                <TextInput
                                    ref={inputRef}
                                    value={value}
                                    onChangeText={setValue}
                                    placeholder={placeholder}
                                    placeholderTextColor={colors.textMuted}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    keyboardType="url"
                                    returnKeyType="go"
                                    onSubmitEditing={handleSubmit}
                                    style={[styles.input, { color: colors.text }]}
                                    selectionColor={colors.primary}
                                />
                            </View>

                            <View style={styles.buttonRow}>
                                <Pressable
                                    onPress={onCancel}
                                    accessibilityRole="button"
                                    accessibilityLabel="Cancel"
                                    style={({ pressed }) => [
                                        styles.secondaryButton,
                                        { borderColor: colors.border },
                                        pressed && { opacity: 0.7 },
                                    ]}
                                >
                                    <Text style={[styles.secondaryButtonText, { color: colors.text }]}>Cancel</Text>
                                </Pressable>
                                <Pressable
                                    onPress={handleSubmit}
                                    disabled={!canSubmit}
                                    accessibilityRole="button"
                                    accessibilityLabel={submitLabel}
                                    style={({ pressed }) => [
                                        styles.primaryButton,
                                        { backgroundColor: colors.primary },
                                        !canSubmit && { opacity: 0.5 },
                                        pressed && canSubmit && { opacity: 0.85 },
                                    ]}
                                >
                                    <Text style={styles.primaryButtonText}>{submitLabel}</Text>
                                </Pressable>
                            </View>
                        </Pressable>
                    </Animated.View>
                </KeyboardAvoidingView>
            </Animated.View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
    },
    kavWrap: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    sheet: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingTop: 20,
        paddingHorizontal: 20,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    title: {
        fontSize: 18,
        fontFamily: 'Nunito-Bold',
    },
    closeButton: {
        padding: 8,
        margin: -8,
    },
    message: {
        fontSize: 14,
        fontFamily: 'Nunito-Regular',
        marginBottom: 16,
        lineHeight: 20,
    },
    inputWrap: {
        borderRadius: 12,
        borderWidth: 1,
        paddingHorizontal: 14,
        marginBottom: 20,
    },
    input: {
        fontSize: 16,
        fontFamily: 'Nunito-Medium',
        paddingVertical: 14,
    },
    buttonRow: {
        flexDirection: 'row',
        gap: 12,
    },
    secondaryButton: {
        flex: 1,
        borderRadius: 12,
        borderWidth: 1,
        paddingVertical: 14,
        alignItems: 'center',
    },
    secondaryButtonText: {
        fontSize: 15,
        fontFamily: 'Nunito-SemiBold',
    },
    primaryButton: {
        flex: 1,
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: 'center',
    },
    primaryButtonText: {
        fontSize: 15,
        fontFamily: 'Nunito-Bold',
        color: '#FFFFFF',
    },
});

export default UrlPromptModal;
