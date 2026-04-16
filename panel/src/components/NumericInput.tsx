import React from 'react';

interface Props {
  value: number;
  onChange: (n: number) => void;
  style?: React.CSSProperties;
  placeholder?: string;
  min?: number;
  max?: number;
}

export default function NumericInput({ value, onChange, style, placeholder, min, max }: Props) {
  const [text, setText] = React.useState<string>(value ? String(value) : '');
  const lastEmitted = React.useRef<number>(value);

  React.useEffect(() => {
    if (value !== lastEmitted.current) {
      setText(value ? String(value) : '');
      lastEmitted.current = value;
    }
  }, [value]);

  return (
    <input
      type="text"
      inputMode="decimal"
      style={style}
      value={text}
      placeholder={placeholder}
      onChange={(e) => {
        const v = e.target.value.replace(',', '.');
        if (v !== '' && !/^-?\d*\.?\d*$/.test(v)) return;
        setText(v);
        const n = v === '' || v === '.' || v === '-' ? 0 : parseFloat(v);
        if (!isNaN(n)) {
          let clamped = n;
          if (min !== undefined && clamped < min) clamped = min;
          if (max !== undefined && clamped > max) clamped = max;
          lastEmitted.current = clamped;
          onChange(clamped);
        }
      }}
      onBlur={() => {
        if (text === '' || text === '.' || text === '-') { setText(''); return; }
        const n = parseFloat(text);
        if (!isNaN(n)) setText(String(n));
      }}
      onFocus={(e) => e.target.select()}
    />
  );
}
