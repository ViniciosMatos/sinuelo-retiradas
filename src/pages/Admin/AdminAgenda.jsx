import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../supabase';
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Users,
  RefreshCw,
  Hash,
  User,
  MapPin,
  Clock,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Pencil,
  X,
  Save,
  Loader2,
  Cloud,
} from 'lucide-react';

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatarData(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

function addDias(dateStr, n) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

function hojeISO() {
  return new Date().toISOString().split('T')[0];
}

// ─── Modal de Edição ─────────────────────────────────────────────────────────

function ModalEditarOS({ os, tecnicos, onClose, onSaved }) {
  const [form, setForm] = useState({
    endereco: os.endereco || '',
    bairro: os.bairro || '',
    cidade: os.cidade || '',
    observacao_cliente: os.observacao_cliente || '',
    horario_marcado: os.horario_marcado || '',
    data_agendada: os.data_agendada || '',
    tecnico_id: os.tecnico_id || '',
    status: os.status || 'PENDENTE',
  });
  const [salvando, setSalvando] = useState(false);
  const [erroModal, setErroModal] = useState('');

  const handleChange = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSalvar = async () => {
    setSalvando(true);
    setErroModal('');
    try {
      const { error } = await supabase
        .from('ordens_servico')
        .update({
          endereco: form.endereco,
          bairro: form.bairro,
          cidade: form.cidade,
          observacao_cliente: form.observacao_cliente || null,
          horario_marcado: form.horario_marcado || null,
          data_agendada: form.data_agendada || null,
          tecnico_id: form.tecnico_id || null,
          status: form.status,
        })
        .eq('id', os.id);

      if (error) throw error;
      onSaved();
      onClose();
    } catch (e) {
      setErroModal(e.message || 'Erro ao salvar.');
    } finally {
      setSalvando(false);
    }
  };

  const labelCls = 'block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1';
  const inputCls =
    'w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition-colors';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Pencil className="w-4 h-4 text-brand" />
            <h2 className="font-bold text-slate-800 text-sm">
              Editar O.S. <span className="text-brand">#{os.numero_os}</span>
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Endereço */}
          <div>
            <label className={labelCls}>Endereço</label>
            <input className={inputCls} value={form.endereco} onChange={handleChange('endereco')} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Bairro</label>
              <input className={inputCls} value={form.bairro} onChange={handleChange('bairro')} />
            </div>
            <div>
              <label className={labelCls}>Cidade</label>
              <input className={inputCls} value={form.cidade} onChange={handleChange('cidade')} />
            </div>
          </div>

          {/* Observação */}
          <div>
            <label className={labelCls}>Observação do Cliente</label>
            <textarea
              className={inputCls + ' resize-none'}
              rows={3}
              value={form.observacao_cliente}
              onChange={handleChange('observacao_cliente')}
            />
          </div>

          {/* Data + Horário */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Data Agendada</label>
              <input type="date" className={inputCls} value={form.data_agendada} onChange={handleChange('data_agendada')} />
            </div>
            <div>
              <label className={labelCls}>Horário Marcado</label>
              <input type="time" className={inputCls} value={form.horario_marcado} onChange={handleChange('horario_marcado')} />
            </div>
          </div>

          {/* Técnico */}
          <div>
            <label className={labelCls}>Técnico Responsável</label>
            <select className={inputCls} value={form.tecnico_id} onChange={handleChange('tecnico_id')}>
              <option value="">— Não atribuído —</option>
              {tecnicos.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome || t.email}
                </option>
              ))}
            </select>
          </div>

          {/* Status */}
          <div>
            <label className={labelCls}>Status</label>
            <select className={inputCls} value={form.status} onChange={handleChange('status')}>
              <option value="PENDENTE">Pendente</option>
              <option value="CONCLUIDA">Concluída</option>
              <option value="IMPRODUTIVA">Improdutiva</option>
            </select>
          </div>

          {erroModal && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-xs font-semibold text-red-700">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              {erroModal}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-slate-100 bg-slate-50 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSalvar}
            disabled={salvando}
            className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-brand hover:bg-brand-light disabled:opacity-60 transition-all flex items-center gap-2"
          >
            {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar Alterações
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Card Admin ──────────────────────────────────────────────────────────────

function CardOSAdmin({ os, tecnicos, onEditar }) {
  const [contatosAbertos, setContatosAbertos] = useState(false);
  const temHorario = Boolean(os.horario_marcado?.trim());
  const obsCliente = os.observacao_cliente || os.obs_cliente;
  const temObs = Boolean(obsCliente?.trim());
  const nomeTecnico = tecnicos.find((t) => t.id === os.tecnico_id);

  const statusBadge = () => {
    if (os.status === 'CONCLUIDA')
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
          <CheckCircle className="w-3.5 h-3.5" /> Concluída
        </span>
      );
    if (os.status === 'IMPRODUTIVA')
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold bg-red-100 text-red-800 border border-red-300">
          <XCircle className="w-3.5 h-3.5" /> Improdutiva
        </span>
      );
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">
        Pendente
      </span>
    );
  };

  return (
    <div className={`relative w-full overflow-hidden rounded-xl bg-white shadow-md border border-slate-200 flex text-left`}>
      {/* Tarja lateral */}
      {temHorario && <div className="w-2.5 bg-action-alert flex-shrink-0" aria-hidden="true" />}

      <div className="flex-1 p-4 flex flex-col gap-2.5">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-1 text-xs font-semibold text-brand bg-slate-100 px-2.5 py-1 rounded-md">
            <Hash className="w-3.5 h-3.5" />
            <span>{os.numero_os}</span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {temHorario && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-950 border border-action-alert">
                <Clock className="w-3.5 h-3.5 text-action-alert" />
                {os.horario_marcado}
              </span>
            )}
            {os.turno && (
              <span className="text-xs font-medium px-2 py-0.5 rounded bg-slate-200 text-slate-700 uppercase">
                {os.turno}
              </span>
            )}
            {statusBadge()}
          </div>
        </div>

        {/* Técnico */}
        {nomeTecnico && (
          <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
            <User className="w-3.5 h-3.5 text-slate-400" />
            <span>{nomeTecnico.nome || nomeTecnico.email}</span>
          </div>
        )}

        {/* Cliente */}
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

        {/* Contatos expansíveis */}
        {os.telefone_1 && (
          <div className="flex flex-col gap-1.5">
            <button
              type="button"
              onClick={() => setContatosAbertos((v) => !v)}
              className="self-start inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 active:scale-95 transition-all border border-slate-200"
            >
              <span>📞</span>
              <span>{contatosAbertos ? 'Ocultar Contatos' : 'Ver Contatos'}</span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className={`w-3 h-3 transition-transform ${contatosAbertos ? 'rotate-180' : ''}`}
                viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </button>
            {contatosAbertos && (
              <div className="flex flex-wrap gap-2 pl-0.5">
                <a href={`tel:${os.telefone_1}`} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-all">
                  📞 Ligar ({os.telefone_1})
                </a>
                <a href={`https://wa.me/55${os.telefone_1.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-100 text-emerald-800 hover:bg-emerald-200 transition-all">
                  💬 WA 1
                </a>
                {os.telefone_2 && (
                  <>
                    <a href={`tel:${os.telefone_2}`} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 transition-all">
                      📞 Ligar 2 ({os.telefone_2})
                    </a>
                    <a href={`https://wa.me/55${os.telefone_2.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-100 text-emerald-800 hover:bg-emerald-200 transition-all">
                      💬 WA 2
                    </a>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Observação */}
        {temObs && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 text-amber-900 border border-amber-200 text-xs font-semibold">
            <AlertTriangle className="w-3.5 h-3.5 text-action-alert flex-shrink-0" />
            <span className="truncate">⚠️ {obsCliente}</span>
          </div>
        )}

        {/* Rodapé com botão Editar */}
        <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {os.sincronizado && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                <Cloud className="w-3 h-3" /> Sincronizado
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => onEditar(os)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-brand hover:bg-brand-light active:scale-95 transition-all shadow-sm"
          >
            <Pencil className="w-3.5 h-3.5" />
            Editar O.S.
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Página Principal ────────────────────────────────────────────────────────

export default function AdminAgenda() {
  const [dataAtual, setDataAtual] = useState(hojeISO());
  const [tecnicoFiltro, setTecnicoFiltro] = useState('');
  const [tecnicos, setTecnicos] = useState([]);
  const [ordens, setOrdens] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [osEditando, setOsEditando] = useState(null);

  // Busca lista de técnicos
  useEffect(() => {
    async function fetchTecnicos() {
      const { data } = await supabase
        .from('usuarios')
        .select('id, nome, email')
        .eq('perfil', 'TECNICO')
        .order('nome');
      if (data) setTecnicos(data);
    }
    fetchTecnicos();
  }, []);

  // Busca ordens filtradas
  const fetchOrdens = useCallback(async () => {
    setCarregando(true);
    try {
      let query = supabase
        .from('ordens_servico')
        .select('*')
        .eq('data_agendada', dataAtual)
        .order('ordem_importacao', { ascending: true });

      if (tecnicoFiltro) {
        query = query.eq('tecnico_id', tecnicoFiltro);
      }

      const { data, error } = await query;
      if (!error && data) setOrdens(data);
    } catch (e) {
      console.error('Erro ao buscar ordens:', e);
    } finally {
      setCarregando(false);
    }
  }, [dataAtual, tecnicoFiltro]);

  useEffect(() => {
    fetchOrdens();
  }, [fetchOrdens]);

  const isHoje = dataAtual === hojeISO();

  // Contadores rápidos
  const total = ordens.length;
  const pendentes = ordens.filter((o) => !o.status || o.status === 'PENDENTE').length;
  const concluidas = ordens.filter((o) => o.status === 'CONCLUIDA').length;
  const improdutivas = ordens.filter((o) => o.status === 'IMPRODUTIVA').length;

  return (
    <div className="space-y-5">
      {/* Navegação de Data */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-5 h-5 text-brand" />
          <span className="font-bold text-slate-700 text-sm">Agenda do Dia</span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setDataAtual((d) => addDias(d, -1))}
            className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 transition-colors"
            title="Dia anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          <input
            type="date"
            value={dataAtual}
            onChange={(e) => setDataAtual(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm font-bold text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-brand/30 transition-colors"
          />

          <button
            type="button"
            onClick={() => setDataAtual((d) => addDias(d, 1))}
            className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 transition-colors"
            title="Próximo dia"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          {!isHoje && (
            <button
              type="button"
              onClick={() => setDataAtual(hojeISO())}
              className="px-3 py-1.5 rounded-lg text-xs font-bold text-brand border border-brand/30 bg-blue-50 hover:bg-blue-100 transition-colors"
            >
              Hoje
            </button>
          )}

          <span className="text-sm font-semibold text-slate-500">
            {formatarData(dataAtual)}
            {isHoje && <span className="ml-1.5 text-xs text-emerald-600 font-bold">(hoje)</span>}
          </span>
        </div>

        {/* Filtro Técnico */}
        <div className="flex items-center gap-2 sm:ml-auto">
          <Users className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <select
            value={tecnicoFiltro}
            onChange={(e) => setTecnicoFiltro(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-slate-300 text-sm text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-brand/30 transition-colors"
          >
            <option value="">Todos os Técnicos</option>
            {tecnicos.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nome || t.email}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={fetchOrdens}
            disabled={carregando}
            title="Atualizar"
            className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${carregando ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Métricas rápidas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: total, color: 'text-slate-700', bg: 'bg-slate-50' },
          { label: 'Pendentes', value: pendentes, color: 'text-amber-700', bg: 'bg-amber-50' },
          { label: 'Concluídas', value: concluidas, color: 'text-emerald-700', bg: 'bg-emerald-50' },
          { label: 'Improdutivas', value: improdutivas, color: 'text-red-700', bg: 'bg-red-50' },
        ].map((m) => (
          <div key={m.label} className={`${m.bg} rounded-xl border border-slate-200 p-3 text-center`}>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{m.label}</p>
            <p className={`text-2xl font-black mt-0.5 ${m.color}`}>{m.value}</p>
          </div>
        ))}
      </div>

      {/* Lista de Ordens */}
      {carregando ? (
        <div className="flex items-center justify-center py-16 gap-3 text-slate-500">
          <Loader2 className="w-6 h-6 animate-spin text-brand" />
          <span className="text-sm font-semibold">Carregando agenda...</span>
        </div>
      ) : ordens.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center">
          <CalendarDays className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-600">Nenhuma O.S. para {formatarData(dataAtual)}</p>
          <p className="text-xs text-slate-400 mt-1">
            {tecnicoFiltro ? 'Tente remover o filtro de técnico.' : 'Nenhuma ordem agendada para essa data.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {ordens.map((os) => (
            <CardOSAdmin
              key={os.id}
              os={os}
              tecnicos={tecnicos}
              onEditar={setOsEditando}
            />
          ))}
        </div>
      )}

      {/* Modal Editar */}
      {osEditando && (
        <ModalEditarOS
          os={osEditando}
          tecnicos={tecnicos}
          onClose={() => setOsEditando(null)}
          onSaved={fetchOrdens}
        />
      )}
    </div>
  );
}
