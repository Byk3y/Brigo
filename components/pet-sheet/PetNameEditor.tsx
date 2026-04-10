/**
 * Pet Name Editor - Frosted glass pill with inline editing
 */

import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/lib/ThemeContext';

interface PetNameEditorProps {
    name: string;
    onNameChange: (newName: string) => void | Promise<void>;
}

export function PetNameEditor({ name, onNameChange }: PetNameEditorProps) {
    const { isDarkMode } = useTheme();
    const [isEditing, setIsEditing] = useState(false);
    const [inputValue, setInputValue] = useState(name);

    // Sync input when name changes externally
    useEffect(() => {
        if (!isEditing) {
            setInputValue(name);
        }
    }, [name, isEditing]);

    const handleSave = async () => {
        const trimmedName = inputValue.trim();
        if (trimmedName) {
            await onNameChange(trimmedName);
        } else {
            setInputValue(name);
        }
        setIsEditing(false);
    };

    const handleEdit = () => {
        setInputValue(name);
        setIsEditing(true);
    };

    const textColor = isDarkMode ? '#FFFFFF' : '#1a1a1a';
    const pillBg = isDarkMode ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.08)';
    const iconColor = isDarkMode ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.4)';

    if (isEditing) {
        return (
            <View style={[styles.pill, { backgroundColor: pillBg }]}>
                <TextInput
                    style={[styles.input, { color: textColor }]}
                    value={inputValue}
                    onChangeText={setInputValue}
                    onBlur={handleSave}
                    onSubmitEditing={handleSave}
                    autoFocus
                    maxLength={20}
                    placeholderTextColor="#666666"
                />
            </View>
        );
    }

    return (
        <TouchableOpacity
            onPress={handleEdit}
            activeOpacity={0.7}
            style={[styles.pill, { backgroundColor: pillBg }]}
        >
            <Text style={[styles.name, { color: textColor }]} numberOfLines={1}>{name}</Text>
            <Ionicons name="pencil" size={13} color={iconColor} style={styles.editIcon} />
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    pill: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
    },
    name: {
        fontSize: 16,
        fontFamily: 'Outfit-Bold',
    },
    input: {
        fontSize: 16,
        fontFamily: 'Outfit-Bold',
        textAlign: 'center',
        paddingVertical: Platform.OS === 'ios' ? 0 : 0,
        minWidth: 80,
    },
    editIcon: {
        marginLeft: 6,
    },
});
