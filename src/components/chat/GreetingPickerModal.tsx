import { useTranslation } from 'react-i18next';
import { Modal } from '../ui';
import type { CharacterCard } from '../../types';

interface GreetingPickerModalProps {
  character: CharacterCard;
  onSelect: (greeting: string) => void;
  onClose: () => void;
}

export function GreetingPickerModal({ character, onSelect, onClose }: GreetingPickerModalProps) {
  const { t } = useTranslation();
  const greetings = [
    { label: t('common.default'), content: character.firstMessage },
    ...(character.alternateGreetings ?? []).map((g, i) => ({ label: t('chat.alternateGreeting', { number: i + 1 }), content: g })),
  ];

  return (
    <Modal isOpen onClose={onClose} title={t('chat.chooseGreeting')} size="md">
      <p className="text-sm text-parlor-400 mb-3 font-serif">{character.name}</p>
      <div className="max-h-96 overflow-y-auto space-y-2">
        {greetings.map(({ label, content }) => (
          <button
            key={label}
            onClick={() => onSelect(content)}
            className="w-full text-left glass-sm p-3 rounded-lg cursor-pointer hover:border-parlor-400/40 transition-all"
          >
            <span className="inline-block text-xs font-semibold text-parlor-400 bg-parlor-500/10 px-2 py-0.5 rounded mb-2">
              {label}
            </span>
            <p className="text-sm text-gray-300 line-clamp-3 whitespace-pre-wrap break-words">
              {content}
            </p>
          </button>
        ))}
      </div>
    </Modal>
  );
}
