import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { triggerNotification, triggerStreakBanner } from '@/lib/store/slices/notificationSlice';

type Variant =
    | 'task-daily'
    | 'task-foundational'
    | 'streak-new'
    | 'streak-ongoing'
    | 'streak-restored'
    | 'streak-near-milestone'
    | 'streak-milestone';

const now = () => Date.now().toString();

const variants: { key: Variant; label: string; fire: () => void }[] = [
    {
        key: 'task-daily',
        label: 'Task complete (daily)',
        fire: () =>
            triggerNotification({
                type: 'success',
                title: 'Task complete',
                message: 'Chatted with your notebook · +5 points',
                data: { contentKey: `debug:task-daily:${now()}` },
            }),
    },
    {
        key: 'task-foundational',
        label: 'Milestone (foundational)',
        fire: () =>
            triggerNotification({
                type: 'success',
                title: 'Milestone unlocked',
                message: 'Named your pet · +1 points',
                data: { contentKey: `debug:task-foundational:${now()}` },
            }),
    },
    {
        key: 'streak-new',
        label: 'Streak — new (day 1)',
        fire: () => triggerStreakBanner({ newStreak: 1, autoFreezeApplied: false }),
    },
    {
        key: 'streak-ongoing',
        label: 'Streak — day 4',
        fire: () => triggerStreakBanner({ newStreak: 4, autoFreezeApplied: false }),
    },
    {
        key: 'streak-restored',
        label: 'Streak — restored (day 8)',
        fire: () => triggerStreakBanner({ newStreak: 8, autoFreezeApplied: true }),
    },
    {
        key: 'streak-near-milestone',
        label: 'Streak — near (day 6)',
        fire: () => triggerStreakBanner({ newStreak: 6, autoFreezeApplied: false }),
    },
    {
        key: 'streak-milestone',
        label: 'Streak — MILESTONE (day 7) 🎉',
        fire: () => triggerStreakBanner({ newStreak: 7, autoFreezeApplied: false }),
    },
];

export function BannerDebugFab() {
    if (!__DEV__) return null;
    const [open, setOpen] = useState(false);

    return (
        <View style={styles.container} pointerEvents="box-none">
            {open && (
                <View style={styles.panel}>
                    <Text style={styles.panelTitle}>Banner preview</Text>
                    {variants.map((v) => (
                        <Pressable
                            key={v.key}
                            onPress={() => {
                                v.fire();
                                setOpen(false);
                            }}
                            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
                        >
                            <Text style={styles.rowText}>{v.label}</Text>
                        </Pressable>
                    ))}
                </View>
            )}
            <Pressable
                onPress={() => setOpen((o) => !o)}
                style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
                hitSlop={8}
            >
                <Ionicons name={open ? 'close' : 'bug'} size={20} color="#fff" />
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        right: 16,
        bottom: 140,
        alignItems: 'flex-end',
        zIndex: 2000,
    },
    fab: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(24, 24, 27, 0.88)',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        elevation: 8,
    },
    fabPressed: { opacity: 0.75 },
    panel: {
        marginBottom: 10,
        backgroundColor: 'rgba(24, 24, 27, 0.95)',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        paddingVertical: 6,
        paddingHorizontal: 4,
        minWidth: 220,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.35,
        shadowRadius: 12,
        elevation: 10,
    },
    panelTitle: {
        color: 'rgba(255,255,255,0.55)',
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.6,
        textTransform: 'uppercase',
        paddingHorizontal: 12,
        paddingTop: 6,
        paddingBottom: 4,
    },
    row: {
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 10,
    },
    rowPressed: { backgroundColor: 'rgba(255,255,255,0.08)' },
    rowText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '500',
    },
});
