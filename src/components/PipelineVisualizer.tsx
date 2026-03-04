import React from "react";
import { motion } from "motion/react";
import { CheckCircle2, Circle, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { AgentStep } from "@/lib/agents";

interface PipelineVisualizerProps {
  currentStep: AgentStep;
  steps: { id: AgentStep; label: string; description: string }[];
  error?: string;
}

export function PipelineVisualizer({ currentStep, steps, error }: PipelineVisualizerProps) {
  // Helper to determine status: 'waiting' | 'active' | 'completed' | 'error'
  const getStatus = (stepId: AgentStep, index: number) => {
    const currentIndex = steps.findIndex(s => s.id === currentStep);
    if (error && stepId === currentStep) return 'error';
    if (index < currentIndex) return 'completed';
    if (index === currentIndex) return 'active';
    return 'waiting';
  };

  return (
    <div className="w-full py-8">
      <div className="flex items-center justify-between relative">
        {/* Connecting Line */}
        <div className="absolute top-1/2 left-0 w-full h-0.5 bg-slate-200 -z-10 transform -translate-y-1/2" />
        
        {steps.map((step, index) => {
          const status = getStatus(step.id, index);
          
          return (
            <div key={step.id} className="flex flex-col items-center gap-2 relative bg-slate-50 px-2">
              <motion.div
                initial={false}
                animate={{
                  scale: status === 'active' ? 1.1 : 1,
                  backgroundColor: status === 'active' ? '#4f46e5' : status === 'completed' ? '#10b981' : status === 'error' ? '#ef4444' : '#ffffff',
                  borderColor: status === 'waiting' ? '#e2e8f0' : 'transparent',
                }}
                className={cn(
                  "w-10 h-10 rounded-full border-2 flex items-center justify-center shadow-sm transition-colors duration-300",
                  status === 'waiting' && "border-slate-200 bg-white text-slate-400",
                  status === 'active' && "bg-indigo-600 text-white ring-4 ring-indigo-100 border-transparent",
                  status === 'completed' && "bg-emerald-500 text-white border-transparent",
                  status === 'error' && "bg-red-500 text-white border-transparent"
                )}
              >
                {status === 'completed' ? (
                  <CheckCircle2 className="w-6 h-6" />
                ) : status === 'active' ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : status === 'error' ? (
                  <AlertCircle className="w-6 h-6" />
                ) : (
                  <span className="text-sm font-medium">{index + 1}</span>
                )}
              </motion.div>
              
              <div className="text-center w-32">
                <p className={cn(
                  "text-sm font-medium transition-colors duration-300",
                  status === 'active' ? "text-indigo-700" : status === 'completed' ? "text-emerald-600" : "text-slate-500"
                )}>
                  {step.label}
                </p>
                <p className="text-xs text-slate-400 mt-0.5 hidden sm:block">
                  {step.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
