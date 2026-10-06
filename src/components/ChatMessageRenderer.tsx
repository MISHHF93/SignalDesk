import React, { useState } from 'react';
import Markdown from 'react-markdown';
import { Copy, Check } from 'lucide-react';

interface ChatMessageRendererProps {
  content: string;
  isUser?: boolean;
  theme?: 'dark' | 'light';
}

/**
 * Pre-processes text to clean up unparsed asterisk artifacts, orphan asterisks,
 * and format Markdown for executive readability.
 */
export function sanitizeMarkdownText(raw: string): string {
  if (!raw) return '';

  let sanitized = raw;

  // Replace quadruple asterisks or empty bold tags (****) with a single space
  sanitized = sanitized.replace(/\*{4,}/g, ' ');

  // Standardize orphan triple asterisks (***) that lack closing or have mismatched tags
  sanitized = sanitized.replace(/(?<!\*)\*\*\*(?!\*)/g, '**');

  // Fix unspaced list asterisks e.g. "* **" -> "* **"
  sanitized = sanitized.replace(/^(\s*)\*(\S)/gm, '$1* $2');

  return sanitized;
}

export const ChatMessageRenderer: React.FC<ChatMessageRendererProps> = ({
  content,
  isUser = false,
  theme = 'dark'
}) => {
  const [copiedSnippetIndex, setCopiedSnippetIndex] = useState<number | null>(null);

  const cleanText = sanitizeMarkdownText(content);

  const handleCopyCode = (codeText: string, index: number) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(codeText);
      setCopiedSnippetIndex(index);
      setTimeout(() => setCopiedSnippetIndex(null), 2000);
    }
  };

  let codeBlockCounter = 0;
  const isLight = theme === 'light' && !isUser;

  return (
    <div className={`text-xs sm:text-sm leading-relaxed break-words ${
      isUser 
        ? 'text-inherit font-normal' 
        : isLight 
          ? 'text-stone-800' 
          : 'text-stone-200'
    }`}>
      <Markdown
        components={{
          strong: ({ children }) => {
            if (isUser) {
              return (
                <strong className="font-extrabold text-white underline decoration-amber-300/40">
                  {children}
                </strong>
              );
            }
            if (isLight) {
              return (
                <strong className="font-bold text-indigo-950 bg-indigo-50/90 px-1 py-0.5 rounded border border-indigo-200/60 shadow-2xs">
                  {children}
                </strong>
              );
            }
            return (
              <strong className="font-bold text-amber-300 tracking-tight drop-shadow-2xs">
                {children}
              </strong>
            );
          },
          em: ({ children }) => (
            <em className={`italic opacity-90 ${isLight ? 'text-stone-600' : 'text-stone-300'}`}>
              {children}
            </em>
          ),
          p: ({ children }) => (
            <p className="my-2 first:mt-0 last:mb-0 leading-relaxed font-normal">
              {children}
            </p>
          ),
          ul: ({ children }) => (
            <ul className={`my-2 ml-4 list-disc space-y-1.5 ${isLight ? 'marker:text-indigo-600' : 'marker:text-amber-400'} marker:text-xs`}>
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className={`my-2 ml-4 list-decimal space-y-1.5 ${isLight ? 'marker:text-indigo-600' : 'marker:text-amber-400'} marker:font-mono marker:font-bold marker:text-xs`}>
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className={`pl-1 leading-relaxed ${isLight ? 'text-stone-800' : 'text-stone-200'}`}>
              {children}
            </li>
          ),
          code: ({ className, children, ...props }: any) => {
            const codeString = String(children).replace(/\n$/, '');
            const isMultiline = codeString.includes('\n');

            if (!isMultiline) {
              if (isLight) {
                return (
                  <code className="px-1.5 py-0.5 mx-0.5 rounded-md bg-stone-100 text-indigo-700 font-mono text-[11px] sm:text-xs border border-stone-200 font-semibold shadow-2xs">
                    {children}
                  </code>
                );
              }
              return (
                <code className="px-1.5 py-0.5 mx-0.5 rounded-md bg-stone-900/90 text-amber-300 font-mono text-[11px] sm:text-xs border border-stone-700/60 font-semibold shadow-2xs">
                  {children}
                </code>
              );
            }

            const currentIdx = codeBlockCounter++;
            const isCopied = copiedSnippetIndex === currentIdx;

            return (
              <div className="relative my-3 rounded-xl bg-stone-950 border border-stone-800 shadow-md overflow-hidden font-mono text-xs">
                <div className="flex items-center justify-between px-3 py-1.5 bg-stone-900/90 border-b border-stone-800 text-[10px] text-stone-400 font-mono">
                  <span>TERMINAL / EVIDENCE PAYLOAD</span>
                  <button
                    onClick={() => handleCopyCode(codeString, currentIdx)}
                    className="flex items-center gap-1 text-stone-400 hover:text-amber-300 transition-colors cursor-pointer px-1.5 py-0.5 rounded bg-stone-800/80 hover:bg-stone-800"
                    title="Copy code snippet"
                  >
                    {isCopied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{isCopied ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <pre className="p-3.5 overflow-x-auto text-stone-200 leading-relaxed scrollbar-thin">
                  <code>{codeString}</code>
                </pre>
              </div>
            );
          },
          blockquote: ({ children }) => (
            <blockquote className={`my-2.5 pl-3 py-1.5 border-l-2 ${isLight ? 'border-indigo-500 text-stone-700 bg-indigo-50/60' : 'border-amber-500 text-stone-300 bg-amber-500/10'} italic rounded-r-lg`}>
              {children}
            </blockquote>
          ),
          h1: ({ children }) => (
            <h1 className={`text-base sm:text-lg font-bold ${isLight ? 'text-stone-900' : 'text-white'} mt-3.5 mb-1.5 font-display tracking-tight border-b ${isLight ? 'border-stone-200' : 'border-stone-800'} pb-1`}>
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className={`text-sm sm:text-base font-bold ${isLight ? 'text-indigo-900' : 'text-amber-300'} mt-3 mb-1 font-display tracking-tight`}>
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className={`text-xs sm:text-sm font-semibold ${isLight ? 'text-stone-800' : 'text-stone-200'} mt-2 mb-1`}>
              {children}
            </h3>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className={`${isLight ? 'text-indigo-600 hover:text-indigo-800 decoration-indigo-400/50' : 'text-amber-400 hover:text-amber-300 decoration-amber-400/50'} font-medium underline underline-offset-2 transition-colors inline-flex items-center gap-0.5`}
            >
              {children}
            </a>
          ),
          table: ({ children }) => (
            <div className={`overflow-x-auto my-3 rounded-xl border ${isLight ? 'border-stone-200' : 'border-stone-800'} shadow-xs`}>
              <table className={`min-w-full divide-y ${isLight ? 'divide-stone-200 text-stone-800' : 'divide-stone-800 text-stone-300'} text-left text-xs font-mono`}>
                {children}
              </table>
            </div>
          ),
          th: ({ children }) => (
            <th className={`px-3 py-2 ${isLight ? 'bg-stone-100 text-stone-700' : 'bg-stone-900 text-stone-300'} font-bold text-[11px] uppercase tracking-wider`}>
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className={`px-3 py-2 border-t ${isLight ? 'border-stone-100' : 'border-stone-800/70'}`}>
              {children}
            </td>
          ),
          hr: () => (
            <hr className={`my-3 border-t ${isLight ? 'border-stone-200' : 'border-stone-800/80'}`} />
          )
        }}
      >
        {cleanText}
      </Markdown>
    </div>
  );
};
