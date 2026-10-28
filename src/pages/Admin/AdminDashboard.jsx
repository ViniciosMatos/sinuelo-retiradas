import React, { useState } from 'react';
import { supabase } from '../../supabase';
import ImportarPlanilha from './ImportarPlanilha';
import AdminAgenda from './AdminAgenda';
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
  CalendarDays
} from 'lucide-react';

export default function AdminDashboard({ session, paginaInicial = 'PAINEL_GERAL' }) {
  const [paginaAtiva, setPaginaAtiva] = useState(paginaInicial); // 'PAINEL_GERAL' | 'IMPORTAR' | 'EXPORTAR'
  const [sidebarAberta, setSidebarAberta] = useState(false);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.error('Erro ao encerrar sessão:', err);
    }
  };

  const navItems = [
    { id: 'PAINEL_GERAL', rotulo: 'Painel Geral', icone: LayoutDashboard },
    { id: 'AGENDA', rotulo: 'Agenda Geral', icone: CalendarDays },
    { id: 'IMPORTAR', rotulo: 'Importar Planilha', icone: FileSpreadsheet },
    { id: 'EXPORTAR', rotulo: 'Exportar Relatório', icone: FileDown },
  ];

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

      {/* Conteúdo Principal (Desktop & Mobile) */}
      <main className="flex-1 bg-gray-100 min-h-screen p-4 sm:p-6 lg:p-8 overflow-y-auto">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header da Página */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
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

          {/* Área de Conteúdo Conforme Navegação */}
          {paginaAtiva === 'PAINEL_GERAL' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pendentes</p>
                  <p className="text-2xl font-black text-brand-dark mt-1">--</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Clock className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Concluídas</p>
                  <p className="text-2xl font-black text-action-success mt-1">--</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-action-success flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Em Auditoria</p>
                  <p className="text-2xl font-black text-action-alert mt-1">--</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-amber-50 text-action-alert flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5" />
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl shadow-xs border border-slate-200 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Técnicos Ativos</p>
                  <p className="text-2xl font-black text-brand mt-1">--</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-brand flex items-center justify-center">
                  <Users className="w-5 h-5" />
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
