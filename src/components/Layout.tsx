import React from "react";
import { cn } from "@/lib/utils";

interface LayoutProps {
  children: React.ReactNode;
  className?: string;
  onNewProject?: () => void;
  onHistoryClick?: () => void;
  onSettingsClick?: () => void;
}

export function Layout({ children, className, onNewProject, onHistoryClick, onSettingsClick }: LayoutProps) {
  return (
    <div className={cn("min-h-screen bg-slate-50 text-slate-900 font-sans", className)}>
      <header className="border-b border-slate-200 bg-white px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">
            PB
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">
            PaperBanana <span className="text-slate-400 font-normal text-sm ml-2">Ilustrador Acadêmico</span>
          </h1>
        </div>
        <nav className="flex gap-4 text-sm font-medium text-slate-600">
          <button onClick={onNewProject} className="hover:text-indigo-600 transition-colors">Novo Projeto</button>
          <button onClick={onHistoryClick} className="hover:text-indigo-600 transition-colors">Histórico</button>
          <button onClick={onSettingsClick} className="hover:text-indigo-600 transition-colors">Configurações</button>
        </nav>
      </header>
      <main className="max-w-7xl mx-auto p-6">
        {children}
      </main>
    </div>
  );
}
