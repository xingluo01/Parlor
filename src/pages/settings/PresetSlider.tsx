import { useState } from 'react';

// Slider with a clickable value label that turns into a number input
export function PresetSlider({
  label,
  value,
  min,
  max,
  step,
  isInt,
  hint,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  isInt?: boolean;
  hint?: [string, string];
  onChange: (v: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [raw, setRaw] = useState('');
  const display = isInt ? String(value) : value.toFixed(2);

  const commit = () => {
    const parsed = isInt ? parseInt(raw) : parseFloat(raw);
    if (!isNaN(parsed)) onChange(Math.min(max, Math.max(min, parsed)));
    setEditing(false);
  };

  return (
    <div>
      <div className="flex justify-between mb-1.5">
        <label className="text-sm font-medium text-gray-300">{label}</label>
        {editing ? (
          <input
            type="number"
            min={min}
            max={max}
            step={step}
            value={raw}
            onChange={e => setRaw(e.target.value)}
            onBlur={commit}
            onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
            autoFocus
            className="w-20 text-right text-sm bg-dark-100 text-white border border-parlor-500/50 rounded px-1.5 py-0.5 focus:outline-none focus:border-parlor-500"
          />
        ) : (
          <button
            type="button"
            onClick={() => { setRaw(display); setEditing(true); }}
            title="Click to type a value"
            className="text-sm text-gray-400 hover:text-white hover:bg-dark-100 rounded px-1.5 py-0.5 -mr-1.5 transition-colors"
          >
            {display}
          </button>
        )}
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(isInt ? parseInt(e.target.value) : parseFloat(e.target.value))}
        className="w-full accent-parlor-500"
      />
      {hint && (
        <div className="flex justify-between text-xs text-gray-600 mt-0.5">
          <span>{hint[0]}</span>
          <span>{hint[1]}</span>
        </div>
      )}
    </div>
  );
}
