import { useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { X, RotateCcw as Reset, Brain } from 'lucide-react';
import { Button } from '../ui';
import type { Preset, ParameterOverrides } from '../../types';

interface ParameterPanelProps {
  preset: Preset | null;
  contextSize: number;
  overrides: ParameterOverrides;
  onOverridesChange: (overrides: ParameterOverrides) => void;
  onSave: (overrides: ParameterOverrides) => void;
  onClose: () => void;
}

export function ParameterPanel({
  preset,
  contextSize,
  overrides,
  onOverridesChange,
  onSave,
  onClose,
}: ParameterPanelProps) {
  const { t } = useTranslation();
  const setOverride = <K extends keyof ParameterOverrides>(key: K, value: ParameterOverrides[K]) => {
    onOverridesChange({ ...overrides, [key]: value });
  };

  const resetOverride = (key: keyof ParameterOverrides) => {
    onOverridesChange({ ...overrides, [key]: undefined });
  };

  const resetAll = () => {
    onOverridesChange({
      temperature: undefined,
      topP: undefined,
      minP: undefined,
      frequencyPenalty: undefined,
      presencePenalty: undefined,
      maxTokens: undefined,
      contextSize: undefined,
      reasoningMode: undefined,
      reasoningBudgetTokens: undefined,
      reasoningEffort: undefined,
    });
  };

  const activeReasoningMode = overrides.reasoningMode ?? preset?.reasoningMode;

  return (
    <motion.div
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-dark-200 border-l border-glass-border z-50 overflow-y-auto shadow-dramatic"
    >
      {/* Header */}
      <div className="sticky top-0 bg-dark-200/95 backdrop-blur-sm border-b border-glass-border p-4 flex items-center justify-between">
        <h2 className="font-semibold text-white font-serif tracking-tight">{t('chat.parameters.title')}</h2>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-glass-white transition-colors">
          <X className="w-5 h-5 text-gray-400" />
        </button>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        <p className="text-sm text-gray-500">
          {t('chat.parameters.overridePrefix')}{' '}
          <span className="text-parlor-400">{t('chat.parameters.highlightedValues')}</span>{' '}
          {t('chat.parameters.overrideSuffix')}
        </p>

        {/* Temperature */}
        <SliderParam
          label={t('settings.presets.temperature')}
          value={overrides.temperature ?? preset?.temperature ?? 0.8}
          displayValue={overrides.temperature ?? preset?.temperature ?? '—'}
          min={0} max={2} step={0.05}
          onChange={(v) => setOverride('temperature', v)}
          onReset={() => resetOverride('temperature')}
          isOverridden={overrides.temperature !== undefined}
        />

        {/* Top P */}
        <SliderParam
          label={t('settings.presets.topP')}
          value={overrides.topP ?? preset?.topP ?? 0.9}
          displayValue={overrides.topP ?? preset?.topP ?? '—'}
          min={0} max={1} step={0.05}
          onChange={(v) => setOverride('topP', v)}
          onReset={() => resetOverride('topP')}
          isOverridden={overrides.topP !== undefined}
        />

        {/* Min P */}
        <SliderParam
          label={t('settings.presets.minP')}
          value={overrides.minP ?? preset?.minP ?? 0}
          displayValue={overrides.minP ?? preset?.minP ?? 0}
          min={0} max={1} step={0.05}
          onChange={(v) => setOverride('minP', v)}
          onReset={() => resetOverride('minP')}
          isOverridden={overrides.minP !== undefined}
        />

        {/* Context Size */}
        <SliderParam
          label={t('chat.parameters.context')}
          value={overrides.contextSize ?? contextSize}
          displayValue={overrides.contextSize ?? contextSize}
          min={5} max={100} step={5}
          onChange={(v) => setOverride('contextSize', Math.round(v))}
          onReset={() => resetOverride('contextSize')}
          isInt
          isOverridden={overrides.contextSize !== undefined}
        />

        {/* Max Tokens */}
        <SliderParam
          label={t('settings.presets.maxTokens')}
          value={overrides.maxTokens ?? preset?.maxTokens ?? 2048}
          displayValue={overrides.maxTokens ?? preset?.maxTokens ?? '—'}
          min={100} max={131072} step={256}
          onChange={(v) => setOverride('maxTokens', Math.round(v))}
          onReset={() => resetOverride('maxTokens')}
          isInt
          isOverridden={overrides.maxTokens !== undefined}
        />

        {/* Frequency Penalty */}
        <SliderParam
          label={t('settings.presets.frequencyPenalty')}
          value={overrides.frequencyPenalty ?? preset?.frequencyPenalty ?? 0}
          displayValue={overrides.frequencyPenalty ?? preset?.frequencyPenalty ?? '—'}
          min={0} max={2} step={0.1}
          onChange={(v) => setOverride('frequencyPenalty', v)}
          onReset={() => resetOverride('frequencyPenalty')}
          isOverridden={overrides.frequencyPenalty !== undefined}
        />

        {/* Presence Penalty */}
        <SliderParam
          label={t('settings.presets.presencePenalty')}
          value={overrides.presencePenalty ?? preset?.presencePenalty ?? 0}
          displayValue={overrides.presencePenalty ?? preset?.presencePenalty ?? '—'}
          min={0} max={2} step={0.1}
          onChange={(v) => setOverride('presencePenalty', v)}
          onReset={() => resetOverride('presencePenalty')}
          isOverridden={overrides.presencePenalty !== undefined}
        />

        {/* Reasoning Section */}
        <div className="pt-4 border-t border-glass-border">
          <div className="flex items-center gap-2 mb-3">
            <Brain className={`w-4 h-4 ${overrides.reasoningMode !== undefined ? 'text-parlor-400' : 'text-gray-400'}`} />
            <h3 className={`text-sm font-medium ${overrides.reasoningMode !== undefined ? 'text-parlor-300' : 'text-gray-300'}`}>
              {t('chat.parameters.reasoningMode')}
              {overrides.reasoningMode !== undefined && <span className="ml-1.5 w-1.5 h-1.5 rounded-full bg-parlor-400 inline-block align-middle" />}
            </h3>
          </div>
          <p className="text-xs text-gray-500 mb-3">
            {t('chat.parameters.extendedReasoningDesc')}
          </p>

          <div className="mb-3">
            <label className="text-sm text-gray-300 mb-2 block">{t('chat.parameters.mode')}</label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { value: 'none', label: t('common.off') },
                { value: 'auto', label: 'Auto' },
                { value: 'deepseek', label: 'DeepSeek' },
              ] as const).map((option) => (
                <button
                  key={option.value}
                  onClick={() => setOverride('reasoningMode', overrides.reasoningMode === option.value ? undefined : option.value)}
                  className={`py-1.5 px-2 rounded-lg text-xs transition-colors ${
                    (overrides.reasoningMode ?? preset?.reasoningMode ?? 'none') === option.value
                      ? 'bg-parlor-500 text-white'
                      : 'bg-dark-200 text-gray-500 hover:bg-dark-100'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>



          <div className="mt-3 text-xs text-gray-500">
            {activeReasoningMode === 'auto' && (
              <p>{t('chat.parameters.modeAutoDesc')}</p>
            )}
            {activeReasoningMode === 'deepseek' && (
              <p>{t('chat.parameters.modeDeepseekDesc')}</p>
            )}

          </div>
        </div>

        {/* Actions */}
        <div className="pt-4 border-t border-glass-border space-y-2">
          <Button
            className="w-full justify-center"
            onClick={() => onSave(overrides)}
          >
            {t('chat.parameters.saveOverrides')}
          </Button>
          <Button variant="ghost" className="w-full justify-center" onClick={resetAll}>
            <Reset className="w-4 h-4" />
            {t('chat.parameters.resetToPreset')}
          </Button>
        </div>
      </div>
    </motion.div>
  );
}

// Reusable slider parameter component
function SliderParam({
  label,
  value,
  displayValue,
  min,
  max,
  step,
  onChange,
  onReset,
  isInt,
  isOverridden,
}: {
  label: string;
  value: number;
  displayValue: number | string;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  onReset: () => void;
  isInt?: boolean;
  isOverridden?: boolean;
}) {
  const { t } = useTranslation();
  const [isEditingValue, setIsEditingValue] = useState(false);
  const [inputValue, setInputValue] = useState('');

  const handleValueClick = () => {
    setInputValue(String(typeof displayValue === 'number' ? displayValue : value));
    setIsEditingValue(true);
  };

  const commitValue = () => {
    const parsed = isInt ? parseInt(inputValue) : parseFloat(inputValue);
    if (!isNaN(parsed)) {
      onChange(Math.min(max, Math.max(min, parsed)));
    }
    setIsEditingValue(false);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-1.5">
        <label className={`text-sm flex items-center gap-1.5 ${isOverridden ? 'text-parlor-300' : 'text-gray-300'}`}>
          {isOverridden && <span className="w-1.5 h-1.5 rounded-full bg-parlor-400 flex-shrink-0" />}
          {label}
        </label>
        {isEditingValue ? (
          <input
            type="number"
            min={min}
            max={max}
            step={step}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onBlur={commitValue}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitValue();
              if (e.key === 'Escape') setIsEditingValue(false);
            }}
            autoFocus
            className="w-20 text-right text-sm bg-dark-100 text-white border border-parlor-500/50 rounded px-1.5 py-0.5 focus:outline-none focus:border-parlor-500"
          />
        ) : (
          <button
            onClick={handleValueClick}
            title={t('chat.parameters.clickToTypeValue')}
            className={`text-sm hover:text-white hover:bg-dark-100 rounded px-1.5 py-0.5 -mr-1.5 transition-colors ${isOverridden ? 'text-parlor-300' : 'text-gray-400'}`}
          >
            {displayValue}
          </button>
        )}
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => {
          const v = isInt ? parseInt(e.target.value) : parseFloat(e.target.value);
          onChange(v);
        }}
        className="w-full accent-parlor-500"
      />
      {isOverridden && (
        <button onClick={onReset} className="text-xs text-gray-500 hover:text-parlor-400 mt-1 transition-colors">
          {t('chat.parameters.resetLink')}
        </button>
      )}
    </div>
  );
}
