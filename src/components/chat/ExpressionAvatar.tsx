import { useMemo } from 'react';
import { Avatar } from '../ui';
import { detectExpression } from '../../services/expressionDetector';
import type { CharacterCard } from '../../types';

type ExpressionAvatarProps = {
  character: CharacterCard;
  messageContent: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
};

/**
 * Avatar that swaps to expression images based on detected emotion in the message.
 * Falls back to the default avatar if no expression image exists for the detected emotion.
 */
export function ExpressionAvatar({ character, messageContent, size, className }: ExpressionAvatarProps) {
  const expressionSrc = useMemo(() => {
    if (!character.expressions || Object.keys(character.expressions).length === 0) {
      return character.avatar;
    }
    const emotion = detectExpression(messageContent);
    return character.expressions[emotion] || character.expressions['neutral'] || character.avatar;
  }, [character.avatar, character.expressions, messageContent]);

  return (
    <Avatar
      src={expressionSrc}
      name={character.name}
      size={size}
      className={className}
    />
  );
}
