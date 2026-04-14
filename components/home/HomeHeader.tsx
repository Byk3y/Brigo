import React, { useMemo } from 'react';
import { View, TouchableOpacity, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useStore } from '@/lib/store';
import { useTheme, getThemeColors } from '@/lib/ThemeContext';
import { BrigoAvatar } from '../BrigoAvatar';
import { BrigoLogo } from '../BrigoLogo';
import { StreakCount } from './StreakCount';

const isPad = Platform.OS === 'ios' && Platform.isPad;

export const HomeHeader: React.FC = () => {
    const router = useRouter();
    const { authUser, user } = useStore();
    const { isDarkMode } = useTheme();
    const colors = getThemeColors(isDarkMode);

    // Resolve the avatar identifier (dicebear seed/style URI, a legacy http URL, or a fallback)
    const avatarIdentifier = useMemo(() => {
        return user?.avatar || authUser?.id || authUser?.email || 'default';
    }, [user?.avatar, authUser?.id, authUser?.email]);

    const handleProfilePress = () => {
        router.push('/profile');
    };

    return (
        <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: isPad ? 48 : 24,
            paddingVertical: isPad ? 32 : 20, // Increased padding for iPad
            backgroundColor: colors.background
        }}>
            <BrigoLogo size={isPad ? 52 : 38} textColor={colors.text} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: isPad ? 16 : 12 }}>
                <StreakCount />
                <TouchableOpacity
                    onPress={handleProfilePress}
                    activeOpacity={0.8}
                    style={{
                        width: isPad ? 72 : 48,
                        height: isPad ? 72 : 48,
                        borderRadius: isPad ? 36 : 24,
                        overflow: 'hidden',
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.15,
                        shadowRadius: 8,
                        elevation: 4,
                    }}
                >
                    <BrigoAvatar identifier={avatarIdentifier} size={isPad ? 72 : 48} />
                </TouchableOpacity>
            </View>
        </View>
    );
};
