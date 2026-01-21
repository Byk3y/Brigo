import React, { useMemo } from 'react';
import { View, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useStore } from '@/lib/store';
import { useTheme, getThemeColors } from '@/lib/ThemeContext';
import { getAvatarUrl } from '@/lib/utils/avatarGradient';
import { Image } from 'expo-image';
import { BrigoLogo } from '../BrigoLogo';
import { StreakCount } from './StreakCount';

export const HomeHeader: React.FC = () => {
    const router = useRouter();
    const { authUser, user } = useStore();
    const { isDarkMode } = useTheme();
    const colors = getThemeColors(isDarkMode);

    // Use persistent avatar from store or generate one
    const avatarUrl = useMemo(() => {
        if (user?.avatar) return user.avatar;
        const identifier = authUser?.id || authUser?.email || 'default';
        return getAvatarUrl(identifier);
    }, [user?.avatar, authUser?.id, authUser?.email]);

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
                <StreakCount />
                <TouchableOpacity
                    onPress={handleProfilePress}
                    activeOpacity={0.8}
                    style={{
                        width: 48,
                        height: 48,
                        borderRadius: 24,
                        overflow: 'hidden',
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: 0.15,
                        shadowRadius: 8,
                        elevation: 4,
                    }}
                >
                    <Image
                        source={avatarUrl}
                        transition={200}
                        style={{ width: '100%', height: '100%' }}
                        contentFit="cover"
                        cachePolicy="memory-disk"
                    />
                </TouchableOpacity>
            </View>
        </View>
    );
};
