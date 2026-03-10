import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';

interface ColorPickerWithHexProps {
  value: string;
  onChange: (color: string) => void;
  label?: string;
}

const isValidHex = (v: string) => /^#[0-9A-Fa-f]{6}$/.test(v);

export default function ColorPickerWithHex({ value, onChange, label }: ColorPickerWithHexProps) {
  const [hex, setHex] = useState(value || '');

  useEffect(() => {
    setHex(value || '');
  }, [value]);

  const handleHexChange = (v: string) => {
    let formatted = v.startsWith('#') ? v : `#${v}`;
    setHex(formatted);
    if (isValidHex(formatted)) {
      onChange(formatted);
    }
  };

  return (
    <div className="space-y-1">
      {label && <span className="text-xs text-muted-foreground font-medium">{label}</span>}
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={isValidHex(hex) ? hex : '#000000'}
          onChange={(e) => { setHex(e.target.value); onChange(e.target.value); }}
          className="w-8 h-8 rounded cursor-pointer border border-border bg-transparent p-0.5"
        />
        <Input
          value={hex}
          onChange={(e) => handleHexChange(e.target.value)}
          placeholder="#000000"
          className="bg-secondary h-8 text-xs font-mono w-24"
          maxLength={7}
        />
      </div>
    </div>
  );
}
