import React, { useMemo } from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useStore } from '@/lib/store';
import { useTheme, getThemeColors } from '@/lib/ThemeContext';
import { generateGradientFromString } from '@/lib/utils/avatarGradient';
import { BrigoLogo } from '../BrigoLogo';

export const HomeHeader: React.FC = () => {
    const router = useRouter();
    const { authUser } = useStore();
    const { isDarkMode } = useTheme();
    const colors = getThemeColors(isDarkMode);

    // Generate unique gradient for this user
    const gradientColors = useMemo(() => {
        const identifier = authUser?.id || authUser?.email || 'default';
        return generateGradientFromString(identifier, isDarkMode);
    }, [authUser?.id, authUser?.email, isDarkMode]);

    const handleProfilePress = () => {
        router.push('/profile');
    };

    return (
        <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 24,
            paddingVertical: 20, // Increased padding slightly for the larger logo
            backgroundColor: colors.background
        }}>
            <BrigoLogo size={38} textColor={colors.text} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <TouchableOpacity
                    onPress={handleProfilePress}
                    activeOpacity={0.8}
                    style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        overflow: 'hidden',
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.15,
                        shadowRadius: 8,
                        elevation: 4,
                    }}
                >
                    <LinearGradient
                        colors={gradientColors as [string, string]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={{
                            flex: 1,
                            width: '100%',
                            height: '100%',
                        }}
                    />
                </TouchableOpacity>
            </View>
        </View>
    );
};
