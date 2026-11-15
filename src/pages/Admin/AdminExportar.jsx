import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../supabase';
import { db } from '../../db/db';
import * as XLSX from 'xlsx';
import {
  FileDown,
  Filter,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Package,
  ShieldAlert,
  TrendingUp,
  Download,
  Users,
  RefreshCw,
} from 'lucide-react';

// ─── Helpers ────────────────────────────────────────────────────────────────

function getTodayISO() {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Sao_Paulo' });
}

function getFirstDayOfMonthISO() {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function simNao(val) {
  return val ? 'Sim' : 'Não';
}

function formatDateBR(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

// ─── CSV download ────────────────────────────────────────────────────────────

function downloadCSV(rows, filename) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [headers.map(escape).join(','), ...rows.map((r) => headers.map((h) => escape(r[h])).join(','))];
  const csvContent = '\uFEFF' + lines.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── XLSX download ───────────────────────────────────────────────────────────

function downloadXLSX(rows, filename) {
  if (!rows.length) return;
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Relatório');
  XLSX.writeFile(wb, filename);
}

// ─── Row builder ─────────────────────────────────────────────────────────────

function buildRows(osList) {
  const rows = [];
  for (const os of osList) {
    // Filtro para ignorar equipamentos extras no relatório
    const equipamentosValidos = (os.equipamentos ?? []).filter(
      (eq) => eq.mac_esperado !== 'EXTRA' && !eq.is_extra
    );

    const obsRetirada = os.status === 'IMPRODUTIVA'
      ? [os.motivo_improdutiva, os.observacao_tecnico].filter(Boolean).join(' - ')
      : (os.observacao_tecnico ?? '');

    const formatStatusRetirada = (foiRecolhido) => {
      if (os.status === 'IMPRODUTIVA') return 'Improdutiva';
      if (os.status === 'CONCLUIDA') {
        return foiRecolhido === false ? 'Não Recolhido' : 'Concluída';
      }
      return os.status || 'Pendente';
    };

    const base = {
      'DIA': formatDateBR(os.data_agendada),
      'TURNO': os.turno ?? '',
      'HORARIO_MARCADO': os.horario_marcado ?? '',
      'NUMERO_OS': os.numero_os ?? '',
      'NOME_CLIENTE': os.cliente_nome ?? '',
      'CONTATO_1': os.telefone_1 ?? '',
      'CONTATO_2': os.telefone_2 ?? '',
      'ENDERECO': os.endereco ?? '',
      'MAPS_LINK': os.link_maps ?? '',
      'BAIRRO': os.bairro ?? '',
      'CIDADE': os.cidade ?? '',
      'OBSERVACAO_DO_CLIENTE': os.observacao_cliente ?? '',
      'OBSERVACAO_DA_RETIRADA': obsRetirada,
    };

    if (equipamentosValidos.length === 0) {
      rows.push({
        'DIA': base.DIA,
        'TURNO': base.TURNO,
        'HORARIO_MARCADO': base.HORARIO_MARCADO,
        'NUMERO_OS': base.NUMERO_OS,
        'NOME_CLIENTE': base.NOME_CLIENTE,
        'CONTATO_1': base.CONTATO_1,
        'CONTATO_2': base.CONTATO_2,
        'ENDERECO': base.ENDERECO,
        'MAPS_LINK': base.MAPS_LINK,
        'BAIRRO': base.BAIRRO,
        'CIDADE': base.CIDADE,
        'MAC_APARELHO': 'Sem equipamento registrado',
        'OBSERVACAO_DO_CLIENTE': base.OBSERVACAO_DO_CLIENTE,
        'STATUS_DA_RETIRADA': formatStatusRetirada(null),
        'OBSERVACAO_DA_RETIRADA': base.OBSERVACAO_DA_RETIRADA,
      });
    } else {
      for (const eq of equipamentosValidos) {
        rows.push({
          'DIA': base.DIA,
          'TURNO': base.TURNO,
          'HORARIO_MARCADO': base.HORARIO_MARCADO,
          'NUMERO_OS': base.NUMERO_OS,
          'NOME_CLIENTE': base.NOME_CLIENTE,
          'CONTATO_1': base.CONTATO_1,
          'CONTATO_2': base.CONTATO_2,
          'ENDERECO': base.ENDERECO,
          'MAPS_LINK': base.MAPS_LINK,
          'BAIRRO': base.BAIRRO,
          'CIDADE': base.CIDADE,
          'MAC_APARELHO': eq.mac_esperado ?? '',
          'OBSERVACAO_DO_CLIENTE': base.OBSERVACAO_DO_CLIENTE,
          'STATUS_DA_RETIRADA': formatStatusRetirada(eq.foi_recolhido),
          'OBSERVACAO_DA_RETIRADA': base.OBSERVACAO_DA_RETIRADA,
        });
      }
    }
  }
  return rows;
}

// ─── Metrics ─────────────────────────────────────────────────────────────────

function computeMetricas(osList) {
  const total = osList.length;
  const concluidas = osList.filter((o) => o.status === 'CONCLUIDA').length;
  const taxaSucesso = total > 0 ? ((concluidas / total) * 100).toFixed(1) : '0.0';
  const totalEquipValidos = osList.flatMap((o) =>
    (o.equipamentos ?? []).filter((eq) => eq.mac_esperado !== 'EXTRA' && !eq.is_extra)
  );
  const macsRecolhidos = totalEquipValidos.filter((e) => e.foi_recolhido).length;
  const osVerificacao = osList.filter((o) => o.requer_verificacao).length;
  return { total, concluidas, taxaSucesso, macsRecolhidos, osVerificacao };
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function AdminExportar() {
  const [tecnicos, setTecnicos] = useState([]);
  const [tecnicoFiltro, setTecnicoFiltro] = useState('');
  const [dataInicio, setDataInicio] = useState(getFirstDayOfMonthISO());
  const [dataFim, setDataFim] = useState(getTodayISO());
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [osList, setOsList] = useState(null); // null = ainda não gerou
  const [metricas, setMetricas] = useState(null);

  // Carrega lista de técnicos
  useEffect(() => {
    supabase
      .from('usuarios')
      .select('id, nome')
      .eq('role', 'TECNICO')
      .eq('ativo', true)
      .order('nome')
      .then(({ data, error }) => {
        if (!error && data) setTecnicos(data);
      });
  }, []);

  const handleGerarRelatorio = useCallback(async () => {
    if (!dataInicio || !dataFim) {
      setErro('Informe o período de datas.');
      return;
    }
    setCarregando(true);
    setErro('');
    setOsList(null);
    setMetricas(null);
    try {
      let lista = [];
      try {
        let query = supabase
          .from('ordens_servico')
          .select('*, equipamentos(*), tecnico:tecnico_id(nome)')
          .gte('data_agendada', dataInicio)
          .lte('data_agendada', dataFim)
          .order('data_agendada', { ascending: true })
          .order('numero_os', { ascending: true });

        if (tecnicoFiltro) {
          query = query.eq('tecnico_id', tecnicoFiltro);
        }

        const { data, error: err } = await query;
        if (err) throw err;
        lista = data ?? [];
      } catch (errSupabase) {
        console.warn('Falha na consulta Supabase, buscando dados locais no Dexie:', errSupabase);
        const ordensLocais = await db.ordens_servico
          .where('data_agendada')
          .between(dataInicio, dataFim, true, true)
          .toArray();

        const todosEquipamentos = await db.equipamentos.toArray();
        lista = ordensLocais
          .filter((o) => !tecnicoFiltro || o.tecnico_id === tecnicoFiltro)
          .map((o) => ({
            ...o,
            equipamentos: todosEquipamentos.filter((e) => e.os_id === o.id),
          }));
      }

      setOsList(lista);
      setMetricas(computeMetricas(lista));
    } catch (e) {
      console.error('Erro ao gerar relatório:', e);
      setErro(`Falha ao buscar dados: ${e.message}`);
    } finally {
      setCarregando(false);
    }
  }, [dataInicio, dataFim, tecnicoFiltro]);

  // Carregamento reativo ao alterar filtros
  useEffect(() => {
    handleGerarRelatorio();
  }, [handleGerarRelatorio]);

  const rows = osList ? buildRows(osList, tecnicos) : [];
  const nomeArquivo = `sinuelo_${dataInicio}_${dataFim}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl shadow-xs border border-slate-200">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl bg-brand/10 text-brand flex items-center justify-center">
            <FileDown className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900">Exportar Relatório de Retiradas</h2>
            <p className="text-xs text-slate-500 font-medium">
              Gere o relatório desagrupado por MAC com filtros de período e técnico.
            </p>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white p-6 rounded-2xl shadow-xs border border-slate-200">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-4 h-4 text-brand" />
          <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Filtros do Relatório</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Data Início */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Data Inicial</label>
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-300 text-sm font-semibold text-slate-800 bg-white shadow-xs focus:outline-none focus:ring-2 focus:ring-brand/30 transition-all"
            />
          </div>

          {/* Data Fim */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Data Final</label>
            <input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-300 text-sm font-semibold text-slate-800 bg-white shadow-xs focus:outline-none focus:ring-2 focus:ring-brand/30 transition-all"
            />
          </div>

          {/* Técnico */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <Users className="w-3 h-3" /> Técnico
            </label>
            <select
              value={tecnicoFiltro}
              onChange={(e) => setTecnicoFiltro(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-300 text-sm font-semibold text-slate-800 bg-white shadow-xs focus:outline-none focus:ring-2 focus:ring-brand/30 transition-all"
            >
              <option value="">Todos os Técnicos</option>
              {tecnicos.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
            </select>
          </div>

          {/* Botão Gerar */}
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider opacity-0 select-none">
              Ação
            </label>
            <button
              type="button"
              onClick={handleGerarRelatorio}
              disabled={carregando}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-brand hover:bg-brand-dark text-white text-sm font-bold shadow-xs hover:shadow-md transition-all disabled:opacity-50 cursor-pointer h-[42px]"
            >
              {carregando ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Carregando...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  <span>Gerar Relatório</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Erro */}
      {erro && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-semibold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{erro}</span>
        </div>
      )}

      {/* Métricas */}
      {metricas && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Total OS */}
          <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200">
            <div className="flex items-start justify-between mb-3">
              <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Total O.S.</span>
            </div>
            <p className="text-3xl font-black text-brand-dark">{metricas.total}</p>
            <p className="text-xs text-slate-500 mt-1">no período filtrado</p>
          </div>

          {/* Taxa Sucesso */}
          <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200">
            <div className="flex items-start justify-between mb-3">
              <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Taxa Sucesso</span>
            </div>
            <p className="text-3xl font-black text-emerald-700">{metricas.taxaSucesso}%</p>
            <p className="text-xs text-slate-500 mt-1">{metricas.concluidas} concluídas</p>
          </div>

          {/* MACs Recolhidos */}
          <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200">
            <div className="flex items-start justify-between mb-3">
              <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">MACs Recolhidos</span>
            </div>
            <p className="text-3xl font-black text-teal-700">{metricas.macsRecolhidos}</p>
            <p className="text-xs text-slate-500 mt-1">equipamentos com foi_recolhido = true</p>
          </div>

          {/* Requer Verificação */}
          <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200">
            <div className="flex items-start justify-between mb-3">
              <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Auditoria</span>
            </div>
            <p className="text-3xl font-black text-amber-700">{metricas.osVerificacao}</p>
            <p className="text-xs text-slate-500 mt-1">O.S. requerem verificação</p>
          </div>
        </div>
      )}

      {/* Resultado + Botões Download */}
      {osList !== null && (
        <div className="bg-white p-6 rounded-2xl shadow-xs border border-slate-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-5">
            <div>
              <h3 className="text-base font-black text-slate-800">
                {rows.length > 0 ? `${rows.length} linha(s) prontas para exportar` : 'Nenhum dado encontrado'}
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Período: {formatDateBR(dataInicio)} → {formatDateBR(dataFim)}
                {tecnicoFiltro ? ` · ${tecnicos.find((t) => t.id === tecnicoFiltro)?.nome ?? ''}` : ' · Todos os Técnicos'}
              </p>
            </div>

            {rows.length > 0 && (
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => downloadCSV(rows, `${nomeArquivo}.csv`)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-brand text-brand hover:bg-brand hover:text-white text-sm font-bold transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  Baixar CSV
                </button>
                <button
                  type="button"
                  onClick={() => downloadXLSX(rows, `${nomeArquivo}.xlsx`)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  Baixar XLSX
                </button>
              </div>
            )}
          </div>

          {/* Preview tabela (primeiras 10 linhas) */}
          {rows.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    {Object.keys(rows[0]).map((h) => (
                      <th key={h} className="px-3 py-2.5 font-bold text-slate-600 whitespace-nowrap">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 15).map((row, i) => (
                    <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                      {Object.values(row).map((val, j) => (
                        <td key={j} className="px-3 py-2 text-slate-700 whitespace-nowrap max-w-[200px] truncate">
                          {String(val ?? '')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length > 15 && (
                <div className="px-4 py-2.5 text-xs text-slate-500 bg-slate-50 border-t border-slate-200 font-medium">
                  Exibindo as primeiras 15 de {rows.length} linhas. O arquivo exportado conterá todas.
                </div>
              )}
            </div>
          )}

          {rows.length === 0 && (
            <div className="py-12 text-center text-slate-400">
              <Package className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm font-semibold">Nenhuma O.S. encontrada para os filtros selecionados.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

