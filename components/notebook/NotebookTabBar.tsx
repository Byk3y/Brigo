import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, getThemeColors } from '@/lib/ThemeContext';
import { AttachStep } from 'react-native-spotlight-tour';

export type TabType = 'sources' | 'chat' | 'studio';

interface NotebookTabBarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
}

export const NotebookTabBar: React.FC<NotebookTabBarProps> = ({
  activeTab,
  onTabChange,
}) => {
  const { isDarkMode } = useTheme();
  const colors = getThemeColors(isDarkMode);

  return (
    <View style={{ borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.background }}>
      <View style={{ flexDirection: 'row', width: '100%' }}>
        {/* Sources Tab - Index 0 */}
        {/* @ts-ignore - Library type mismatch for children */}
        <AttachStep index={0} fill={true} style={{ flex: 1 }}>
          <TouchableOpacity
            onPress={() => onTabChange('sources')}
            style={{ alignItems: 'center', paddingVertical: 10, width: '100%' }}
          >
            <View style={{ alignItems: 'center' }} collapsable={false}>
              <Ionicons
                name={activeTab === 'sources' ? 'library' : 'library-outline'}
                size={22}
                color={colors.icon}
              />
              <Text style={{ fontSize: 12, marginTop: 4, color: colors.textSecondary, fontFamily: 'Nunito-Regular' }}>
                Sources
              </Text>
            </View>
          </TouchableOpacity>
        </AttachStep>

        {/* Chat Tab - Index 1 */}
        {/* @ts-ignore - Library type mismatch for children */}
        <AttachStep index={1} fill={true} style={{ flex: 1 }}>
          <TouchableOpacity
            onPress={() => onTabChange('chat')}
            style={{ alignItems: 'center', paddingVertical: 10, width: '100%' }}
          >
            <View style={{ alignItems: 'center' }} collapsable={false}>
              <Ionicons
                name={activeTab === 'chat' ? 'chatbubbles' : 'chatbubbles-outline'}
                size={22}
                color={colors.icon}
              />
              <Text style={{ fontSize: 12, marginTop: 4, color: colors.textSecondary, fontFamily: 'Nunito-Regular' }}>
                Chat
              </Text>
            </View>
          </TouchableOpacity>
        </AttachStep>

        {/* Studio Tab - Index 2 */}
        {/* @ts-ignore - Library type mismatch for children */}
        <AttachStep index={2} fill={true} style={{ flex: 1 }}>
          <TouchableOpacity
            onPress={() => onTabChange('studio')}
            style={{ alignItems: 'center', paddingVertical: 10, width: '100%' }}
          >
            <View style={{ alignItems: 'center' }} collapsable={false}>
              <Ionicons
                name={activeTab === 'studio' ? 'color-palette' : 'color-palette-outline'}
                size={22}
                color={colors.icon}
              />
              <Text style={{ fontSize: 12, marginTop: 4, color: colors.textSecondary, fontFamily: 'Nunito-Regular' }}>
                Studio
              </Text>
            </View>
          </TouchableOpacity>
        </AttachStep>
      </View>
    </View>
  );
};








