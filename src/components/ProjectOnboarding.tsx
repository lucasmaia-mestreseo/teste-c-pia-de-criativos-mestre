import { useState } from 'react';
import { Check, ChevronRight, ChevronLeft, Palette, FileText, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import BrandKitPanel from '@/components/BrandKitPanel';
import ContextPanel from '@/components/ContextPanel';
import { useCompleteOnboarding } from '@/hooks/useProject';
import { cn } from '@/lib/utils';

interface ProjectOnboardingProps {
  projectId: string;
  onComplete: () => void;
}

const steps = [
  { label: 'Brand Kit', icon: Palette, description: 'Configure cores, logo e identidade visual' },
  { label: 'Contexto', icon: FileText, description: 'Defina o contexto e tom de voz do projeto' },
  { label: 'Começar', icon: Sparkles, description: 'Tudo pronto para criar!' },
];

export default function ProjectOnboarding({ projectId, onComplete }: ProjectOnboardingProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const completeOnboarding = useCompleteOnboarding();

  const handleFinish = async () => {
    await completeOnboarding.mutateAsync(projectId);
    onComplete();
  };

  return (
    <div className="flex-1 flex flex-col items-center overflow-auto bg-background p-8">
      {/* Stepper */}
      <div className="flex items-center gap-2 mb-10">
        {steps.map((step, i) => {
          const Icon = step.icon;
          const done = i < currentStep;
          const active = i === currentStep;
          return (
            <div key={i} className="flex items-center gap-2">
              <div
                className={cn(
                  'flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors',
                  done && 'bg-primary border-primary text-primary-foreground',
                  active && 'border-primary text-primary',
                  !done && !active && 'border-muted text-muted-foreground'
                )}
              >
                {done ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
              </div>
              <span className={cn('text-sm font-medium hidden sm:inline', active ? 'text-foreground' : 'text-muted-foreground')}>
                {step.label}
              </span>
              {i < steps.length - 1 && (
                <div className={cn('w-12 h-0.5 mx-1', i < currentStep ? 'bg-primary' : 'bg-muted')} />
              )}
            </div>
          );
        })}
      </div>

      {/* Step content */}
      <div className="w-full max-w-4xl flex-1 min-h-0">
        {currentStep === 0 && (
          <div className="flex flex-col h-full">
            <p className="text-center text-muted-foreground mb-4">{steps[0].description}</p>
            <div className="flex-1 min-h-0 overflow-auto border rounded-lg">
              <BrandKitPanel projectId={projectId} />
            </div>
            <div className="flex justify-end mt-6">
              <Button onClick={() => setCurrentStep(1)}>
                Próximo <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {currentStep === 1 && (
          <div className="flex flex-col h-full">
            <p className="text-center text-muted-foreground mb-4">{steps[1].description}</p>
            <div className="flex-1 min-h-0 overflow-auto border rounded-lg">
              <ContextPanel projectId={projectId} />
            </div>
            <div className="flex justify-between mt-6">
              <Button variant="outline" onClick={() => setCurrentStep(0)}>
                <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
              </Button>
              <Button onClick={() => setCurrentStep(2)}>
                Próximo <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {currentStep === 2 && (
          <div className="flex flex-col items-center justify-center h-full gap-6">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-10 w-10 text-primary" />
            </div>
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold">Projeto configurado!</h2>
              <p className="text-muted-foreground max-w-md">
                Seu Brand Kit e Contexto estão prontos. Agora você pode gerar seu primeiro criativo.
              </p>
            </div>
            <Button size="lg" onClick={handleFinish} disabled={completeOnboarding.isPending}>
              <Sparkles className="h-5 w-5 mr-2" />
              Começar a criar
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setCurrentStep(1)}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Voltar e revisar
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
