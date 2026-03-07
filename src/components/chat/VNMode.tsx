import { useState, useEffect, useMemo, useRef } from 'react';
import { X, Send } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { detectExpression } from '../../services/expressionDetector';

type VNModeProps = {
  character: {
    name: string;
    avatar?: string;
    expressions?: Record<string, string>;
  };
  messages: Array<{
    id: string;
    role: string;
    content: string;
    timestamp: number;
  }>;
  personaName: string;
  isGenerating: boolean;
  streamingContent: string;
  inputValue: string;
  onInputChange: (value: string) => void;
  onSend: () => void;
  onExit: () => void;
  chatBackground?: string;
};

export function VNMode({
  character,
  messages,
  personaName,
  isGenerating,
  streamingContent,
  inputValue,
  onInputChange,
  onSend,
  onExit,
  chatBackground,
}: VNModeProps) {
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const typewriterRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastMessageRef = useRef<string>('');

  // Get the latest message
  const latestMessage = messages.length > 0 ? messages[messages.length - 1] : null;
  const latestAssistantMessage = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant') return messages[i];
    }
    return null;
  }, [messages]);

  // Determine expression from latest assistant message
  const expressionSrc = useMemo(() => {
    const content = latestAssistantMessage?.content || '';
    if (character.expressions && Object.keys(character.expressions).length > 0) {
      const emotion = detectExpression(content);
      return character.expressions[emotion] || character.expressions['neutral'] || character.avatar;
    }
    return character.avatar;
  }, [character.avatar, character.expressions, latestAssistantMessage?.content]);

  const hasExpressions = character.expressions && Object.keys(character.expressions).length > 0;

  // Determine the current speaker
  const currentSpeaker = isGenerating
    ? character.name
    : latestMessage?.role === 'assistant'
      ? character.name
      : latestMessage?.role === 'user'
        ? personaName
        : '';

  // Whether user can type (last message is assistant, or chat is empty, and not generating)
  const showInput = (!latestMessage || latestMessage.role === 'assistant') && !isGenerating;

  // Typewriter effect for non-streaming messages
  useEffect(() => {
    if (isGenerating) {
      // During streaming, show content directly
      setDisplayedText(streamingContent);
      setIsTyping(true);
      return;
    }

    const fullText = latestMessage?.content || '';

    // If the message hasn't changed, don't re-animate
    if (fullText === lastMessageRef.current) {
      setDisplayedText(fullText);
      setIsTyping(false);
      return;
    }

    lastMessageRef.current = fullText;
    setDisplayedText('');
    setIsTyping(true);

    let charIndex = 0;

    const typeNextChar = () => {
      if (charIndex < fullText.length) {
        setDisplayedText(fullText.slice(0, charIndex + 1));
        charIndex++;
        typewriterRef.current = setTimeout(typeNextChar, 20);
      } else {
        setIsTyping(false);
      }
    };

    typewriterRef.current = setTimeout(typeNextChar, 20);

    return () => {
      if (typewriterRef.current) clearTimeout(typewriterRef.current);
    };
  }, [latestMessage?.content, latestMessage?.id, isGenerating, streamingContent]);

  // Handle Enter key in input
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] bg-dark-300 flex flex-col"
      style={chatBackground ? {
        backgroundImage: `url(${chatBackground})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      } : undefined}
    >
      {/* Dark overlay when background image is used */}
      {chatBackground && (
        <div className="absolute inset-0 bg-dark-300/60" />
      )}

      {/* Exit button */}
      <button
        onClick={onExit}
        className="absolute top-4 right-4 z-10 p-2 rounded-full bg-dark-200/80 text-white hover:bg-dark-100 transition-colors"
      >
        <X className="w-5 h-5" />
      </button>

      {/* Character sprite area */}
      <div className="relative flex-1 flex items-center justify-center overflow-hidden">
        <AnimatePresence mode="wait">
          {expressionSrc ? (
            <motion.img
              key={expressionSrc}
              src={expressionSrc}
              alt={character.name}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              className="relative z-[1] object-contain"
              style={{
                maxHeight: hasExpressions ? '60%' : '200px',
                maxWidth: hasExpressions ? '80%' : '200px',
                width: hasExpressions ? 'auto' : '200px',
                height: hasExpressions ? 'auto' : '200px',
                borderRadius: hasExpressions ? undefined : '50%',
              }}
            />
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="relative z-[1] w-[200px] h-[200px] rounded-full bg-dark-200 flex items-center justify-center text-4xl font-bold font-serif text-white/50"
            >
              {character.name.charAt(0).toUpperCase()}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Dialogue box */}
      <div className="absolute bottom-0 left-0 right-0 z-[2] bg-dark-300/90 backdrop-blur-md border-t border-glass-border px-6 py-4 safe-bottom">
        {/* Speaker name tab */}
        {currentSpeaker && (
          <div className="absolute -top-8 left-4">
            <span className="inline-block px-4 py-1 bg-dark-300/90 backdrop-blur-md border border-glass-border border-b-0 rounded-t-lg text-sm font-semibold font-serif tracking-tight text-parlor-400">
              {currentSpeaker}
            </span>
          </div>
        )}

        {/* Message text */}
        <div className="min-h-[80px] max-h-[200px] overflow-y-auto mb-3">
          <p className="text-white/90 text-base leading-relaxed whitespace-pre-wrap">
            {displayedText}
            {isTyping && (
              <span className="inline-block w-[2px] h-[1em] bg-white/70 ml-0.5 animate-pulse align-middle" />
            )}
          </p>
        </div>

        {/* Input area — shown when it's user's turn */}
        {showInput && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 border-t border-glass-border pt-3"
          >
            <input
              type="text"
              value={inputValue}
              onChange={(e) => onInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your response..."
              className="flex-1 bg-dark-100/60 border border-glass-border rounded-lg px-4 py-2 text-white placeholder-white/30 focus:outline-none focus:border-parlor-500/50"
              autoFocus
            />
            <button
              onClick={onSend}
              disabled={!inputValue.trim()}
              className="p-2 rounded-lg bg-parlor-500 text-white hover:bg-parlor-600 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Send className="w-5 h-5" />
            </button>
          </motion.div>
        )}

        {/* Generating indicator */}
        {isGenerating && (
          <div className="flex items-center gap-2 text-white/40 text-sm pt-2">
            <div className="flex gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-parlor-500 animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-parlor-500 animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-1.5 h-1.5 rounded-full bg-parlor-500 animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span>{character.name} is typing...</span>
          </div>
        )}
      </div>
    </div>
  );
}
