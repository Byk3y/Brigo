/**
 * Prediction Viewer Screen - Full prediction report viewer
 * Route: /predictions/[id] where id = prediction_id
 */

import React, { useState, useEffect } from 'react';
import { View, Text } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { PredictionViewer } from '@/components/studio/PredictionViewer';
import { TikTokLoader } from '@/components/TikTokLoader';
import { examPredictionService } from '@/lib/services/examPredictionService';
import type { ExamPrediction } from '@/lib/store/types';
import { useTheme, getThemeColors } from '@/lib/ThemeContext';

export default function PredictionScreen() {
    const router = useRouter();
    const { id } = useLocalSearchParams<{ id: string }>();
    const [prediction, setPrediction] = useState<ExamPrediction | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const { isDarkMode } = useTheme();
    const colors = getThemeColors(isDarkMode);

    useEffect(() => {
        fetchPrediction();
    }, [id]);

    const fetchPrediction = async () => {
        try {
            setLoading(true);
            setError(null);

            const data = await examPredictionService.fetchById(id);

            if (!data) {
                setError('Prediction not found');
                return;
            }

            setPrediction(data);
        } catch (err: any) {
            console.error('Error fetching prediction:', err);
            setError(err.message || 'Failed to load prediction');
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        router.back();
    };

    if (loading) {
        return (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
                <TikTokLoader size={14} color="#9333ea" containerWidth={60} />
                <Text style={{ marginTop: 16, color: colors.textSecondary }}>Loading predictions...</Text>
            </View>
        );
    }

    if (error || !prediction) {
        return (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background, paddingHorizontal: 24 }}>
                <Text style={{ fontSize: 18, fontWeight: '600', color: colors.text, marginBottom: 8 }}>
                    {error || 'Prediction not available'}
                </Text>
                <Text style={{ color: colors.textSecondary, textAlign: 'center' }}>
                    Generate exam predictions from the Studio tab to analyze your materials
                </Text>
            </View>
        );
    }

    return (
        <View style={{ flex: 1 }}>
            <PredictionViewer prediction={prediction} onClose={handleClose} />
        </View>
    );
}
