import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import Header from '../components/Header';
import CardOS from '../components/CardOS';
import ModalDetalhesOS from '../components/ModalDetalhesOS';
import { Database, CheckCircle2, Clock } from 'lucide-react';

export default function HomeTecnico() {
  const [abaAtiva, setAbaAtiva] = useState('PENDENTES'); // 'PENDENTES' | 'CONCLUIDAS'
  const [osSelecionada, setOsSelecionada] = useState(null);

  // Lê direto do Dexie (IndexedDB) ordenado por ordem_importacao.
  // useLiveQuery é reativo ao banco local — não dispara fetch de rede
  // e não recarrega ao trocar de aba / voltar do WhatsApp / Maps.
  const ordens = useLiveQuery(async () => {
    return await db.ordens_servico.orderBy('ordem_importacao').toArray();
  }, []);

  const ordensFiltradas = (ordens || []).filter((os) => {
    if (abaAtiva === 'PENDENTES') {
      return !os.status || os.status === 'PENDENTE';
    }
    return os.status === 'CONCLUIDA' || os.status === 'IMPRODUTIVA';
  });

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center">
      <div className="w-full max-w-md p-4 space-y-4">
        {/* Header com Status Online/Offline e Sincronização */}
        <Header />

        {/* Abas de Navegação */}
        <nav className="grid grid-cols-2 p-1 bg-slate-200 rounded-xl text-sm font-semibold text-slate-600">
          <button
            type="button"
            onClick={() => setAbaAtiva('PENDENTES')}
            className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              abaAtiva === 'PENDENTES'
                ? 'bg-white text-brand shadow-sm font-bold'
                : 'hover:text-slate-900'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Pendentes</span>
          </button>
          <button
            type="button"
            onClick={() => setAbaAtiva('CONCLUIDAS')}
            className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              abaAtiva === 'CONCLUIDAS'
                ? 'bg-white text-brand shadow-sm font-bold'
                : 'hover:text-slate-900'
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Concluídas</span>
          </button>
        </nav>

        {/* Lista de Ordens de Serviço */}
        <main className="space-y-3">
          {ordens === undefined ? (
            <div className="text-center py-12 text-sm text-slate-500">
              Carregando dados locais...
            </div>
          ) : ordensFiltradas.length === 0 ? (
            <div className="text-center py-12 px-4 bg-white rounded-xl border border-dashed border-slate-300">
              <Database className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700">
                Nenhuma ordem {abaAtiva.toLowerCase()} encontrada
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {abaAtiva === 'PENDENTES' 
                  ? 'Use o botão "Baixar Tarefas" acima para sincronizar novas O.S. da nuvem.'
                  : 'Nenhuma ordem foi finalizada ainda hoje.'}
              </p>
            </div>
          ) : (
            ordensFiltradas.map((os) => (
              <CardOS
                key={os.id || os.numero_os}
                os={os}
                onClick={() => setOsSelecionada(os)}
              />
            ))
          )}
        </main>
      </div>

      {/* Modal de Detalhes da OS */}
      {osSelecionada && (
        <ModalDetalhesOS
          os={osSelecionada}
          onClose={() => setOsSelecionada(null)}
        />
      )}
    </div>
  );
}
