import React, { useMemo, useState } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { useTheme, getThemeColors } from '@/lib/ThemeContext';

interface MathRendererProps {
    latex: string;
    inline?: boolean;
    fontSize?: number;
}

export const MathRenderer: React.FC<MathRendererProps> = ({
    latex,
    inline = true,
    fontSize = 16
}) => {
    const { isDarkMode } = useTheme();
    const colors = getThemeColors(isDarkMode);
    const [dimensions, setDimensions] = useState({ width: 0, height: fontSize * 1.5 });

    const htmlContent = useMemo(() => {
        const textColor = colors.text;
        const displayMode = inline ? 'false' : 'true';

        // Sanitize latex for HTML string
        const escapedLatex = latex
            .replace(/\\/g, '\\\\')
            .replace(/'/g, "\\'")
            .replace(/\n/g, ' ');

        return `
            <!DOCTYPE html>
            <html>
                <head>
                    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
                    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">
                    <script src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js"></script>
                    <style>
                        body {
                            margin: 0;
                            padding: 2px 4px;
                            display: flex;
                            flex-direction: column;
                            justify-content: center;
                            align-items: ${inline ? 'flex-start' : 'center'};
                            background-color: transparent;
                            color: ${textColor} !important;
                            font-size: ${fontSize}px;
                            overflow: hidden;
                        }
                        #math-container {
                            white-space: nowrap;
                            display: inline-block;
                        }
                        .katex-display {
                            margin: 0;
                        }
                        /* Ensure Katex uses the correct color */
                        .katex { color: inherit !important; }
                    </style>
                </head>
                <body>
                    <div id="math-container"></div>
                    <script>
                        function sendDimensions() {
                            const container = document.getElementById('math-container');
                            const width = container.scrollWidth + 8;
                            const height = container.scrollHeight + 4;
                            window.ReactNativeWebView.postMessage(JSON.stringify({ width, height }));
                        }

                        try {
                            katex.render('${escapedLatex}', document.getElementById('math-container'), {
                                displayMode: ${displayMode},
                                throwOnError: false,
                                strict: false
                            });
                            // Wait a bit for rendering to finish
                            setTimeout(sendDimensions, 100);
                        } catch (e) {
                            document.getElementById('math-container').textContent = '${escapedLatex}';
                            sendDimensions();
                        }
                    </script>
                </body>
            </html>
        `;
    }, [latex, inline, fontSize, colors.text]);

    return (
        <View
            style={[
                styles.container,
                inline ? styles.inlineContainer : styles.displayContainer,
                {
                    height: inline ? fontSize * 1.7 : dimensions.height,
                    width: inline ? (dimensions.width || 40) : '100%'
                }
            ]}
            pointerEvents="none"
        >
            <WebView
                originWhitelist={['*']}
                source={{ html: htmlContent }}
                style={styles.webview}
                scrollEnabled={false}
                backgroundColor="transparent"
                containerStyle={styles.webviewContainer}
                onMessage={(event) => {
                    try {
                        const data = JSON.parse(event.nativeEvent.data);
                        if (data.width && data.height) {
                            setDimensions({
                                width: Math.ceil(data.width),
                                height: Math.ceil(data.height)
                            });
                        }
                    } catch (e) { }
                }}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: 'transparent',
        overflow: 'hidden',
    },
    inlineContainer: {
        marginBottom: Platform.OS === 'ios' ? -5 : -3,
        marginRight: 4,
    },
    displayContainer: {
        width: '100%',
        marginVertical: 8,
    },
    webview: {
        backgroundColor: 'transparent',
    },
    webviewContainer: {
        backgroundColor: 'transparent',
    }
});
