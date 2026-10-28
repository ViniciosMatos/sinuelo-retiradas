import React, { useState } from 'react';
import { db } from '../db/db';
import { 
  Clock, 
  MapPin, 
  User, 
  ChevronRight, 
  Hash, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  RotateCcw,
  Cloud
} from 'lucide-react';

export default function CardOS({ os, onClick }) {
  const [contatosAbertos, setContatosAbertos] = useState(false);
  if (!os) return null;

  const temHorarioMarcado = Boolean(os.horario_marcado && os.horario_marcado.trim() !== '');
  const obsCliente = os.observacao_cliente || os.obs_cliente;
  const temObservacao = Boolean(obsCliente && obsCliente.trim() !== '');
  const isPendente = !os.status || os.status === 'PENDENTE';
  const isSincronizado = Boolean(os.sincronizado);

  // Passo 2: Desfazer conclusão (apenas para tarefas ainda não sincronizadas)
  const handleDesfazer = async (e) => {
    e.stopPropagation();
    try {
      await db.ordens_servico.update(os.id, {
        status: 'PENDENTE',
        fotos_recolhimento: null,
        fotos: null,
        fotos_urls: null,
        requer_verificacao: null,
        motivo_improdutiva: null,
        observacao_tecnico: null,
        data_finalizacao: null,
        sincronizado: false,
        sync_status: null,
      });

      // Reverte status de equipamentos previstos
      const os_id = os.id;
      let previstos = await db.equipamentos.where({ os_id }).toArray();
      if ((!previstos || previstos.length === 0) && typeof os_id === 'string' && !isNaN(Number(os_id))) {
        previstos = await db.equipamentos.where({ os_id: Number(os_id) }).toArray();
      }
      for (const eq of (previstos || [])) {
        await db.equipamentos.update(eq.id, { foi_recolhido: false, recolhido: false });
      }
    } catch (err) {
      console.error('Erro ao desfazer O.S.:', err);
    }
  };

  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      }}
      className={`relative w-full overflow-hidden rounded-xl bg-white shadow-md border border-slate-200 transition-all flex text-left ${
        isSincronizado ? 'opacity-90 cursor-pointer' : 'active:scale-[0.99] cursor-pointer'
      }`}
    >
      {/* Tarja lateral destacada se houver horário marcado */}
      {temHorarioMarcado && (
        <div 
          className="w-2.5 bg-action-alert flex-shrink-0" 
          aria-hidden="true" 
        />
      )}

      <div className="flex-1 p-4 flex flex-col gap-2.5">
        {/* Badge NOVA */}
        {os.is_nova && (
          <div className="self-start inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-400 text-emerald-950 border border-emerald-500 tracking-wide">
            <span>✦ NOVA</span>
          </div>
        )}

        {/* Cabeçalho do Card: OS, Turno e Badge de Horário */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-1 text-xs font-semibold text-brand bg-slate-100 px-2.5 py-1 rounded-md">
            <Hash className="w-3.5 h-3.5" />
            <span>{os.numero_os}</span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {temHorarioMarcado && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-950 border border-action-alert">
                <Clock className="w-3.5 h-3.5 text-action-alert" />
                <span>{os.horario_marcado}</span>
              </span>
            )}

            {os.turno && (
              <span className="text-xs font-medium px-2 py-0.5 rounded bg-slate-200 text-slate-700 uppercase">
                {os.turno}
              </span>
            )}
          </div>
        </div>

        {/* Nome do Cliente */}
        <div className="flex items-start gap-2">
          <User className="w-5 h-5 text-brand mt-0.5 flex-shrink-0" />
          <h3 className="font-bold text-base text-brand-dark leading-snug break-words">
            {os.cliente_nome || 'Cliente não informado'}
          </h3>
        </div>

        {/* Endereço */}
        <div className="flex items-start gap-2 text-sm text-slate-600">
          <MapPin className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
          <p className="line-clamp-2 leading-relaxed">
            {os.endereco || 'Endereço não informado'}
            {os.bairro ? ` - ${os.bairro}` : ''}
            {os.cidade ? `, ${os.cidade}` : ''}
          </p>
        </div>        

        {/* Selo de Alerta de Observação do Cliente no Card Fechado */}
        {temObservacao && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 text-amber-900 border border-amber-200 text-xs font-semibold">
            <AlertTriangle className="w-3.5 h-3.5 text-action-alert flex-shrink-0" />
            <span className="truncate">⚠️ Contém Observação</span>
          </div>
        )}

        {/* Passo 2: Rodapé do Card - Diferenciação Pendente vs Concluída / Congelada */}
        <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          {isPendente ? (
            // Card Pendente: status e ação de detalhes
            <div className="flex items-center justify-between w-full">
              <span className="font-semibold text-slate-500 uppercase">
                Pendente
              </span>
              <div className="flex items-center gap-1 text-brand font-semibold">
                <span>Ver detalhes</span>
                <ChevronRight className="w-4 h-4" />
              </div>
            </div>
          ) : (
            // Card Concluído / Improdutivo: Oculta botões de finalizar e exibe selo visual
            <div className="flex items-center justify-between w-full gap-2 flex-wrap">
              {/* Selo do Resultado */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {os.status === 'CONCLUIDA' ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Concluída</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold bg-red-100 text-red-800 border border-red-300">
                    <XCircle className="w-3.5 h-3.5 text-red-600" />
                    <span>Improdutiva</span>
                  </span>
                )}

                {/* Selo 'Enviado para a nuvem' se sincronizado === true */}
                {isSincronizado ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                    <Cloud className="w-3 h-3 text-blue-600" />
                    <span>Enviado para a nuvem</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                    Pendente Sync
                  </span>
                )}
              </div>

              {/* Botões do card não-pendente */}
              <div className="flex items-center gap-2">
                {/* Botão Desfazer se NÃO estiver sincronizado */}
                {!isSincronizado && (
                  <button
                    type="button"
                    onClick={handleDesfazer}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-lg shadow-xs active:scale-95 transition-all cursor-pointer"
                    title="Desfazer e retornar para Pendentes"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-amber-700" />
                    <span>Desfazer</span>
                  </button>
                )}

                <div className="flex items-center gap-0.5 text-slate-500 font-medium">
                  <span className="text-[11px]">Ver</span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
