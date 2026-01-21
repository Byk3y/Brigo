import React, { createContext, useContext, useState, useCallback } from 'react';
import * as Haptics from 'expo-haptics';

interface CelebrationContextType {
    triggerCelebration: () => void;
    isCelebrating: boolean;
}

const CelebrationContext = createContext<CelebrationContextType | undefined>(undefined);

export const CelebrationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isCelebrating, setIsCelebrating] = useState(false);

    const triggerCelebration = useCallback(() => {
        setIsCelebrating(false); // Reset in case one is already running

        // Use a tiny timeout to ensure the state change triggers a re-render even if already true
        setTimeout(() => {
            setIsCelebrating(true);

            // Premium Haptics: Success pattern
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

            // Auto-stop after 3 seconds
            setTimeout(() => {
                setIsCelebrating(false);
            }, 3500);
        }, 10);
    }, []);

    return (
        <CelebrationContext.Provider value={{ triggerCelebration, isCelebrating }}>
            {children}
        </CelebrationContext.Provider>
    );
};

export const useCelebration = () => {
    const context = useContext(CelebrationContext);
    if (!context) {
        throw new Error('useCelebration must be used within a CelebrationProvider');
    }
    return context;
};
