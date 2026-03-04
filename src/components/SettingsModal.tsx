import React from 'react';
import { X, Trash2, RotateCcw, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onClearLogs: () => void;
  onResetApp: () => void;
}

export function SettingsModal({ isOpen, onClose, onClearLogs, onResetApp }: SettingsModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden"
          >
            <div className="flex items-center justify-between p-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900">Configurações</h2>
              <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-6">
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider">Dados da Sessão</h3>
                
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white rounded-md shadow-sm text-slate-600">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">Limpar Logs</p>
                      <p className="text-xs text-slate-500">Remove o histórico do terminal</p>
                    </div>
                  </div>
                  <button 
                    onClick={onClearLogs}
                    className="text-xs font-medium text-slate-600 hover:text-red-600 px-3 py-1.5 bg-white border border-slate-200 rounded-md hover:border-red-200 transition-colors"
                  >
                    Limpar
                  </button>
                </div>

                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-white rounded-md shadow-sm text-slate-600">
                      <RotateCcw className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-900">Reiniciar App</p>
                      <p className="text-xs text-slate-500">Volta ao estado inicial</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      onResetApp();
                      onClose();
                    }}
                    className="text-xs font-medium text-red-600 hover:text-white px-3 py-1.5 bg-red-50 border border-red-200 rounded-md hover:bg-red-600 transition-colors"
                  >
                    Reiniciar
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-medium text-slate-500 uppercase tracking-wider">Sobre</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  PaperBanana Free v1.0.0
                  <br />
                  Desenvolvido com Gemini 2.5 Flash & Pro.
                  <br />
                  Modo Gratuito Ativado.
                </p>
              </div>
            </div>
            
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button 
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
              >
                Fechar
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
