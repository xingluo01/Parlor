import { useState, useRef, useEffect, memo, useMemo, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import hljs from 'highlight.js/lib/common';
import 'highlight.js/styles/atom-one-dark.css';
import {
  RotateCcw,
  Trash2,
  Edit3,
  Copy,
  ChevronLeft,
  ChevronRight,
  Brain,
  ChevronUp,
  Bookmark,
  Check,
  GitBranch,
  MoreHorizontal,
  Volume2,
  VolumeX,
} from 'lucide-react';
import * as tts from '../../services/tts';
import { Button, Avatar, Textarea } from '../ui';
import type { Message, CharacterCard } from '../../types';

// ── Sanitization schema for HTML/CSS in AI messages ─────────────────────────────
// Permissive enough for SillyTavern-style CSS graphics (styled divs, inline
// styles, status panels, etc.) while blocking scripts and event handlers.
const sanitizeSchema = {
  tagNames: [
    // Text & structure
    'div', 'span', 'p', 'br', 'hr', 'center',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'b', 'i', 'u', 's', 'em', 'strong', 'small', 'mark', 'sub', 'sup',
    'blockquote', 'pre', 'code',
    // Lists
    'ul', 'ol', 'li',
    // Tables
    'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'colgroup', 'col',
    // Media
    'img', 'figure', 'figcaption', 'audio', 'source', 'video',
    // Interactive
    'details', 'summary',
    // Links
    'a',
    // Ruby
    'ruby', 'rt', 'rp',
    // Other
    'abbr', 'cite', 'del', 'ins', 'kbd', 'q', 'var', 'wbr', 'time',
    'dl', 'dt', 'dd', 'section', 'article', 'aside', 'header', 'footer', 'nav', 'main',
    'font',
  ],
  attributes: {
    '*': ['style', 'class', 'id', 'title', 'dir', 'lang', 'align', 'role', 'aria-*', 'data-*'],
    'a': ['href', 'target', 'rel'],
    'img': ['src', 'alt', 'width', 'height', 'loading'],
    'td': ['colspan', 'rowspan', 'headers'],
    'th': ['colspan', 'rowspan', 'scope', 'headers'],
    'col': ['span'],
    'colgroup': ['span'],
    'ol': ['start', 'type', 'reversed'],
    'li': ['value'],
    'audio': ['src', 'controls', 'loop', 'autoplay', 'preload'],
    'video': ['src', 'controls', 'loop', 'autoplay', 'preload', 'width', 'height', 'poster'],
    'source': ['src', 'type'],
    'time': ['datetime'],
    'font': ['color', 'size', 'face'],
    'blockquote': ['cite'],
    'q': ['cite'],
    'del': ['cite', 'datetime'],
    'ins': ['cite', 'datetime'],
  },
  protocols: {
    href: ['http', 'https', 'mailto'],
    src: ['http', 'https', 'data'],
    cite: ['http', 'https'],
    poster: ['http', 'https', 'data'],
  },
  strip: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'textarea', 'select', 'button'],
};

// ── Substitute {{char}} / {{user}} template variables ──────────────────────────
function substituteVars(text: string, charName: string, personaName: string): string {
  return text
    .replace(/\{\{char\}\}/gi, charName)
    .replace(/\{\{user\}\}/gi, personaName);
}

// ── Color "quoted dialogue" in burnished gold ─────────────────────────────────
function colorDialogue(text: string): ReactNode {
  const parts = text.split(/("(?:[^"]*)")/g);
  if (parts.length <= 1) return text;
  return parts.map((part, i) => {
    if (part.length > 2 && part[0] === '"' && part[part.length - 1] === '"') {
      return <span key={i} className="text-accent-400">{part}</span>;
    }
    return part ? <span key={i}>{part}</span> : null;
  });
}

