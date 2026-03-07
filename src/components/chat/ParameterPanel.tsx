import { useState } from 'react';
import { motion } from 'framer-motion';
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
        <h2 className="font-semibold text-white font-serif tracking-tight">Chat Parameters</h2>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-glass-white transition-colors">
          <X className="w-5 h-5 text-gray-400" />
        </button>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        <p className="text-sm text-gray-500">
          Override preset parameters for this chat only.{' '}
          <span className="text-parlor-400">Highlighted values</span> are overriding preset defaults.
        </p>

        {/* Temperature */}
        <SliderParam
          label="Temperature"
          value={overrides.temperature ?? preset?.temperature ?? 0.8}
          displayValue={overrides.temperature ?? preset?.temperature ?? '—'}
          min={0} max={2} step={0.05}
          onChange={(v) => setOverride('temperature', v)}
          onReset={() => resetOverride('temperature')}
          isOverridden={overrides.temperature !== undefined}
        />

        {/* Top P */}
        <SliderParam
          label="Top P"
          value={overrides.topP ?? preset?.topP ?? 0.9}
          displayValue={overrides.topP ?? preset?.topP ?? '—'}
          min={0} max={1} step={0.05}
          onChange={(v) => setOverride('topP', v)}
          onReset={() => resetOverride('topP')}
          isOverridden={overrides.topP !== undefined}
        />

        {/* Min P */}
        <SliderParam
          label="Min P"
          value={overrides.minP ?? preset?.minP ?? 0}
          displayValue={overrides.minP ?? preset?.minP ?? 0}
          min={0} max={1} step={0.05}
          onChange={(v) => setOverride('minP', v)}
          onReset={() => resetOverride('minP')}
          isOverridden={overrides.minP !== undefined}
        />

        {/* Context Size */}
        <SliderParam
          label="Context (messages)"
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
          label="Max Tokens"
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
          label="Frequency Penalty"
          value={overrides.frequencyPenalty ?? preset?.frequencyPenalty ?? 0}
          displayValue={overrides.frequencyPenalty ?? preset?.frequencyPenalty ?? '—'}
          min={0} max={2} step={0.1}
          onChange={(v) => setOverride('frequencyPenalty', v)}
          onReset={() => resetOverride('frequencyPenalty')}
          isOverridden={overrides.frequencyPenalty !== undefined}
        />

        {/* Presence Penalty */}
        <SliderParam
          label="Presence Penalty"
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
              Reasoning Mode
              {overrides.reasoningMode !== undefined && <span className="ml-1.5 w-1.5 h-1.5 rounded-full bg-parlor-400 inline-block align-middle" />}
            </h3>
          </div>
          <p className="text-xs text-gray-500 mb-3">
            Enable extended reasoning for models like OpenAI o1/o3, DeepSeek R1, GLM, or Claude. "Auto" detects based on model name.
          </p>

          <div className="mb-3">
            <label className="text-sm text-gray-300 mb-2 block">Mode</label>
            <div className="grid grid-cols-3 gap-2">
              {([
                { value: 'none', label: 'Off' },
                { value: 'auto', label: 'Auto' },
                { value: 'openai', label: 'OpenAI' },
                { value: 'anthropic', label: 'Anthropic' },
                { value: 'deepseek', label: 'DeepSeek' },
                { value: 'glm', label: 'GLM' },
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

          {activeReasoningMode === 'openai' && (
            <div className="mb-3">
              <label className="text-sm text-gray-300 mb-2 block">Reasoning Effort</label>
              <div className="flex gap-2">
                {([undefined, 'low', 'medium', 'high'] as const).map((effort) => (
                  <button
                    key={effort ?? 'auto'}
                    onClick={() => setOverride('reasoningEffort', effort)}
                    className={`flex-1 py-1.5 px-2 rounded-lg text-xs transition-colors ${
                      (overrides.reasoningEffort ?? preset?.reasoningEffort) === effort
                        ? 'bg-parlor-500 text-white'
                        : 'bg-dark-200 text-gray-500 hover:bg-dark-100'
                    }`}
                  >
                    {effort === undefined ? 'Auto' : effort.charAt(0).toUpperCase() + effort.slice(1)}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-1">Auto lets the model decide; Low is fastest, High is most thorough.</p>
            </div>
          )}

          {activeReasoningMode === 'anthropic' && (
            <SliderParam
              label="Thinking Budget (tokens)"
              value={overrides.reasoningBudgetTokens ?? preset?.reasoningBudgetTokens ?? 8192}
              displayValue={overrides.reasoningBudgetTokens ?? preset?.reasoningBudgetTokens ?? 8192}
              min={1024} max={16384} step={512}
              onChange={(v) => setOverride('reasoningBudgetTokens', Math.round(v))}
              onReset={() => resetOverride('reasoningBudgetTokens')}
              isInt
              isOverridden={overrides.reasoningBudgetTokens !== undefined}
            />
          )}

          <div className="mt-3 text-xs text-gray-500">
            {activeReasoningMode === 'auto' && (
              <p>Auto-detects reasoning based on model name (o1-, claude, deepseek-r1, glm, etc.)</p>
            )}
            {activeReasoningMode === 'openai' && (
              <p>Uses reasoning_effort parameter. Works with o1, o3, o4-mini models.</p>
            )}
            {activeReasoningMode === 'anthropic' && (
              <p>Enables Claude extended thinking. Budget controls reasoning depth vs. cost.</p>
            )}
            {activeReasoningMode === 'deepseek' && (
              <p>DeepSeek R1 always reasons. Parses reasoning_content from response.</p>
            )}
            {activeReasoningMode === 'glm' && (
              <p>{'GLM reasoning models output <think> tags naturally, parsed from response.'}</p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="pt-4 border-t border-glass-border space-y-2">
          <Button
            className="w-full justify-center"
            onClick={() => onSave(overrides)}
          >
            Save Overrides
          </Button>
          <Button variant="ghost" className="w-full justify-center" onClick={resetAll}>
            <Reset className="w-4 h-4" />
            Reset All to Preset
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
            title="Click to type a value"
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
          ↩ Reset to preset
        </button>
      )}
    </div>
  );
}
