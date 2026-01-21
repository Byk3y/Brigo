import React from 'react';
import { StyleSheet, View, Dimensions } from 'react-native';
import ConfettiCannon from 'react-native-confetti-cannon';
import { useCelebration } from '@/lib/contexts/CelebrationContext';

const { width, height } = Dimensions.get('window');

// Brigo Brand Colors: Orange, Gold, and variants
const BRIGO_COLORS = ['#FF5F06', '#FFD700', '#FFA500', '#F97316', '#FFFFFF'];

export const CelebrationOverlay: React.FC = () => {
    const { isCelebrating } = useCelebration();

    if (!isCelebrating) return null;

    return (
        <View style={styles.container} pointerEvents="none">
            {/* Left Cannon */}
            <ConfettiCannon
                count={100}
                origin={{ x: -20, y: height }}
                autoStart={true}
                fadeOut={true}
                fallSpeed={3500}
                explosionSpeed={400}
                colors={BRIGO_COLORS}
            />
            {/* Right Cannon */}
            <ConfettiCannon
                count={100}
                origin={{ x: width + 20, y: height }}
                autoStart={true}
                fadeOut={true}
                fallSpeed={3500}
                explosionSpeed={400}
                colors={BRIGO_COLORS}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 9999,
        elevation: 9999,
    },
});