// ── Code Block with syntax highlighting ──────────────────────────────────────
function CodeBlock({ className, children }: { className?: string; children?: ReactNode }) {
  const [copied, setCopied] = useState(false);
  const code = String(children ?? '').replace(/\n$/, '');
  const langMatch = className?.match(/language-(\w+)/);
  const lang = langMatch?.[1];

  const highlighted = useMemo(() => {
    try {
      if (lang && hljs.getLanguage(lang)) {
        return hljs.highlight(code, { language: lang }).value;
      }
      return hljs.highlightAuto(code).value;
    } catch {
      return code;
    }
  }, [code, lang]);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="relative my-2 rounded-lg overflow-hidden bg-dark-300/80 border border-glass-border text-sm">
      <div className="flex items-center justify-between px-3 py-1.5 bg-dark-300 border-b border-glass-border">
        <span className="text-2xs text-gray-600 font-mono tracking-wide">{lang || 'code'}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-2xs text-gray-600 hover:text-gray-400 transition-colors"
        >
          {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="overflow-x-auto p-3 !m-0 !bg-transparent">
        <code
          className={`hljs ${lang ? `language-${lang}` : ''}`}
          dangerouslySetInnerHTML={{ __html: highlighted }}
        />
      </pre>
    </div>
  );
}

// ── ReactMarkdown overrides for RP-style text rendering ───────────────────────
const rpComponents = {
  // *action text* rendered in warm crimson
  em: ({ children }: { children?: ReactNode }) => (
    <em className="text-parlor-300 not-italic">{children}</em>
  ),
  // Paragraphs: color any "quoted dialogue" segments
  p: ({ children }: { children?: ReactNode }) => (
    <p>
      {Array.isArray(children)
        ? children.map((child, i) =>
            typeof child === 'string'
              ? <span key={i}>{colorDialogue(child)}</span>
              : child
          )
        : typeof children === 'string'
          ? colorDialogue(children)
          : children
      }
    </p>
  ),
  // Code blocks with syntax highlighting; inline code stays simple
  code: ({ className, children }: { className?: string; children?: ReactNode }) => {
    const isBlock = /language-/.test(className || '');
    if (isBlock) {
      return <CodeBlock className={className} children={children} />;
    }
    return <code className="bg-dark-300/60 text-parlor-300 px-1.5 py-0.5 rounded text-sm font-mono">{children}</code>;
  },
  pre: ({ children }: { children?: ReactNode }) => {
    return <>{children}</>;
  },
};

// ── <details>/<summary> collapsible blocks ────────────────────────────────────
type ContentSegment =
  | { type: 'text'; content: string }
  | { type: 'details'; summary: string; body: string };

function splitDetailBlocks(content: string): ContentSegment[] {
  const segments: ContentSegment[] = [];
  const re = /<details>\s*<summary>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/gi;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(content)) !== null) {
    const before = content.slice(lastIndex, match.index).trim();
    if (before) segments.push({ type: 'text', content: before });
    segments.push({ type: 'details', summary: match[1].trim(), body: match[2].trim() });
    lastIndex = match.index + match[0].length;
  }
  const tail = content.slice(lastIndex).trim();
  if (tail) segments.push({ type: 'text', content: tail });
  return segments.length > 0 ? segments : [{ type: 'text', content }];
}

