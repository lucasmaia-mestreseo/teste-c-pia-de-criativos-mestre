import { useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import ImageAttachments from './ImageAttachments';

export interface FreePromptData {
  prompt: string;
  attachedImages: string[];
}

interface FreePromptPanelProps {
  projectId: string;
  data: FreePromptData;
  onChange: (data: FreePromptData) => void;
}

export default function FreePromptPanel({ projectId, data, onChange }: FreePromptPanelProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <h2 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">Prompt Livre</h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div>
          <p className="text-xs text-muted-foreground mb-2">
            Descreva o criativo que deseja gerar. Você pode anexar imagens como referência.
          </p>
          <Textarea
            placeholder="Descreva o criativo que você quer criar..."
            value={data.prompt}
            onChange={(e) => onChange({ ...data, prompt: e.target.value })}
            className="bg-secondary resize-none min-h-[200px] text-sm"
          />
        </div>

        <ImageAttachments
          projectId={projectId}
          images={data.attachedImages}
          onChange={(imgs) => onChange({ ...data, attachedImages: imgs })}
        />
      </div>
    </div>
  );
}
