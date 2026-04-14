import React, { useEffect, useRef } from 'react';
import { Animated, Easing, View, Text, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, getThemeColors } from '@/lib/ThemeContext';
import { AttachStep } from 'react-native-spotlight-tour';
import { useNotebookActivity } from '@/hooks/useIsNotebookGenerating';

export type TabType = 'sources' | 'chat' | 'studio';

interface NotebookTabBarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  notebookId?: string;
}

export const NotebookTabBar: React.FC<NotebookTabBarProps> = ({
  activeTab,
  onTabChange,
  notebookId,
}) => {
  const isPad = Platform.OS === 'ios' && Platform.isPad;
  const { isDarkMode } = useTheme();
  const colors = getThemeColors(isDarkMode);
  const studioActivity = useNotebookActivity(notebookId);

  // Pulse the Studio icon itself while a job is generating. Covers the icon
  // less than an overlay dot and still reads as "something's happening".
  const iconOpacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (studioActivity !== 'generating') {
      iconOpacity.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(iconOpacity, {
          toValue: 0.4,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(iconOpacity, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [studioActivity, iconOpacity]);

  const studioIconColor = activeTab === 'studio'
    ? colors.primary
    : studioActivity === 'generating'
      ? colors.primary
      : colors.icon;

  return (
    <View style={{ borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.background, alignItems: 'center' }}>
      <View style={{ flexDirection: 'row', width: '100%', maxWidth: isPad ? 800 : '100%' }}>
        {/* Sources Tab - Index 0 */}
        {/* @ts-ignore - Library type mismatch for children */}
        <AttachStep index={0} fill={true} style={{ flex: 1 }}>
          <TouchableOpacity
            collapsable={false}
            onPress={() => onTabChange('sources')}
            style={{ alignItems: 'center', paddingVertical: isPad ? 14 : 10, width: '100%' }}
          >
            <View style={{ alignItems: 'center' }} collapsable={false}>
              <Ionicons
                name={activeTab === 'sources' ? 'library' : 'library-outline'}
                size={isPad ? 26 : 22}
                color={activeTab === 'sources' ? colors.primary : colors.icon}
              />
              <Text style={{
                fontSize: isPad ? 14 : 12,
                marginTop: 4,
                color: activeTab === 'sources' ? colors.primary : colors.textSecondary,
                fontFamily: activeTab === 'sources' ? 'Nunito-Bold' : 'Nunito-Regular'
              }}>
                Sources
              </Text>
            </View>
          </TouchableOpacity>
        </AttachStep>

        {/* Chat Tab - Index 1 */}
        {/* @ts-ignore - Library type mismatch for children */}
        <AttachStep index={1} fill={true} style={{ flex: 1 }}>
          <TouchableOpacity
            collapsable={false}
            onPress={() => onTabChange('chat')}
            style={{ alignItems: 'center', paddingVertical: isPad ? 14 : 10, width: '100%' }}
          >
            <View style={{ alignItems: 'center' }} collapsable={false}>
              <Ionicons
                name={activeTab === 'chat' ? 'chatbubbles' : 'chatbubbles-outline'}
                size={isPad ? 26 : 22}
                color={activeTab === 'chat' ? colors.primary : colors.icon}
              />
              <Text style={{
                fontSize: isPad ? 14 : 12,
                marginTop: 4,
                color: activeTab === 'chat' ? colors.primary : colors.textSecondary,
                fontFamily: activeTab === 'chat' ? 'Nunito-Bold' : 'Nunito-Regular'
              }}>
                Chat
              </Text>
            </View>
          </TouchableOpacity>
        </AttachStep>

        {/* Studio Tab - Index 2 */}
        {/* @ts-ignore - Library type mismatch for children */}
        <AttachStep index={2} fill={true} style={{ flex: 1 }}>
          <TouchableOpacity
            collapsable={false}
            onPress={() => onTabChange('studio')}
            style={{ alignItems: 'center', paddingVertical: isPad ? 14 : 10, width: '100%' }}
          >
            <View style={{ alignItems: 'center' }} collapsable={false}>
              <View>
                <Animated.View style={{ opacity: iconOpacity }}>
                  <Ionicons
                    name={activeTab === 'studio' || studioActivity === 'generating' ? 'color-palette' : 'color-palette-outline'}
                    size={isPad ? 26 : 22}
                    color={studioIconColor}
                  />
                </Animated.View>
                {studioActivity === 'unseen' && (
                  <View
                    style={{
                      position: 'absolute',
                      top: -1,
                      right: -2,
                      width: 6,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: colors.primary,
                      borderWidth: 1,
                      borderColor: colors.background,
                    }}
                    accessibilityLabel="New material ready"
                  />
                )}
              </View>
              <Text style={{
                fontSize: isPad ? 14 : 12,
                marginTop: 4,
                color: activeTab === 'studio' ? colors.primary : colors.textSecondary,
                fontFamily: activeTab === 'studio' ? 'Nunito-Bold' : 'Nunito-Regular'
              }}>
                Studio
              </Text>
            </View>
          </TouchableOpacity>
        </AttachStep>
      </View>
    </View>
  );
};








