import React, { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { baixarCargaDoDia, sincronizarConcluidas } from '../services/syncService';
import { 
  CloudDownload, 
  CloudUpload, 
  Wifi, 
  WifiOff, 
  Loader2, 
  LogOut, 
  CheckCircle2,
  AlertTriangle,
  X
} from 'lucide-react';

export default function Header() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [baixando, setBaixando] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);
  const [feedback, setFeedback] = useState(null); // { tipo: 'sucesso' | 'erro' | 'info', texto: '' }

  // Monitora conectividade de rede com window.addEventListener
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      mostrarFeedback('Conexão restabelecida. Você está online.', 'info');
    };

    const handleOffline = () => {
      setIsOnline(false);
      mostrarFeedback('Conexão perdida. Modo offline ativado.', 'erro');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const mostrarFeedback = (texto, tipo = 'info') => {
    setFeedback({ texto, tipo });
    setTimeout(() => {
      setFeedback((prev) => (prev?.texto === texto ? null : prev));
    }, 4500);
  };

  const handleBaixarTarefas = async () => {
    if (!navigator.onLine) {
      mostrarFeedback('Sem internet. Não é possível baixar tarefas offline.', 'erro');
      return;
    }

    try {
      setBaixando(true);
      const resultado = await baixarCargaDoDia();
      if (resultado.total === 0) {
        mostrarFeedback('Nenhuma nova O.S. pendente no Supabase.', 'info');
      } else {
        mostrarFeedback(`${resultado.total} tarefa(s) baixada(s) com sucesso!`, 'sucesso');
      }
    } catch (err) {
      console.error('Erro ao baixar tarefas:', err);
      mostrarFeedback(err.message || 'Erro ao conectar ao Supabase.', 'erro');
    } finally {
      setBaixando(false);
    }
  };

  const handleSincronizarConcluidas = async () => {
    if (!navigator.onLine) {
      mostrarFeedback('Sem internet. Não é possível sincronizar offline.', 'erro');
      return;
    }

    try {
      setSincronizando(true);
      const resultado = await sincronizarConcluidas();
      if (resultado.total === 0) {
        mostrarFeedback('Todas as tarefas já estão sincronizadas.', 'info');
      } else {
        mostrarFeedback(`${resultado.total} tarefa(s) sincronizada(s) com sucesso na nuvem!`, 'sucesso');
      }
    } catch (err) {
      console.error('Erro na sincronização:', err);
      mostrarFeedback(err.message || 'Falha ao sincronizar com Supabase.', 'erro');
    } finally {
      setSincronizando(false);
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('Erro ao encerrar sessão:', err);
    }
  };

  return (
    <header className="space-y-3 pt-2 pb-2 border-b border-slate-200">
      {/* Toast / Alerta Flutuante */}
      {feedback && (
        <div
          className={`flex items-center justify-between gap-2 p-3 rounded-xl text-xs font-semibold shadow-md transition-all animate-in fade-in slide-in-from-top-2 ${
            feedback.tipo === 'sucesso'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
              : feedback.tipo === 'erro'
              ? 'bg-red-50 text-red-800 border border-red-300'
              : 'bg-blue-50 text-blue-800 border border-blue-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.tipo === 'sucesso' && <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />}
            {feedback.tipo === 'erro' && <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />}
            {feedback.tipo === 'info' && <Wifi className="w-4 h-4 text-blue-600 flex-shrink-0" />}
            <span>{feedback.texto}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="p-1 rounded hover:bg-black/5"
          >
            <X className="w-3.5 h-3.5 opacity-70" />
          </button>
        </div>
      )}

      {/* Linha 1: Título do App e Ações do Usuário */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black text-brand-dark tracking-tight">
            Agenda de Retiradas
          </h1>
          <p className="text-xs text-brand-gray font-medium">
            Operação de Campo - Sinuelo
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleLogout}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-lg shadow-xs hover:bg-red-50 hover:text-red-700 hover:border-red-200 active:scale-95 transition-all cursor-pointer"
            title="Sair do aplicativo"
          >
            <LogOut className="w-3.5 h-3.5 text-slate-500" />
            <span>Sair</span>
          </button>
        </div>
      </div>

      {/* Linha 2: Indicador de Rede e Botões de Sincronização */}
      <div className="flex items-center justify-between gap-2 p-2 bg-white rounded-xl border border-slate-200 shadow-xs">
        {/* Indicador Visual Online/Offline */}
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-50 border border-slate-200">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'
            }`}
            aria-hidden="true"
          />
          <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
            {isOnline ? 'Online' : 'Offline'}
          </span>
        </div>

        {/* Botões de Ação de Sincronização */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleBaixarTarefas}
            disabled={baixando}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
            title="Baixar O.S. pendentes do Supabase para o dispositivo"
          >
            {baixando ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <CloudDownload className="w-3.5 h-3.5" />
            )}
            <span>{baixando ? 'Baixando...' : 'Baixar Tarefas'}</span>
          </button>

          <button
            type="button"
            onClick={handleSincronizarConcluidas}
            disabled={sincronizando}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
            title="Enviar tarefas concluídas e fotos para o Supabase"
          >
            {sincronizando ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <CloudUpload className="w-3.5 h-3.5" />
            )}
            <span>{sincronizando ? 'Sincronizando...' : 'Sincronizar Concluídas'}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