function DetailsBlock({ summary, body }: { summary: string; body: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="my-2 rounded-lg border border-glass-border overflow-hidden text-sm">
      <button
        onClick={() => setOpen(p => !p)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left font-medium text-parlor-300 hover:bg-glass-white transition-colors"
      >
        <span>{summary}</span>
        <ChevronUp className={`w-4 h-4 flex-shrink-0 transition-transform duration-200 ${open ? '' : 'rotate-180'}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3 py-2 text-gray-400 border-t border-glass-border bg-dark-300/30 whitespace-pre-wrap">
              {body}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Extract `<style>` blocks from content, scope their rules under a unique class,
 * and return the cleaned content + scoped CSS string.
 */
function extractAndScopeStyles(content: string, scopeClass: string): { cleaned: string; scopedCss: string } {
  const styleBlocks: string[] = [];
  const cleaned = content.replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, (_, css) => {
    styleBlocks.push(css);
    return '';
  });
  if (styleBlocks.length === 0) return { cleaned: content, scopedCss: '' };

  // Prefix every rule selector with the scope class
  const scopedCss = styleBlocks.join('\n').replace(
    /([^{}@/]+)\{/g,
    (match, selector: string) => {
      // Don't scope @-rules (e.g. @keyframes, @media)
      if (selector.trim().startsWith('@')) return match;
      // Scope each comma-separated selector
      const scoped = selector.split(',').map((s: string) => `.${scopeClass} ${s.trim()}`).join(', ');
      return `${scoped} {`;
    }
  );
  return { cleaned, scopedCss };
}

/** Renders message content with RP coloring, HTML/CSS graphics, and collapsible <details> blocks. */
export function RpContent({ content }: { content: string }) {
  const scopeClass = useMemo(() => `msg-scope-${Math.random().toString(36).slice(2, 8)}`, []);
  const { cleaned, scopedCss } = useMemo(() => extractAndScopeStyles(content, scopeClass), [content, scopeClass]);

  const segments = splitDetailBlocks(cleaned);
  return (
    <div className={scopeClass}>
      {scopedCss && <style dangerouslySetInnerHTML={{ __html: scopedCss }} />}
      {segments.map((seg, i) =>
        seg.type === 'details' ? (
          <DetailsBlock key={i} summary={seg.summary} body={seg.body} />
        ) : (
          <ReactMarkdown key={i} components={rpComponents as any} rehypePlugins={[rehypeRaw, [rehypeSanitize, sanitizeSchema]]}>{seg.content}</ReactMarkdown>
        )
      )}
    </div>
  );
}

interface MessageBubbleProps {
  message: Message;
  character: CharacterCard;
  personaName?: string;
  personaAvatar?: string;
  isUser: boolean;
  isLastAssistant: boolean;
  avatarSize: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  swipeIndex: number;
  isGenerating: boolean;
  regeneratingMessageId?: string | null;
  streamingContent?: string;
  streamingReasoning?: string;
  onEdit: (messageId: string, content: string) => void;
  onEditSwipe?: (messageId: string, content: string, swipeIndex: number) => void;
  onDelete: (messageId: string) => void;
  onRegenerate: (messageId: string) => void;
  onCopy: (content: string) => void;
  onSwipe: (messageId: string, direction: 'left' | 'right') => void;
  onBookmark: (messageId: string) => void;
  onBranch?: (messageId: string) => void;
  onRetry?: (messageId: string) => void;
  ttsVoice?: string;
}

function getSwipeContent(message: Message, swipeIndex: number): string {
  if (!message.swipes || message.swipes.length === 0) {
    return message.content;
  }
  return message.swipes[swipeIndex] || message.content;
}

export const MessageBubble = memo(function MessageBubble({
  message,
  character,
  personaName,
  personaAvatar,
  isUser,
  isLastAssistant,
  avatarSize,
  swipeIndex,
  isGenerating,
  regeneratingMessageId,
  streamingContent,
  streamingReasoning,
  onEdit,
  onEditSwipe,
  onDelete,
  onRegenerate,
  onCopy,
  onSwipe,
  onBookmark,
  onBranch,
  onRetry,
  ttsVoice,
}: MessageBubbleProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [expandedReasoning, setExpandedReasoning] = useState(false);
  const [showMobileActions, setShowMobileActions] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showAvatarLightbox, setShowAvatarLightbox] = useState(false);
  const bubbleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showMobileActions) return;
    const handler = (e: MouseEvent) => {
      if (bubbleRef.current && !bubbleRef.current.contains(e.target as Node)) {
        setShowMobileActions(false);
        setShowMoreMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMobileActions]);

  const isRegenerating = regeneratingMessageId === message.id && isGenerating;

  const rawContent = getSwipeContent(message, swipeIndex);
  const content = substituteVars(rawContent, character.name, personaName || 'User');
  const hasSwipes = message.swipes && message.swipes.length > 0;
  const totalSwipes = hasSwipes ? message.swipes!.length : 1;
  const showSwipeNav = !isUser && !isEditing && (isLastAssistant || hasSwipes);

  const handleStartEdit = () => {
    setEditContent(content);
    setIsEditing(true);
    setShowMobileActions(false);
  };

  const handleSaveEdit = () => {
    if (editContent.trim()) {
      if (message.swipes && message.swipes.length > 0 && onEditSwipe) {
        onEditSwipe(message.id, editContent.trim(), swipeIndex);
      } else {
        onEdit(message.id, editContent.trim());
      }
    }
    setIsEditing(false);
    setEditContent('');
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditContent('');
  };

  const handleDelete = () => {
    onDelete(message.id);
    setShowDeleteConfirm(false);
    setShowMobileActions(false);
  };

  const handleBubbleTap = () => {
    if (!isEditing) {
      setShowMobileActions(prev => !prev);
    }
  };

  const actionBtnClass = 'p-1.5 rounded-lg bg-dark-200/90 hover:bg-dark-100 transition-colors';
  const moreMenuItemClass = 'w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-glass-white disabled:opacity-40 transition-colors';

  return (
    <motion.div
      key={message.id}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}
    >
      {/* Avatar */}
      <button
        onClick={() => {
          const src = isUser ? personaAvatar : character.avatar;
          if (src) setShowAvatarLightbox(true);
        }}
        className="flex-shrink-0 mt-1 cursor-pointer"
      >
        <Avatar
          src={isUser ? personaAvatar : character.avatar}
          name={isUser ? (personaName || 'User') : character.name}
          size={avatarSize}
        />
      </button>

      {/* Message Content */}
      <div className="flex-1 max-w-[80%] min-w-0 overflow-hidden">
        <div
          ref={bubbleRef}
          onClick={handleBubbleTap}
          className={`
            relative group rounded-2xl px-3.5 py-2.5 sm:px-4 sm:py-3
            ${isUser
              ? 'bg-parlor-600/12 border border-parlor-500/15'
              : 'bg-dark-100/70 border border-glass-border'}
          `}
          style={!isUser ? {
            backgroundImage: 'linear-gradient(135deg, rgba(255,255,255,0.012) 0%, transparent 100%)',
          } : undefined}
        >
          {isEditing ? (
            <div className="space-y-2">
              <Textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                rows={4}
                autoFocus
              />
              <div className="flex gap-2 justify-end">
                <Button variant="ghost" size="sm" onClick={handleCancelEdit}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleSaveEdit}>
                  Save
                </Button>
              </div>
            </div>
          ) : (
            <>
              {/* Reasoning Section */}
              {(message.reasoning || (isRegenerating && streamingReasoning)) && (
                <div className="mb-3">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setExpandedReasoning(prev => !prev);
                    }}
                    className="flex items-center gap-2 text-2xs text-parlor-400 hover:text-parlor-300 transition-colors mb-2"
                  >
                    <Brain className="w-3.5 h-3.5" />
                    <span>{isRegenerating && streamingReasoning ? 'Reasoning...' : 'Reasoning'}</span>
                    <ChevronUp className={`w-3 h-3 transition-transform ${expandedReasoning ? '' : 'rotate-180'}`} />
                  </button>
                  <AnimatePresence>
                    {expandedReasoning && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="text-sm text-gray-500 italic whitespace-pre-wrap break-words bg-dark-300/40 rounded-lg p-2.5 border-l-2 border-parlor-500/30 max-h-40 overflow-y-auto">
                          {isRegenerating && streamingReasoning ? streamingReasoning : message.reasoning}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}

              {/* Content */}
              {isRegenerating ? (
                streamingContent ? (
                  <div className="text-gray-300 whitespace-pre-wrap break-words prose prose-invert prose-sm max-w-none text-[13px] leading-relaxed sm:text-sm">
                    <RpContent content={streamingContent} />
                    <span className="inline-block w-1.5 h-4 bg-parlor-400 animate-pulse ml-0.5 rounded-sm" />
                  </div>
                ) : (
                  <div className="flex gap-1.5 py-1">
                    <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                )
              ) : (
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={`${message.id}-${swipeIndex}`}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.15 }}
                    className="text-gray-300 whitespace-pre-wrap break-words prose prose-invert prose-sm max-w-none text-[13px] leading-relaxed sm:text-sm"
                  >
                    <RpContent content={content} />
                  </motion.div>
                </AnimatePresence>
              )}
              {message.isEdited && !isRegenerating && (
                <span className="text-2xs text-gray-600 mt-1 block italic">(edited)</span>
              )}
            </>
          )}

          {/* Desktop hover actions */}
          {!isEditing && (
            <div
              className={`
                absolute ${isUser ? 'left-0 -translate-x-full pr-2' : 'right-0 translate-x-full pl-2'}
                top-1/2 -translate-y-1/2
                opacity-0 group-hover:opacity-100 transition-opacity
                hidden sm:flex ${isUser ? 'flex-row-reverse' : ''} gap-1
              `}
            >
              <button
                onClick={(e) => { e.stopPropagation(); handleStartEdit(); }}
                className={actionBtnClass}
                title="Edit"
              >
                <Edit3 className="w-3.5 h-3.5 text-gray-500" />
              </button>
              {!isUser && (
                <button
                  onClick={(e) => { e.stopPropagation(); onCopy(content); }}
                  className={actionBtnClass}
                  title="Copy"
                >
                  <Copy className="w-3.5 h-3.5 text-gray-500" />
                </button>
              )}
              {!isUser && tts.isSupported() && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (tts.isSpeaking()) { tts.stop(); } else { tts.speak(content, ttsVoice); }
                  }}
                  className={actionBtnClass}
                  title={tts.isSpeaking() ? 'Stop speaking' : 'Read aloud'}
                >
                  {tts.isSpeaking()
                    ? <VolumeX className="w-3.5 h-3.5 text-parlor-400" />
                    : <Volume2 className="w-3.5 h-3.5 text-gray-500" />
                  }
                </button>
              )}

              {/* More menu */}
              <div className="relative">
                <button
                  onClick={(e) => { e.stopPropagation(); setShowMoreMenu(prev => !prev); }}
                  className={actionBtnClass}
                  title="More actions"
                >
                  <MoreHorizontal className="w-3.5 h-3.5 text-gray-500" />
                </button>
                {showMoreMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setShowMoreMenu(false); setShowMobileActions(false); }} />
                    <div className={`absolute z-50 ${isUser ? 'right-0' : 'left-0'} top-full mt-1 bg-dark-100 border border-glass-border rounded-xl shadow-dramatic py-1 min-w-[160px]`}>
                      {!isUser && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setShowMoreMenu(false); onRegenerate(message.id); }}
                          disabled={isGenerating}
                          className={moreMenuItemClass}
                        >
                          <RotateCcw className={`w-3.5 h-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
                          Regenerate
                        </button>
                      )}
                      {isUser && onRetry && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setShowMoreMenu(false); onRetry(message.id); }}
                          disabled={isGenerating}
                          className={moreMenuItemClass}
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          Retry
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); setShowMoreMenu(false); onBookmark(message.id); }}
                        className={moreMenuItemClass}
                      >
                        <Bookmark className={`w-3.5 h-3.5 ${message.bookmarked ? 'fill-accent-500 text-accent-500' : ''}`} />
                        {message.bookmarked ? 'Remove Bookmark' : 'Bookmark'}
                      </button>
                      {onBranch && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setShowMoreMenu(false); onBranch(message.id); }}
                          className={moreMenuItemClass}
                        >
                          <GitBranch className="w-3.5 h-3.5" />
                          Branch from here
                        </button>
                      )}
                      {isUser && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onCopy(content); setShowMoreMenu(false); }}
                          className={moreMenuItemClass}
                        >
                          <Copy className="w-3.5 h-3.5" />
                          Copy
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); setShowMoreMenu(false); setShowDeleteConfirm(true); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/5 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Mobile inline action bar */}
          {showMobileActions && !isEditing && (
            <div
              className="flex items-center gap-1 pt-2 mt-2 border-t border-glass-border sm:hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <button onClick={() => handleStartEdit()} className="p-1.5 rounded-lg hover:bg-dark-300/50" title="Edit">
                <Edit3 className="w-3.5 h-3.5 text-gray-500" />
              </button>
              <button onClick={() => onCopy(content)} className="p-1.5 rounded-lg hover:bg-dark-300/50" title="Copy">
                <Copy className="w-3.5 h-3.5 text-gray-500" />
              </button>
              {!isUser && (
                <button
                  onClick={() => onRegenerate(message.id)}
                  disabled={isGenerating}
                  className="p-1.5 rounded-lg hover:bg-dark-300/50 disabled:opacity-40"
                  title="Regenerate"
                >
                  <RotateCcw className={`w-3.5 h-3.5 text-gray-500 ${isGenerating ? 'animate-spin' : ''}`} />
                </button>
              )}
              {isUser && onRetry && (
                <button
                  onClick={() => onRetry(message.id)}
                  disabled={isGenerating}
                  className="p-1.5 rounded-lg hover:bg-dark-300/50 disabled:opacity-40"
                  title="Retry"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-gray-500" />
                </button>
              )}
              <button onClick={() => onBookmark(message.id)} className="p-1.5 rounded-lg hover:bg-dark-300/50" title={message.bookmarked ? 'Remove Bookmark' : 'Bookmark'}>
                <Bookmark className={`w-3.5 h-3.5 ${message.bookmarked ? 'fill-accent-500 text-accent-500' : 'text-gray-500'}`} />
              </button>
              {onBranch && (
                <button onClick={() => onBranch(message.id)} className="p-1.5 rounded-lg hover:bg-dark-300/50" title="Branch from here">
                  <GitBranch className="w-3.5 h-3.5 text-gray-500" />
                </button>
              )}
              <button onClick={() => setShowDeleteConfirm(true)} className="p-1.5 rounded-lg hover:bg-dark-300/50" title="Delete">
                <Trash2 className="w-3.5 h-3.5 text-red-400" />
              </button>
            </div>
          )}
        </div>

        {/* Swipe Navigation */}
        {showSwipeNav && (
          <div className="flex items-center gap-1 mt-1">
            <button
              onClick={() => onSwipe(message.id, 'left')}
              disabled={swipeIndex === 0 || isGenerating}
              className="p-1 rounded-md hover:bg-glass-white disabled:opacity-30 transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5 text-gray-500" />
            </button>
            <span className="text-2xs text-gray-600 tabular-nums min-w-[3ch] text-center">
              {swipeIndex + 1} / {totalSwipes}
            </span>
            <button
              onClick={() => {
                if (swipeIndex < totalSwipes - 1) {
                  onSwipe(message.id, 'right');
                } else {
                  onRegenerate(message.id);
                }
              }}
              disabled={isGenerating}
              className="p-1 rounded-md hover:bg-glass-white disabled:opacity-30 transition-colors"
              title={swipeIndex >= totalSwipes - 1 ? 'Generate alternate response' : 'Next response'}
            >
              <ChevronRight className={`w-3.5 h-3.5 ${swipeIndex >= totalSwipes - 1 ? 'text-parlor-400' : 'text-gray-500'}`} />
            </button>
          </div>
        )}

        {/* Timestamp */}
        <div className={`mt-1 flex ${isUser ? 'justify-end' : ''}`}>
          <span className="text-2xs text-gray-700">
            {new Date(message.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit'
            })}
          </span>
        </div>
      </div>

      {/* Avatar Lightbox */}
      {showAvatarLightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm"
          onClick={() => setShowAvatarLightbox(false)}
        >
          <img
            src={isUser ? personaAvatar : character.avatar}
            alt={isUser ? (personaName || 'User') : character.name}
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-[2px]" onClick={() => setShowDeleteConfirm(false)}>
          <div className="glass p-6 max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-medium text-white mb-2 font-serif">Delete Message</h3>
            <p className="text-sm text-gray-500 mb-4">Are you sure? This cannot be undone.</p>
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
              <Button variant="danger" size="sm" onClick={handleDelete}>Delete</Button>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
});
