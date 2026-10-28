import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../supabase';
import ImportarPlanilha from './ImportarPlanilha';
import AdminAgenda from './AdminAgenda';
import { 
  getTodayBR, 
  getCurrentMonthBR, 
  getMonthRangeBR, 
  formatDateBR, 
  formatMonthNameBR 
} from '../../utils/dateUtils';
import { 
  LayoutDashboard, 
  FileSpreadsheet, 
  FileDown, 
  LogOut, 
  Menu, 
  X, 
  Layers, 
  Users,
  CheckCircle2,
  Clock,
  AlertTriangle,
  CalendarDays,
  RefreshCw,
  TrendingUp,
  Percent,
  Calendar,
  Target,
  ArrowRight,
  Loader2,
  Activity
} from 'lucide-react';

export default function AdminDashboard({ session, paginaInicial = 'PAINEL_GERAL' }) {
  const [paginaAtiva, setPaginaAtiva] = useState(paginaInicial); // 'PAINEL_GERAL' | 'AGENDA' | 'IMPORTAR' | 'EXPORTAR'
  const [sidebarAberta, setSidebarAberta] = useState(false);

  // Filtros do Painel
  const [dataSelecionada, setDataSelecionada] = useState(getTodayBR());
  const [mesAnoSelecionado, setMesAnoSelecionado] = useState(getCurrentMonthBR());
  const [carregandoMetricas, setCarregandoMetricas] = useState(false);
  const [erroMetricas, setErroMetricas] = useState('');
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState(null);

  // Indicadores de Performance (Diário e Mensal)
  const [metricas, setMetricas] = useState({
    produtivasDia: 0,
    pendentesDia: 0,
    improdutivasDia: 0,
    totalDia: 0,
    taxaProdutividadeDia: '0.0',
    produtivasMes: 0,
    pendentesMes: 0,
    improdutivasMes: 0,
    totalMes: 0,
    taxaProdutividadeMes: '0.0',
    tecnicosAtivos: 0,
  });

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('Erro ao encerrar sessão:', err);
    }
  };

  // Busca e cálculo dinâmico de métricas no Supabase
  const carregarMetricas = useCallback(async () => {
    setCarregandoMetricas(true);
    setErroMetricas('');
    try {
      const { primeiroDia, ultimoDia } = getMonthRangeBR(mesAnoSelecionado);

      // 1. Busca O.S. da Data Selecionada (Diário)
      const { data: osDia, error: erroDia } = await supabase
        .from('ordens_servico')
        .select('id, status, data_agendada')
        .eq('data_agendada', dataSelecionada);

      if (erroDia) throw erroDia;

      // 2. Busca O.S. do Mês Selecionado (Mensal)
      const { data: osMes, error: erroMes } = await supabase
        .from('ordens_servico')
        .select('id, status, data_agendada')
        .gte('data_agendada', primeiroDia)
        .lte('data_agendada', ultimoDia);

      if (erroMes) throw erroMes;

      // 3. Contagem de Técnicos Ativos
      let countTecnicos = 0;
      try {
        const { count, error: erroTecnicos } = await supabase
          .from('usuarios')
          .select('id', { count: 'exact', head: true })
          .or('role.eq.TECNICO,perfil.eq.TECNICO');
        if (!erroTecnicos && count !== null) {
          countTecnicos = count;
        }
      } catch (e) {
        console.warn('Aviso ao consultar técnicos ativos:', e);
      }

      // Cálculos do Dia
      const listaDia = osDia || [];
      const totalDia = listaDia.length;
      const produtivasDia = listaDia.filter((o) => o.status === 'CONCLUIDA').length;
      const pendentesDia = listaDia.filter((o) => !o.status || o.status === 'PENDENTE').length;
      const improdutivasDia = listaDia.filter((o) => o.status === 'IMPRODUTIVA').length;
      const taxaDia = totalDia > 0 ? ((produtivasDia / totalDia) * 100).toFixed(1) : '0.0';

      // Cálculos do Mês
      const listaMes = osMes || [];
      const totalMes = listaMes.length;
      const produtivasMes = listaMes.filter((o) => o.status === 'CONCLUIDA').length;
      const pendentesMes = listaMes.filter((o) => !o.status || o.status === 'PENDENTE').length;
      const improdutivasMes = listaMes.filter((o) => o.status === 'IMPRODUTIVA').length;
      const taxaMes = totalMes > 0 ? ((produtivasMes / totalMes) * 100).toFixed(1) : '0.0';

      setMetricas({
        produtivasDia,
        pendentesDia,
        improdutivasDia,
        totalDia,
        taxaProdutividadeDia: taxaDia,
        produtivasMes,
        pendentesMes,
        improdutivasMes,
        totalMes,
        taxaProdutividadeMes: taxaMes,
        tecnicosAtivos: countTecnicos,
      });

      const agora = new Date();
      setUltimaAtualizacao(agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch (err) {
      console.error('Erro ao consultar métricas do Dashboard:', err);
      setErroMetricas('Falha ao sincronizar métricas com o banco.');
    } finally {
      setCarregandoMetricas(false);
    }
  }, [dataSelecionada, mesAnoSelecionado]);

  // Atualização reativa: recalcula sempre que a data ou mês selecionado mudar
  useEffect(() => {
    carregarMetricas();
  }, [carregarMetricas]);

  const navItems = [
    { id: 'PAINEL_GERAL', rotulo: 'Painel Geral', icone: LayoutDashboard },
    { id: 'AGENDA', rotulo: 'Agenda Geral', icone: CalendarDays },
    { id: 'IMPORTAR', rotulo: 'Importar Planilha', icone: FileSpreadsheet },
    { id: 'EXPORTAR', rotulo: 'Exportar Relatório', icone: FileDown },
  ];

  const rangeMes = getMonthRangeBR(mesAnoSelecionado);
  const isHoje = dataSelecionada === getTodayBR();

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col md:flex-row">
      {/* Barra Superior Mobile (Hamburger) */}
      <header className="md:hidden bg-gray-900 text-white px-4 py-3 flex items-center justify-between border-b border-gray-800 sticky top-0 z-40">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-brand flex items-center justify-center text-white">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-sm tracking-tight leading-none">Sinuelo</h1>
            <span className="text-[10px] text-gray-400 font-medium">Painel Administrativo</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setSidebarAberta(!sidebarAberta)}
          className="p-1.5 rounded-lg text-gray-300 hover:text-white hover:bg-gray-800 transition-colors"
          aria-label="Abrir menu lateral"
        >
          {sidebarAberta ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </header>

      {/* Overlay Mobile */}
      {sidebarAberta && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 md:hidden animate-in fade-in"
          onClick={() => setSidebarAberta(false)}
        />
      )}

      {/* Sidebar Lateral */}
      <aside
        className={`fixed md:sticky top-0 left-0 bottom-0 z-50 w-64 bg-gray-900 text-white flex flex-col justify-between transition-transform duration-200 ease-in-out md:translate-x-0 ${
          sidebarAberta ? 'translate-x-0' : '-translate-x-full'
        } h-screen shadow-xl md:shadow-none flex-shrink-0`}
      >
        <div className="p-5 flex flex-col gap-6">
          {/* Logo / Marca */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand flex items-center justify-center text-white shadow-md">
                <Layers className="w-6 h-6" />
              </div>
              <div>
                <h2 className="font-black text-lg tracking-tight leading-none text-white">
                  SINUELO
                </h2>
                <p className="text-[11px] text-gray-400 font-semibold tracking-wider uppercase mt-0.5">
                  Painel Admin
                </p>
              </div>
            </div>

            {/* Fechar mobile */}
            <button
              type="button"
              onClick={() => setSidebarAberta(false)}
              className="md:hidden p-1 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Links de Navegação */}
          <nav className="flex flex-col gap-1.5">
            {navItems.map((item) => {
              const Icone = item.icone;
              const ativo = paginaAtiva === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setPaginaAtiva(item.id);
                    setSidebarAberta(false);
                  }}
                  className={`flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-semibold transition-all text-left ${
                    ativo
                      ? 'bg-brand text-white shadow-md'
                      : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                  }`}
                >
                  <Icone className={`w-5 h-5 ${ativo ? 'text-white' : 'text-gray-400'}`} />
                  <span>{item.rotulo}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Rodapé da Sidebar: Info de Conta e Botão Sair */}
        <div className="p-5 border-t border-gray-800 flex flex-col gap-3">
          <div className="text-xs text-gray-400 truncate">
            <p className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Logado como</p>
            <p className="font-medium text-gray-300 truncate">{session?.user?.email || 'Administrador'}</p>
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center justify-center gap-2 w-full py-2.5 px-3 rounded-xl bg-gray-800 hover:bg-red-950/40 text-gray-200 hover:text-red-400 border border-gray-700 hover:border-red-800 text-xs font-bold transition-all cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sair do Painel</span>
          </button>
        </div>
      </aside>

      {/* Conteúdo Principal */}
      <main className="flex-1 bg-gray-100 min-h-screen p-4 sm:p-6 lg:p-8 overflow-y-auto">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header da Página */}
          <div className="bg-white p-6 rounded-2xl shadow-xs border border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-black text-brand-dark tracking-tight">
                Visão Geral da Operação
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 font-medium mt-1">
                Acompanhamento em tempo real das retiradas de equipamentos e equipes de campo.
              </p>
            </div>

            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200 self-start sm:self-auto">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Painel Administrativo Ativo</span>
            </div>
          </div>

          {/* Área de Conteúdo: PAINEL_GERAL */}
          {paginaAtiva === 'PAINEL_GERAL' && (
            <div className="space-y-6">
              {/* Barra de Filtros e Atualização Dinâmica */}
              <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  {/* Seletor de Data Específica */}
                  <div className="flex flex-col gap-1">
                    <label htmlFor="filtro-data-especifica" className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-brand" />
                      Data Específica (Diário)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        id="filtro-data-especifica"
                        type="date"
                        value={dataSelecionada}
                        onChange={(e) => {
                          const val = e.target.value;
                          setDataSelecionada(val);
                          if (val && val.length >= 7) {
                            setMesAnoSelecionado(val.slice(0, 7));
                          }
                        }}
                        className="px-3 py-2 rounded-xl border border-slate-300 text-sm font-semibold text-slate-800 bg-white shadow-xs focus:outline-none focus:ring-2 focus:ring-brand/30 transition-all cursor-pointer"
                      />
                      {!isHoje && (
                        <button
                          type="button"
                          onClick={() => {
                            setDataSelecionada(getTodayBR());
                            setMesAnoSelecionado(getCurrentMonthBR());
                          }}
                          className="px-3 py-2 rounded-xl text-xs font-bold text-brand bg-blue-50 hover:bg-blue-100 border border-brand/20 transition-all cursor-pointer"
                          title="Voltar para a data de hoje"
                        >
                          Hoje
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Separador vertical sutil */}
                  <div className="hidden sm:block h-10 w-px bg-slate-200 self-end mb-1" />

                  {/* Seletor de Mês/Ano */}
                  <div className="flex flex-col gap-1">
                    <label htmlFor="filtro-mes-ano" className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                      <CalendarDays className="w-3.5 h-3.5 text-brand" />
                      Mês/Ano (Mensal)
                    </label>
                    <input
                      id="filtro-mes-ano"
                      type="month"
                      value={mesAnoSelecionado}
                      onChange={(e) => setMesAnoSelecionado(e.target.value)}
                      className="px-3 py-2 rounded-xl border border-slate-300 text-sm font-semibold text-slate-800 bg-white shadow-xs focus:outline-none focus:ring-2 focus:ring-brand/30 transition-all cursor-pointer"
                    />
                  </div>
                </div>

                {/* Ações e Status de Atualização */}
                <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                  {ultimaAtualizacao && (
                    <span className="text-xs text-slate-500 font-medium">
                      Atualizado às <strong className="text-slate-700">{ultimaAtualizacao}</strong>
                    </span>
                  )}

                  <button
                    type="button"
                    onClick={carregarMetricas}
                    disabled={carregandoMetricas}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand hover:bg-brand-dark text-white text-xs font-bold shadow-xs hover:shadow-md transition-all disabled:opacity-50 cursor-pointer"
                  >
                    <RefreshCw className={`w-4 h-4 ${carregandoMetricas ? 'animate-spin' : ''}`} />
                    <span>Atualizar Dados</span>
                  </button>
                </div>
              </div>

              {erroMetricas && (
                <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
                  <span>{erroMetricas}</span>
                </div>
              )}

              {/* Grid Principal de Cards de Métricas */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* 1. Produtivas de Hoje (Diário) */}
                <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200 flex flex-col justify-between transition-all hover:border-emerald-300">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800 uppercase tracking-wide">
                        Diário
                      </span>
                      <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-2">
                        Produtivas de Hoje
                      </h3>
                    </div>
                    <div className="w-11 h-11 rounded-xl bg-emerald-50 text-action-success flex items-center justify-center shadow-xs">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                  </div>

                  <div className="mt-3">
                    <p className="text-3xl font-black text-slate-900 tracking-tight">
                      {carregandoMetricas ? '--' : metricas.produtivasDia}
                    </p>
                    <p className="text-xs text-slate-500 font-medium mt-1">
                      de <strong>{metricas.totalDia}</strong> agendadas em{' '}
                      <span className="text-slate-700 font-semibold">{formatDateBR(dataSelecionada)}</span>
                    </p>
                  </div>
                </div>

                {/* 2. Produtivas do Mês (Mensal) */}
                <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200 flex flex-col justify-between transition-all hover:border-blue-300">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 text-brand-dark uppercase tracking-wide">
                        Mensal
                      </span>
                      <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-2">
                        Produtivas do Mês
                      </h3>
                    </div>
                    <div className="w-11 h-11 rounded-xl bg-blue-50 text-brand flex items-center justify-center shadow-xs">
                      <TrendingUp className="w-6 h-6" />
                    </div>
                  </div>

                  <div className="mt-3">
                    <p className="text-3xl font-black text-brand-dark tracking-tight">
                      {carregandoMetricas ? '--' : metricas.produtivasMes}
                    </p>
                    <p className="text-xs text-slate-500 font-medium mt-1">
                      de <strong>{metricas.totalMes}</strong> agendadas em{' '}
                      <span className="text-slate-700 font-semibold">{formatMonthNameBR(mesAnoSelecionado)}</span>
                    </p>
                  </div>
                </div>

                {/* 3. Pendentes de Hoje */}
                <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200 flex flex-col justify-between transition-all hover:border-amber-300">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-900 uppercase tracking-wide">
                        Na Fila
                      </span>
                      <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-2">
                        Pendentes de Hoje
                      </h3>
                    </div>
                    <div className="w-11 h-11 rounded-xl bg-amber-50 text-action-alert flex items-center justify-center shadow-xs">
                      <Clock className="w-6 h-6" />
                    </div>
                  </div>

                  <div className="mt-3">
                    <p className="text-3xl font-black text-amber-600 tracking-tight">
                      {carregandoMetricas ? '--' : metricas.pendentesDia}
                    </p>
                    <p className="text-xs text-slate-500 font-medium mt-1">
                      aguardando atendimento técnico na data
                    </p>
                  </div>
                </div>

                {/* 4. Taxa de Produtividade Diária */}
                <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200 flex flex-col justify-between transition-all hover:border-indigo-300">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-100 text-indigo-800 uppercase tracking-wide">
                        Performance Dia
                      </span>
                      <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-2">
                        Taxa de Produtividade (Dia)
                      </h3>
                    </div>
                    <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-xs">
                      <Target className="w-6 h-6" />
                    </div>
                  </div>

                  <div className="mt-3 space-y-2">
                    <div className="flex items-baseline justify-between">
                      <p className="text-3xl font-black text-indigo-900 tracking-tight">
                        {carregandoMetricas ? '--' : `${metricas.taxaProdutividadeDia}%`}
                      </p>
                      <span className="text-xs font-bold text-slate-400">
                        {metricas.produtivasDia}/{metricas.totalDia} O.S.
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-indigo-600 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, Math.max(0, Number(metricas.taxaProdutividadeDia)))}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* 5. Taxa de Produtividade Mensal */}
                <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200 flex flex-col justify-between transition-all hover:border-teal-300">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-teal-100 text-teal-800 uppercase tracking-wide">
                        Performance Mês
                      </span>
                      <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-2">
                        Taxa de Produtividade (Mês)
                      </h3>
                    </div>
                    <div className="w-11 h-11 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center shadow-xs">
                      <Percent className="w-6 h-6" />
                    </div>
                  </div>

                  <div className="mt-3 space-y-2">
                    <div className="flex items-baseline justify-between">
                      <p className="text-3xl font-black text-teal-900 tracking-tight">
                        {carregandoMetricas ? '--' : `${metricas.taxaProdutividadeMes}%`}
                      </p>
                      <span className="text-xs font-bold text-slate-400">
                        {metricas.produtivasMes}/{metricas.totalMes} O.S.
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-teal-600 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, Math.max(0, Number(metricas.taxaProdutividadeMes)))}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* 6. Improdutivas & Técnicos */}
                <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200 flex flex-col justify-between transition-all hover:border-rose-300">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-800 uppercase tracking-wide">
                        Auditoria
                      </span>
                      <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-2">
                        Improdutivas
                      </h3>
                    </div>
                    <div className="w-11 h-11 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shadow-xs">
                      <AlertTriangle className="w-6 h-6" />
                    </div>
                  </div>

                  <div className="mt-3">
                    <div className="flex items-baseline gap-2">
                      <p className="text-3xl font-black text-rose-700 tracking-tight">
                        {carregandoMetricas ? '--' : metricas.improdutivasDia}
                      </p>
                      <span className="text-xs text-slate-500 font-semibold">
                        no dia / <strong className="text-rose-700">{metricas.improdutivasMes}</strong> no mês
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 font-medium mt-1">
                      visitas que necessitam de reagendamento
                    </p>
                  </div>
                </div>
              </div>

              {/* Detalhamento Comparativo Diário vs Mensal */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Painel Diário */}
                <div className="bg-white p-6 rounded-2xl shadow-xs border border-slate-200 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div>
                      <h4 className="font-black text-base text-brand-dark">
                        Balanço Diário: {formatDateBR(dataSelecionada)}
                      </h4>
                      <p className="text-xs text-slate-500 font-medium">
                        Status consolidado da agenda selecionada
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPaginaAtiva('AGENDA')}
                      className="inline-flex items-center gap-1 text-xs font-bold text-brand hover:text-brand-dark transition-colors cursor-pointer"
                    >
                      <span>Abrir na Agenda</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Barra Segmentada */}
                  <div className="w-full h-3 rounded-full bg-slate-100 flex overflow-hidden">
                    <div
                      title={`Concluídas: ${metricas.produtivasDia}`}
                      style={{ width: `${metricas.totalDia > 0 ? (metricas.produtivasDia / metricas.totalDia) * 100 : 0}%` }}
                      className="bg-action-success transition-all"
                    />
                    <div
                      title={`Improdutivas: ${metricas.improdutivasDia}`}
                      style={{ width: `${metricas.totalDia > 0 ? (metricas.improdutivasDia / metricas.totalDia) * 100 : 0}%` }}
                      className="bg-rose-500 transition-all"
                    />
                    <div
                      title={`Pendentes: ${metricas.pendentesDia}`}
                      style={{ width: `${metricas.totalDia > 0 ? (metricas.pendentesDia / metricas.totalDia) * 100 : 0}%` }}
                      className="bg-amber-400 transition-all"
                    />
                  </div>

                  {/* Lista com contadores */}
                  <div className="grid grid-cols-3 gap-3 pt-2 text-center">
                    <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-100">
                      <p className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">Concluídas</p>
                      <p className="text-xl font-black text-emerald-900 mt-0.5">{metricas.produtivasDia}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-100">
                      <p className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">Pendentes</p>
                      <p className="text-xl font-black text-amber-900 mt-0.5">{metricas.pendentesDia}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-rose-50/70 border border-rose-100">
                      <p className="text-[11px] font-bold text-rose-800 uppercase tracking-wider">Improdutivas</p>
                      <p className="text-xl font-black text-rose-900 mt-0.5">{metricas.improdutivasDia}</p>
                    </div>
                  </div>
                </div>

                {/* Painel Mensal */}
                <div className="bg-white p-6 rounded-2xl shadow-xs border border-slate-200 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div>
                      <h4 className="font-black text-base text-brand-dark">
                        Balanço Mensal: {formatMonthNameBR(mesAnoSelecionado)}
                      </h4>
                      <p className="text-xs text-slate-500 font-medium">
                        Período de {formatDateBR(rangeMes.primeiroDia)} até {formatDateBR(rangeMes.ultimoDia)}
                      </p>
                    </div>
                    <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 border border-slate-200">
                      {metricas.totalMes} O.S. no Mês
                    </span>
                  </div>

                  {/* Barra Segmentada */}
                  <div className="w-full h-3 rounded-full bg-slate-100 flex overflow-hidden">
                    <div
                      title={`Concluídas: ${metricas.produtivasMes}`}
                      style={{ width: `${metricas.totalMes > 0 ? (metricas.produtivasMes / metricas.totalMes) * 100 : 0}%` }}
                      className="bg-brand transition-all"
                    />
                    <div
                      title={`Improdutivas: ${metricas.improdutivasMes}`}
                      style={{ width: `${metricas.totalMes > 0 ? (metricas.improdutivasMes / metricas.totalMes) * 100 : 0}%` }}
                      className="bg-rose-500 transition-all"
                    />
                    <div
                      title={`Pendentes: ${metricas.pendentesMes}`}
                      style={{ width: `${metricas.totalMes > 0 ? (metricas.pendentesMes / metricas.totalMes) * 100 : 0}%` }}
                      className="bg-amber-400 transition-all"
                    />
                  </div>

                  {/* Lista com contadores */}
                  <div className="grid grid-cols-3 gap-3 pt-2 text-center">
                    <div className="p-3 rounded-xl bg-blue-50/70 border border-blue-100">
                      <p className="text-[11px] font-bold text-brand-dark uppercase tracking-wider">Concluídas</p>
                      <p className="text-xl font-black text-brand-dark mt-0.5">{metricas.produtivasMes}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-100">
                      <p className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">Pendentes</p>
                      <p className="text-xl font-black text-amber-900 mt-0.5">{metricas.pendentesMes}</p>
                    </div>
                    <div className="p-3 rounded-xl bg-rose-50/70 border border-rose-100">
                      <p className="text-[11px] font-bold text-rose-800 uppercase tracking-wider">Improdutivas</p>
                      <p className="text-xl font-black text-rose-900 mt-0.5">{metricas.improdutivasMes}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {paginaAtiva === 'AGENDA' && (
            <AdminAgenda />
          )}

          {paginaAtiva === 'IMPORTAR' && (
            <ImportarPlanilha />
          )}

          {paginaAtiva === 'EXPORTAR' && (
            <div className="bg-white p-8 rounded-2xl shadow-xs border border-slate-200 text-center space-y-3">
              <FileDown className="w-12 h-12 text-slate-400 mx-auto" />
              <h2 className="text-lg font-bold text-slate-800">Módulo de Exportação de Relatórios (CSV)</h2>
              <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
                Em breve: gere relatórios desmembrados por MAC recolhido e status de visitas para integração com o faturamento.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
