/**
 * DiscoveredSourceCard - Card component for displaying a discovered source
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme, getThemeColors } from '@/lib/ThemeContext';

interface DiscoveredSourceCardProps {
    title: string;
    domain: string;
    snippet: string;
    url: string;
    isSelected: boolean;
    onToggle: () => void;
    disabled?: boolean;
}

export const DiscoveredSourceCard: React.FC<DiscoveredSourceCardProps> = ({
    title,
    domain,
    snippet,
    url,
    isSelected,
    onToggle,
    disabled = false,
}) => {
    const { isDarkMode } = useTheme();
    const colors = getThemeColors(isDarkMode);
    const isPDF = url.toLowerCase().endsWith('.pdf');

    return (
        <TouchableOpacity
            onPress={onToggle}
            activeOpacity={0.7}
            disabled={disabled}
            style={[
                styles.container,
                {
                    opacity: disabled ? 0.5 : 1,
                },
            ]}
        >
            <View style={styles.content}>
                {/* Title */}
                <Text
                    numberOfLines={2}
                    style={[styles.title, { color: colors.text }]}
                >
                    {title}
                </Text>

                {/* Domain */}
                <View style={styles.domainContainer}>
                    {isPDF && (
                        <View style={styles.pdfBadge}>
                            <MaterialCommunityIcons name="file-pdf-box" size={12} color="#ef4444" />
                            <Text style={styles.pdfBadgeText}>PDF</Text>
                        </View>
                    )}
                    <Text style={[styles.domain, { color: colors.textSecondary }]}>
                        {domain}
                    </Text>
                </View>

                {/* Snippet */}
                <Text
                    numberOfLines={2}
                    style={[styles.snippet, { color: colors.textSecondary }]}
                >
                    {snippet}
                </Text>
            </View>

            {/* Checkbox */}
            <View
                style={[
                    styles.checkbox,
                    {
                        backgroundColor: isSelected ? colors.primary : 'transparent',
                        borderColor: isSelected ? colors.primary : colors.textMuted,
                    },
                ]}
            >
                {isSelected && <Ionicons name="checkmark-sharp" size={16} color="#FFFFFF" />}
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 14,
    },
    content: {
        flex: 1,
        marginRight: 16,
    },
    title: {
        fontSize: 16,
        fontFamily: 'Nunito-Bold',
        marginBottom: 1,
    },
    domainContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 2,
    },
    pdfBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        gap: 2,
    },
    pdfBadgeText: {
        fontSize: 10,
        fontFamily: 'Nunito-Bold',
        color: '#ef4444',
    },
    domain: {
        fontSize: 12,
        fontFamily: 'Nunito-Medium',
        opacity: 0.5,
    },
    snippet: {
        fontSize: 13,
        fontFamily: 'Nunito-Regular',
        lineHeight: 18,
    },
    checkbox: {
        width: 22,
        height: 22,
        borderRadius: 6,
        borderWidth: 1.5,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
