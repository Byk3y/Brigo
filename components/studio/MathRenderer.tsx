import React, { useMemo, useState } from 'react';
import { View, StyleSheet } from 'react-native';
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
    const [dimensions, setDimensions] = useState({
        width: inline ? fontSize : 0,
        height: inline ? Math.round(fontSize * 1.3) : Math.round(fontSize * 1.5),
    });

    const htmlContent = useMemo(() => {
        const textColor = colors.text;
        const displayMode = inline ? 'false' : 'true';

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
                        html, body {
                            margin: 0;
                            padding: 0;
                            background-color: transparent;
                            overflow: hidden;
                            position: relative;
                        }
                        body {
                            color: ${textColor} !important;
                            font-size: ${fontSize}px;
                        }
                        #math-container {
                            position: absolute;
                            top: 0;
                            left: 0;
                            display: inline-block;
                            transform-origin: top left;
                            white-space: ${inline ? 'nowrap' : 'normal'};
                        }
                        .katex-display {
                            margin: 0;
                        }
                        .katex { color: inherit !important; }
                    </style>
                </head>
                <body>
                    <div id="math-container"></div>
                    <script>
                        function reportDimensions() {
                            const container = document.getElementById('math-container');
                            const naturalRect = container.getBoundingClientRect();
                            const naturalWidth = naturalRect.width;
                            const naturalHeight = naturalRect.height;
                            const availableWidth = document.body.clientWidth;
                            const isInline = ${inline ? 'true' : 'false'};

                            let scale = 1;
                            if (!isInline && naturalWidth > availableWidth - 8 && naturalWidth > 0) {
                                scale = (availableWidth - 8) / naturalWidth;
                            }

                            const scaledWidth = naturalWidth * scale;
                            const scaledHeight = naturalHeight * scale;

                            container.style.transform = 'scale(' + scale + ')';
                            if (!isInline) {
                                const xOffset = Math.max(0, (availableWidth - scaledWidth) / 2);
                                container.style.left = xOffset + 'px';
                            }

                            const reportedWidth = isInline ? Math.ceil(scaledWidth + 4) : availableWidth;
                            const reportedHeight = Math.ceil(scaledHeight + 4);

                            window.ReactNativeWebView.postMessage(JSON.stringify({
                                width: reportedWidth,
                                height: reportedHeight,
                                scale: scale
                            }));
                        }

                        try {
                            katex.render('${escapedLatex}', document.getElementById('math-container'), {
                                displayMode: ${displayMode},
                                throwOnError: false,
                                strict: false
                            });
                            setTimeout(reportDimensions, 80);
                        } catch (e) {
                            document.getElementById('math-container').textContent = '${escapedLatex}';
                            setTimeout(reportDimensions, 40);
                        }
                    </script>
                </body>
            </html>
        `;
    }, [latex, inline, fontSize, colors.text]);

    return (
        <View
            style={[
                inline ? styles.inlineContainer : styles.displayContainer,
                inline
                    ? {
                        height: Math.max(dimensions.height, Math.round(fontSize * 1.3)),
                        width: Math.max(dimensions.width, fontSize),
                      }
                    : { height: dimensions.height },
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
                                height: Math.ceil(data.height),
                            });
                        }
                    } catch (e) { }
                }}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    inlineContainer: {
        backgroundColor: 'transparent',
        overflow: 'hidden',
        marginHorizontal: 1,
    },
    displayContainer: {
        backgroundColor: 'transparent',
        overflow: 'hidden',
        width: '100%',
        marginVertical: 6,
    },
    webview: {
        backgroundColor: 'transparent',
    },
    webviewContainer: {
        backgroundColor: 'transparent',
    },
});
