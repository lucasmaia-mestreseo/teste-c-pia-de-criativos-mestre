import { FlaskConical } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { IS_TEST_VERSION } from '@/lib/testVersion';

/** "Versão de testes" pill for the headers. */
export default function TestVersionBadge() {
  if (!IS_TEST_VERSION) return null;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="ml-1 inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-400 cursor-default whitespace-nowrap">
          <FlaskConical className="h-3 w-3" /> <span className="hidden sm:inline">Versão de testes</span><span className="sm:hidden">Teste</span>
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-[260px] text-xs leading-relaxed">
        Versão de testes: pode ter instabilidades e os dados podem ser apagados. As gerações usam créditos reais de IA. Evite subir materiais confidenciais de clientes.
      </TooltipContent>
    </Tooltip>
  );
}
