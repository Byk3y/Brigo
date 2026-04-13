/**
 * NotebookActivityDot — visual indicator for studio generation state.
 *
 *   generating : pulsing glow dot (something is being generated right now)
 *   unseen     : solid dot (new material waiting, user hasn't opened Studio yet)
 *   null       : renders nothing
 */

import React, { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import type { NotebookActivityState } from '@/hooks/useIsNotebookGenerating';

interface NotebookActivityDotProps {
    state: NotebookActivityState;
    color?: string;
    /**
     * Outer dot diameter when in 'unseen' state. The 'generating' glow halo
     * is roughly 2x this.
     */
    size?: number;
    /**
     * Background color of the element the dot overlays — used to draw a
     * subtle border around the solid dot so it reads clearly on any surface.
     */
    borderColor?: string;
}

export const NotebookActivityDot: React.FC<NotebookActivityDotProps> = ({
    state,
    color = '#6366f1',
    size = 10,
    borderColor,
}) => {
    const scale = useRef(new Animated.Value(1)).current;
    const glowOpacity = useRef(new Animated.Value(0.5)).current;

    useEffect(() => {
        if (state !== 'generating') {
            scale.setValue(1);
            glowOpacity.setValue(0);
            return;
        }
        const pulse = Animated.loop(
            Animated.parallel([
                Animated.sequence([
                    Animated.timing(scale, {
                        toValue: 1.6,
                        duration: 900,
                        easing: Easing.inOut(Easing.ease),
                        useNativeDriver: true,
                    }),
                    Animated.timing(scale, {
                        toValue: 1,
                        duration: 900,
                        easing: Easing.inOut(Easing.ease),
                        useNativeDriver: true,
                    }),
                ]),
                Animated.sequence([
                    Animated.timing(glowOpacity, {
                        toValue: 0.7,
                        duration: 900,
                        easing: Easing.inOut(Easing.ease),
                        useNativeDriver: true,
                    }),
                    Animated.timing(glowOpacity, {
                        toValue: 0.15,
                        duration: 900,
                        easing: Easing.inOut(Easing.ease),
                        useNativeDriver: true,
                    }),
                ]),
            ]),
        );
        pulse.start();
        return () => pulse.stop();
    }, [state, scale, glowOpacity]);

    if (state === null) return null;

    const glowSize = size * 2.2;

    return (
        <View
            style={{
                width: glowSize,
                height: glowSize,
                justifyContent: 'center',
                alignItems: 'center',
            }}
            accessibilityLabel={state === 'generating' ? 'Generation in progress' : 'New material ready'}
        >
            {state === 'generating' && (
                <Animated.View
                    style={{
                        position: 'absolute',
                        width: glowSize,
                        height: glowSize,
                        borderRadius: glowSize / 2,
                        backgroundColor: color,
                        opacity: glowOpacity,
                        transform: [{ scale }],
                    }}
                />
            )}
            <View
                style={{
                    width: size,
                    height: size,
                    borderRadius: size / 2,
                    backgroundColor: color,
                    borderWidth: borderColor ? 1.5 : 0,
                    borderColor,
                }}
            />
        </View>
    );
};
