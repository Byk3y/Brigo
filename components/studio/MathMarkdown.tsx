import React from 'react';
import { View, StyleSheet } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { MathRenderer } from './MathRenderer';

interface MathMarkdownProps {
    content: string;
    markdownStyles?: any;
    horizontal?: boolean;
}

export const MathMarkdown: React.FC<MathMarkdownProps> = ({
    content,
    markdownStyles,
    horizontal = false
}) => {
    // Regex to find LaTeX blocks ($...$ or $$...$$)
    // Group 1: Display math ($$...$$)
    // Group 2: Inline math ($...$)
    const mathRegex = /(\$\$[\s\S]+?\$\$)|(\$[\s\S]+?\$)/g;

    const parts = content.split(mathRegex);

    return (
        <View style={[styles.container, horizontal && styles.horizontalContainer]}>
            {parts.map((part, index) => {
                if (!part) return null;

                if (part.startsWith('$$') && part.endsWith('$$')) {
                    // Display math
                    const latex = part.slice(2, -2).trim();
                    return (
                        <MathRenderer
                            key={index}
                            latex={latex}
                            inline={false}
                            fontSize={16}
                        />
                    );
                } else if (part.startsWith('$') && part.endsWith('$')) {
                    // Inline math
                    const latex = part.slice(1, -1).trim();
                    return (
                        <MathRenderer
                            key={index}
                            latex={latex}
                            inline={true}
                            fontSize={15}
                        />
                    );
                } else {
                    // Regular markdown text
                    return (
                        <Markdown key={index} style={markdownStyles}>
                            {part}
                        </Markdown>
                    );
                }
            })}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'column',
    },
    horizontalContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
    },
});
