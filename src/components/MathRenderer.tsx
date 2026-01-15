import { useMemo } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';

interface MathTextProps {
  text: string;
  className?: string;
}

// Parse text and render math expressions
export const MathText = ({ text, className = '' }: MathTextProps) => {
  const renderedContent = useMemo(() => {
    if (!text) return '';

    try {
      // Split by math delimiters while preserving them
      // Matches: $$...$$, $...$, \[...\], \(...\)
      const parts: { type: 'text' | 'math-inline' | 'math-block'; content: string }[] = [];
      let remaining = text;

      // Process block math first ($$...$$)
      const blockMathRegex = /\$\$([^$]+)\$\$/g;
      let lastIndex = 0;
      let match;

      // Replace block math with placeholders and track positions
      const blockMatches: { start: number; end: number; content: string }[] = [];
      while ((match = blockMathRegex.exec(text)) !== null) {
        blockMatches.push({
          start: match.index,
          end: match.index + match[0].length,
          content: match[1]
        });
      }

      // Process inline math ($...$)
      const inlineMathRegex = /\$([^$]+)\$/g;
      const inlineMatches: { start: number; end: number; content: string }[] = [];

      while ((match = inlineMathRegex.exec(text)) !== null) {
        // Check if this is part of a block math (inside $$...$$)
        const isInsideBlock = blockMatches.some(
          block => match!.index >= block.start && match!.index < block.end
        );
        if (!isInsideBlock) {
          inlineMatches.push({
            start: match.index,
            end: match.index + match[0].length,
            content: match[1]
          });
        }
      }

      // Combine and sort all matches
      const allMatches = [
        ...blockMatches.map(m => ({ ...m, type: 'block' as const })),
        ...inlineMatches.map(m => ({ ...m, type: 'inline' as const }))
      ].sort((a, b) => a.start - b.start);

      // Build parts array
      let currentIndex = 0;
      for (const match of allMatches) {
        if (match.start > currentIndex) {
          parts.push({
            type: 'text',
            content: text.slice(currentIndex, match.start)
          });
        }
        parts.push({
          type: match.type === 'block' ? 'math-block' : 'math-inline',
          content: match.content
        });
        currentIndex = match.end;
      }

      // Add remaining text
      if (currentIndex < text.length) {
        parts.push({
          type: 'text',
          content: text.slice(currentIndex)
        });
      }

      // Render each part
      return parts.map((part, index) => {
        if (part.type === 'text') {
          return part.content;
        }

        try {
          const html = katex.renderToString(part.content, {
            throwOnError: false,
            displayMode: part.type === 'math-block',
            output: 'html'
          });

          if (part.type === 'math-block') {
            return `<div class="my-2 overflow-x-auto">${html}</div>`;
          }
          return html;
        } catch (e) {
          // If KaTeX fails, return the original with $ delimiters
          return part.type === 'math-block'
            ? `$$${part.content}$$`
            : `$${part.content}$`;
        }
      }).join('');

    } catch (e) {
      return text;
    }
  }, [text]);

  return (
    <span
      className={className}
      dangerouslySetInnerHTML={{ __html: renderedContent }}
    />
  );
};

// Simple component for just inline math
export const InlineMath = ({ math }: { math: string }) => {
  const html = useMemo(() => {
    try {
      return katex.renderToString(math, {
        throwOnError: false,
        displayMode: false,
        output: 'html'
      });
    } catch {
      return `$${math}$`;
    }
  }, [math]);

  return <span dangerouslySetInnerHTML={{ __html: html }} />;
};

// Simple component for block math
export const BlockMath = ({ math }: { math: string }) => {
  const html = useMemo(() => {
    try {
      return katex.renderToString(math, {
        throwOnError: false,
        displayMode: true,
        output: 'html'
      });
    } catch {
      return `$$${math}$$`;
    }
  }, [math]);

  return (
    <div
      className="my-2 overflow-x-auto"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};
