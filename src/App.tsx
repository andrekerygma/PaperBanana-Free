import React, { useState, useRef } from 'react';
import { Layout } from './components/Layout';
import { PipelineVisualizer } from './components/PipelineVisualizer';
import { 
  runRetrieverAgent, 
  runPlannerAgent, 
  runStylistAgent, 
  runVisualizerAgent, 
  runCriticAgent,
  runRefinerAgent,
  INITIAL_STATE,
  type AgentState,
  type AgentStep
} from './lib/agents';
import { Loader2, Send, RefreshCw, CheckCircle, AlertTriangle, Image as ImageIcon, FileText, X, StopCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';

import { SettingsModal } from './components/SettingsModal';

export default function App() {
  const [state, setState] = useState<AgentState>(INITIAL_STATE);
  const [contextInput, setContextInput] = useState("");
  const [intentInput, setIntentInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pdfFile, setPdfFile] = useState<{ name: string; base64: string } | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const logsEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);
  const abortController = useRef<boolean>(false);

  // Auto-scroll to bottom of logs
  React.useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [state.logs]);

  const addLog = (message: string) => {
    setState(prev => ({ ...prev, logs: [...prev.logs, message] }));
  };

  const handleReset = () => {
    setState(INITIAL_STATE);
    setContextInput("");
    setIntentInput("");
    setPdfFile(null);
    setError(null);
    abortController.current = false;
    setIsSettingsOpen(false);
  };

  const handleClearLogs = () => {
    setState(prev => ({ ...prev, logs: [] }));
    setIsSettingsOpen(false);
  };

  const handleHistoryClick = () => {
    if (state.history.length > 0 && historyRef.current) {
      historyRef.current.scrollIntoView({ behavior: "smooth" });
    } else {
      // If no history, maybe shake the button or show a toast?
      // For now, let's just log it or ignore.
      // Or better, scroll to the results area if there's a current image.
      if (state.generatedImage) {
        // Scroll to image
        const imgElement = document.querySelector('img[alt="Generated Illustration"]');
        imgElement?.scrollIntoView({ behavior: "smooth" });
      }
    }
  };

  const handleStop = () => {
    abortController.current = true;
    addLog("🛑 Processo interrompido pelo usuário.");
    setState(prev => ({ ...prev, isProcessing: false }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setError("Por favor, selecione um arquivo PDF válido.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      const base64Data = base64.split(',')[1];
      setPdfFile({ name: file.name, base64: base64Data });
      setError(null);
    };
    reader.readAsDataURL(file);
  };

  const handleStart = async () => {
    if ((!contextInput.trim() && !pdfFile) || !intentInput.trim()) {
      setError("Por favor, forneça um contexto (texto ou PDF) e uma intenção.");
      return;
    }
    
    abortController.current = false;
    setError(null);
    setState({
      ...INITIAL_STATE,
      sourceContext: contextInput,
      communicativeIntent: intentInput,
      isProcessing: true,
      step: 'retriever',
      logs: ["Iniciando processo de geração..."]
    });

    try {
      if (abortController.current) return;

      // 1. Retriever
      addLog("🔍 Agente Recuperador: Buscando referências visuais e estilos...");
      const references = await runRetrieverAgent(contextInput, intentInput, pdfFile?.base64);
      if (abortController.current) return;
      addLog(`✅ Referências encontradas: ${references.join(", ")}`);
      
      setState(prev => ({ ...prev, retrievedReferences: references, step: 'planner' }));

      // 2. Planner
      if (abortController.current) return;
      addLog("📝 Agente Planejador: Estruturando o layout e conteúdo visual...");
      const plan = await runPlannerAgent(contextInput, intentInput, references, pdfFile?.base64);
      if (abortController.current) return;
      addLog(`✅ Plano criado. Detalhes: ${plan}`);
      
      setState(prev => ({ ...prev, plan, step: 'stylist' }));

      // 3. Stylist
      if (abortController.current) return;
      addLog("🎨 Agente Estilista: Otimizando prompt para geração de imagem...");
      const stylePrompt = await runStylistAgent(plan, references);
      if (abortController.current) return;
      addLog(`✅ Prompt gerado: ${stylePrompt}`);
      
      setState(prev => ({ ...prev, stylePrompt, step: 'visualizer' }));

      // Start the refinement loop
      await runRefinementLoop(stylePrompt, plan, intentInput, 0);

    } catch (err: any) {
      if (abortController.current) return; // Ignore errors if stopped
      console.error(err);
      const errorMessage = err.message || "Ocorreu um erro desconhecido.";
      setError(`Erro no processo: ${errorMessage}`);
      addLog(`❌ ERRO: ${errorMessage}`);
      setState(prev => ({ ...prev, isProcessing: false }));
    }
  };

  const runRefinementLoop = async (currentPrompt: string, plan: string, intent: string, iteration: number) => {
    if (abortController.current) return;

    if (iteration >= 3) {
      addLog("🏁 Limite de iterações atingido. Finalizando...");
      setState(prev => ({ ...prev, step: 'complete', isProcessing: false }));
      return;
    }

    setState(prev => ({ ...prev, step: 'visualizer', iteration: iteration + 1 }));

    // 4. Visualizer
    addLog(`🖼️ Agente Visualizador (Iteração ${iteration + 1}): Gerando imagem...`);
    const imageBase64 = await runVisualizerAgent(currentPrompt);
    
    if (abortController.current) return;

    if (!imageBase64) {
      throw new Error("Falha na geração da imagem.");
    }
    
    addLog("✅ Imagem gerada com sucesso.");
    
    // Add to history
    setState(prev => ({ 
      ...prev, 
      generatedImage: imageBase64, 
      step: 'critic',
      history: [...prev.history, { 
        image: imageBase64, 
        prompt: currentPrompt, 
        iteration: iteration + 1 
      }]
    }));

    // 5. Critic
    if (abortController.current) return;
    addLog("🧐 Agente Crítico: Analisando a imagem contra a intenção original...");
    const critiqueResult = await runCriticAgent(intent, plan, imageBase64);
    
    if (abortController.current) return;

    addLog(`📊 Nota: ${critiqueResult.score}/10. Crítica: ${critiqueResult.critique}`);
    
    // Update history with critique
    setState(prev => {
      const newHistory = [...prev.history];
      if (newHistory.length > 0) {
        newHistory[newHistory.length - 1].critique = critiqueResult.critique;
      }
      return { 
        ...prev, 
        critique: critiqueResult.critique,
        history: newHistory
      };
    });

    if (critiqueResult.score >= 8) {
      addLog("🎉 Qualidade satisfatória alcançada! Processo concluído.");
      setState(prev => ({ ...prev, step: 'complete', isProcessing: false }));
    } else {
      addLog("🔄 Refinando prompt com base na crítica...");
      
      // Use the Refiner Agent to rewrite the prompt intelligently
      const newPrompt = await runRefinerAgent(
        currentPrompt, 
        critiqueResult.critique, 
        critiqueResult.refinedPromptSuggestion
      );
      
      if (abortController.current) return;

      addLog(`📝 Prompt refinado: ${newPrompt}`);
      
      // Recursive call for next iteration
      await runRefinementLoop(newPrompt, plan, intent, iteration + 1);
    }
  };

  const steps: { id: AgentStep; label: string; description: string }[] = [
    { id: 'retriever', label: 'Recuperação', description: 'Busca de referências' },
    { id: 'planner', label: 'Planejamento', description: 'Estrutura visual' },
    { id: 'stylist', label: 'Estilização', description: 'Prompt engineering' },
    { id: 'visualizer', label: 'Visualização', description: 'Geração de imagem' },
    { id: 'critic', label: 'Crítica', description: 'Refinamento iterativo' },
  ];

  return (
    <Layout
      onNewProject={handleReset}
      onHistoryClick={handleHistoryClick}
      onSettingsClick={() => setIsSettingsOpen(true)}
    >
      <div className="space-y-8">
        {/* Header Section */}
        <div className="text-center space-y-2">
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Crie Ilustrações Acadêmicas</h2>
          <p className="text-slate-500 max-w-2xl mx-auto">
            Descreva seu conceito e deixe nossos agentes de IA criarem, planejarem e refinarem a ilustração perfeita para seu artigo ou apresentação.
          </p>
        </div>

        {/* Input Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Contexto da Fonte (Abstract/Texto ou PDF)</label>
              <div className="space-y-2">
                <textarea
                  className="w-full h-32 p-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none text-sm"
                  placeholder="Cole aqui o resumo do seu artigo ou o parágrafo que descreve o conceito..."
                  value={contextInput}
                  onChange={(e) => setContextInput(e.target.value)}
                  disabled={state.isProcessing}
                />
                
                {/* PDF Upload */}
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    accept="application/pdf"
                    ref={fileInputRef}
                    className="hidden"
                    onChange={handleFileChange}
                    disabled={state.isProcessing}
                  />
                  
                  {!pdfFile ? (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={state.isProcessing}
                      className="text-sm flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md transition-colors border border-slate-200"
                    >
                      <FileText className="w-4 h-4" />
                      Anexar PDF
                    </button>
                  ) : (
                    <div className="flex items-center gap-2 px-3 py-2 bg-indigo-50 text-indigo-700 rounded-md border border-indigo-100 text-sm">
                      <FileText className="w-4 h-4" />
                      <span className="truncate max-w-[200px]">{pdfFile.name}</span>
                      <button 
                        onClick={() => {
                          setPdfFile(null);
                          if (fileInputRef.current) fileInputRef.current.value = '';
                        }}
                        disabled={state.isProcessing}
                        className="ml-1 hover:text-indigo-900"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Intenção Comunicativa</label>
              <textarea
                className="w-full h-24 p-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none text-sm"
                placeholder="O que esta imagem deve transmitir? (ex: Comparar eficiência, mostrar fluxo de dados...)"
                value={intentInput}
                onChange={(e) => setIntentInput(e.target.value)}
                disabled={state.isProcessing}
              />
            </div>
            <div className="flex gap-3">
              {state.isProcessing ? (
                <button
                  onClick={handleStop}
                  className="flex-1 py-3 px-4 rounded-lg font-medium flex items-center justify-center gap-2 transition-all bg-red-100 text-red-700 hover:bg-red-200 border border-red-200"
                >
                  <StopCircle className="w-5 h-5" />
                  Parar Processo
                </button>
              ) : (
                <button
                  onClick={handleStart}
                  disabled={state.isProcessing || ((!contextInput && !pdfFile) || !intentInput)}
                  className={cn(
                    "flex-1 py-3 px-4 rounded-lg font-medium flex items-center justify-center gap-2 transition-all",
                    "bg-indigo-600 text-white hover:bg-indigo-700 shadow-md hover:shadow-lg disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed disabled:shadow-none"
                  )}
                >
                  <Send className="w-5 h-5" />
                  Iniciar Geração
                </button>
              )}
              
              {(state.step === 'complete' || state.generatedImage || state.history.length > 0) && !state.isProcessing && (
                <button
                  onClick={handleReset}
                  className="px-4 py-3 rounded-lg font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors flex items-center justify-center"
                  title="Reiniciar"
                >
                  <RefreshCw className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>

          {/* Logs / Status Section */}
          <div className="bg-slate-900 text-slate-200 p-6 rounded-xl shadow-sm border border-slate-800 flex flex-col h-[400px]">
            {/* ... logs content ... */}
            <div className="flex items-center justify-between mb-4 border-b border-slate-700 pb-2">
              <h3 className="font-mono text-sm font-semibold text-indigo-400">TERMINAL DO AGENTE</h3>
              {state.isProcessing && (
                <span className="flex items-center gap-2 text-xs text-emerald-400 animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  Online
                </span>
              )}
            </div>
            <div className="flex-1 overflow-y-auto font-mono text-xs space-y-2 pr-2 custom-scrollbar">
              {state.logs.length === 0 ? (
                <div className="text-slate-600 italic text-center mt-10">Aguardando início do processo...</div>
              ) : (
                state.logs.map((log, i) => (
                  <div key={i} className="flex gap-2">
                    <span className="text-slate-500">[{new Date().toLocaleTimeString()}]</span>
                    <span>{log}</span>
                  </div>
                ))
              )}
              <div ref={logsEndRef} />
            </div>
          </div>
        </div>

        {/* Pipeline Visualization */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h3 className="text-sm font-semibold text-slate-900 mb-4 uppercase tracking-wider">Fluxo de Trabalho</h3>
          <PipelineVisualizer currentStep={state.step} steps={steps} error={error || undefined} />
        </div>

        {/* Results Section */}
        <AnimatePresence mode="wait">
          {state.generatedImage && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8"
            >
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Image Display */}
                <div className="lg:col-span-2 bg-white p-2 rounded-xl shadow-md border border-slate-200">
                  <div className="relative aspect-[4/3] bg-slate-100 rounded-lg overflow-hidden flex items-center justify-center group">
                    <img 
                      src={state.generatedImage} 
                      alt="Generated Illustration" 
                      className="w-full h-full object-contain"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors pointer-events-none" />
                    <a 
                      href={state.generatedImage} 
                      download={`academic-illustration-v${state.iteration}.png`}
                      className="absolute bottom-4 right-4 bg-white/90 hover:bg-white text-slate-900 p-2 rounded-lg shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Download Image"
                    >
                      <ImageIcon className="w-5 h-5" />
                    </a>
                  </div>
                </div>

                {/* Details & Critique */}
                <div className="space-y-6">
                  {/* Plan Summary */}
                  <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h4 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-500" />
                      Plano Visual
                    </h4>
                    <div className="text-sm text-slate-600 max-h-40 overflow-y-auto">
                      <ReactMarkdown>{state.plan}</ReactMarkdown>
                    </div>
                  </div>

                  {/* Critique */}
                  {state.critique && (
                    <div className="bg-amber-50 p-6 rounded-xl shadow-sm border border-amber-100">
                      <h4 className="font-semibold text-amber-900 mb-2 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                        Crítica da IA
                      </h4>
                      <p className="text-sm text-amber-800 italic">
                        "{state.critique}"
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* History Gallery */}
              {state.history.length > 0 && (
                <div 
                  ref={historyRef}
                  className="bg-white p-6 rounded-xl shadow-sm border border-slate-200"
                >
                  <h3 className="text-sm font-semibold text-slate-900 mb-4 uppercase tracking-wider">Histórico de Iterações</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {state.history.map((item, idx) => (
                      <div 
                        key={idx} 
                        className={cn(
                          "relative group cursor-pointer border-2 rounded-lg overflow-hidden transition-all",
                          state.generatedImage === item.image ? "border-indigo-500 ring-2 ring-indigo-200" : "border-transparent hover:border-slate-300"
                        )}
                        onClick={() => setState(prev => ({ ...prev, generatedImage: item.image, critique: item.critique || null }))}
                      >
                        <img src={item.image} alt={`Iteration ${item.iteration}`} className="w-full h-32 object-cover" />
                        <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded-md backdrop-blur-sm">
                          v{item.iteration}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
        <SettingsModal 
          isOpen={isSettingsOpen} 
          onClose={() => setIsSettingsOpen(false)}
          onClearLogs={handleClearLogs}
          onResetApp={handleReset}
        />
      </div>
    </Layout>
  );
}
