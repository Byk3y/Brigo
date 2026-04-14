import React, { useState, useEffect, useRef } from 'react';
import { Platform, Text, TextStyle, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';

interface TypewriterTextProps {
    text: string;
    style?: TextStyle | TextStyle[];
    speed?: number;
    delay?: number;
    onComplete?: () => void;
    hapticEnabled?: boolean;
    hapticStyle?: Haptics.ImpactFeedbackStyle;
    startTrigger?: boolean;
}

/**
 * A premium typewriter component that syncs with Haptic feedback
 */
export function TypewriterText({
    text,
    style,
    speed = 40,
    delay = 0,
    onComplete,
    hapticEnabled = true,
    hapticStyle = Haptics.ImpactFeedbackStyle.Light,
    startTrigger = true,
}: TypewriterTextProps) {
    const [displayedText, setDisplayedText] = useState('');
    const [isStarted, setIsStarted] = useState(false);
    const index = useRef(0);
    const timer = useRef<NodeJS.Timeout | null>(null);

    const hasCalledComplete = useRef(false);

    useEffect(() => {
        if (startTrigger && !isStarted) {
            const startTimeout = setTimeout(() => {
                setIsStarted(true);
            }, delay);
            return () => clearTimeout(startTimeout);
        }
    }, [startTrigger, delay, isStarted]);

    useEffect(() => {
        if (!isStarted) return;

        if (index.current < text.length) {
            timer.current = setTimeout(() => {
                const nextChar = text[index.current];
                setDisplayedText((prev) => prev + nextChar);

                // Trigger haptic if enabled, skipping whitespace. Android's
                // haptic actuator has ~80ms latency vs iOS ~15ms, so firing
                // on every character trails behind visually. Use the lighter
                // selection haptic and throttle to every third character on
                // Android so the feedback stays in sync with the animation.
                if (hapticEnabled && nextChar !== ' ') {
                    if (Platform.OS === 'android') {
                        if (index.current % 3 === 0) {
                            Haptics.selectionAsync();
                        }
                    } else {
                        Haptics.impactAsync(hapticStyle);
                    }
                }

                index.current += 1;
            }, speed);
        } else if (onComplete && !hasCalledComplete.current) {
            hasCalledComplete.current = true;
            onComplete();
        }

        return () => {
            if (timer.current) clearTimeout(timer.current);
        };
    }, [displayedText, isStarted, text, speed, hapticEnabled, hapticStyle, onComplete]);

    return (
        <Text style={style}>
            {displayedText}
            {/* Invisible placeholder of full text to maintain layout size and prevent jumping */}
            <Text style={{ opacity: 0 }}>{text.slice(index.current)}</Text>
        </Text>
    );
}

const styles = StyleSheet.create({});
