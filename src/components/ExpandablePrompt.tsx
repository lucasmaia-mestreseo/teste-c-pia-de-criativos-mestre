import { useState } from 'react';

interface ExpandablePromptProps {
  text: string;
}

export default function ExpandablePrompt({ text }: ExpandablePromptProps) {
  const [expanded, setExpanded] = useState(false);

  if (!text) return null;

  return (
    <div className="mt-2">
      <p className={`text-[10px] text-muted-foreground leading-tight ${expanded ? 'max-h-[30vh] overflow-y-auto pr-1' : 'line-clamp-4'}`}>
        {text}
      </p>
      {text.length > 120 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-[10px] text-primary hover:underline mt-0.5"
        >
          {expanded ? 'Ver menos' : 'Ver mais'}
        </button>
      )}
    </div>
  );
}
