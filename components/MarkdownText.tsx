/**
 * MarkdownText - Renders markdown-formatted text with bold, italic, and LaTeX math support.
 *
 * Supports:
 *   - **bold**, *italic*
 *   - $...$ and \(...\) inline math
 *   - $$...$$ and \[...\] display math
 *
 * Math-free content keeps the original single-<Text> fast path so existing layout/
 * inheritance (numberOfLines, selectable, nesting inside another Text) is unchanged.
 * When math is present, renders as a <View> with per-line flex-wrap rows so inline
 * math flows with surrounding text and display math gets its own centered block.
 */

import React from 'react';
import { Text, TextProps, View } from 'react-native';
import { MathRenderer } from './studio/MathRenderer';

interface MarkdownTextProps extends TextProps {
  children: string;
  highlightColor?: string;
}

const MATH_DETECT_REGEX = /(\$\$[\s\S]+?\$\$)|(\\\[[\s\S]+?\\\])|(\$[^$\n]+?\$)|(\\\([^\n]+?\\\))/;
const DISPLAY_MATH_REGEX = /(\$\$[\s\S]+?\$\$|\\\[[\s\S]+?\\\])/g;
const INLINE_MATH_REGEX = /(\$[^$\n]+?\$|\\\([^\n]+?\\\))/g;
const BOLD_ITALIC_REGEX = /(\*\*([^*]+)\*\*|\*([^*]+)\*)/g;

const stripDisplayDelimiters = (s: string): string => {
  if (s.startsWith('$$') && s.endsWith('$$')) return s.slice(2, -2).trim();
  if (s.startsWith('\\[') && s.endsWith('\\]')) return s.slice(2, -2).trim();
  return s.trim();
};

const stripInlineDelimiters = (s: string): string => {
  if (s.startsWith('$') && s.endsWith('$')) return s.slice(1, -1).trim();
  if (s.startsWith('\\(') && s.endsWith('\\)')) return s.slice(2, -2).trim();
  return s.trim();
};

const renderBoldItalicSegments = (
  text: string,
  style: TextProps['style'],
  highlightColor: string | undefined,
  keyPrefix: string
): React.ReactNode[] => {
  const segments: React.ReactNode[] = [];
  let currentIndex = 0;
  let key = 0;
  let match: RegExpExecArray | null;
  const regex = new RegExp(BOLD_ITALIC_REGEX.source, 'g');

  while ((match = regex.exec(text)) !== null) {
    if (match.index > currentIndex) {
      segments.push(
        <Text key={`${keyPrefix}-${key++}`} style={style}>
          {text.substring(currentIndex, match.index)}
        </Text>
      );
    }

    if (match[1].startsWith('**')) {
      const baseFont = (style as any)?.fontFamily;
      const boldFont = baseFont?.includes('Nunito') ? 'Nunito-Bold' : undefined;
      segments.push(
        <Text
          key={`${keyPrefix}-${key++}`}
          style={[
            style,
            highlightColor
              ? { color: highlightColor, fontWeight: '600' }
              : { fontWeight: '700', fontFamily: boldFont },
          ]}
        >
          {match[2]}
        </Text>
      );
    } else if (match[1].startsWith('*')) {
      segments.push(
        <Text key={`${keyPrefix}-${key++}`} style={[style, { fontStyle: 'italic' }]}>
          {match[3]}
        </Text>
      );
    }

    currentIndex = match.index + match[0].length;
  }

  if (currentIndex < text.length) {
    segments.push(
      <Text key={`${keyPrefix}-${key++}`} style={style}>
        {text.substring(currentIndex)}
      </Text>
    );
  }

  if (segments.length === 0) {
    return [
      <Text key={`${keyPrefix}-0`} style={style}>
        {text}
      </Text>,
    ];
  }

  return segments;
};

export const MarkdownText: React.FC<MarkdownTextProps> = ({ children, style, highlightColor, ...props }) => {
  const textContent = typeof children === 'string' ? children : String(children);

  if (!MATH_DETECT_REGEX.test(textContent)) {
    return (
      <Text style={style} {...props}>
        {renderBoldItalicSegments(textContent, style, highlightColor, 'm')}
      </Text>
    );
  }

  const fontSize = (style as any)?.fontSize ?? 16;
  const displayParts = textContent.split(DISPLAY_MATH_REGEX);
  const nodes: React.ReactNode[] = [];

  displayParts.forEach((part, i) => {
    if (!part) return;
    const isDisplay = i % 2 === 1;

    if (isDisplay) {
      nodes.push(
        <View
          key={`d-${i}`}
          style={{ width: '100%', alignItems: 'center', marginVertical: 8 }}
        >
          <MathRenderer latex={stripDisplayDelimiters(part)} inline={false} fontSize={fontSize} />
        </View>
      );
      return;
    }

    const lines = part.split('\n');
    lines.forEach((line, j) => {
      if (line.length === 0) {
        nodes.push(<View key={`s-${i}-${j}`} style={{ width: '100%', height: fontSize * 0.5 }} />);
        return;
      }

      const segments = line.split(INLINE_MATH_REGEX);
      const lineChildren: React.ReactNode[] = [];

      segments.forEach((seg, k) => {
        if (!seg) return;
        const isInlineMath =
          (seg.startsWith('$') && seg.endsWith('$') && !seg.startsWith('$$')) ||
          (seg.startsWith('\\(') && seg.endsWith('\\)'));

        if (isInlineMath) {
          lineChildren.push(
            <MathRenderer
              key={`im-${i}-${j}-${k}`}
              latex={stripInlineDelimiters(seg)}
              inline
              fontSize={Math.round(fontSize * 0.92)}
            />
          );
        } else {
          lineChildren.push(
            ...renderBoldItalicSegments(seg, style, highlightColor, `t-${i}-${j}-${k}`)
          );
        }
      });

      nodes.push(
        <View
          key={`l-${i}-${j}`}
          style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' }}
        >
          {lineChildren}
        </View>
      );
    });
  });

  return <View>{nodes}</View>;
};
