import React, { useState, useEffect, useMemo } from 'react';
import imageCompression from 'browser-image-compression';
import { db } from '../db/db';
import { sincronizarPendentes } from '../services/syncService';
import { 
  X, 
  MapPin, 
  Navigation, 
  MessageCircle, 
  Phone, 
  Clock, 
  AlertTriangle, 
  Camera, 
  CheckCircle, 
  XCircle, 
  User, 
  Hash,
  Loader2,
  Trash2,
  Cloud,
  Router,
  Plus
} from 'lucide-react';

export default function ModalDetalhesOS({ os, onClose }) {
  if (!os) return null;

  // 2. Retenção da Aba de Encerramento Pós-Câmera
  // 'detalhes' | 'concluir' | 'improdutiva'
  const [abaAtiva, setAbaAtiva] = useState(() => {
    return sessionStorage.getItem(`modal_aba_ativa_${os?.id}`) || 'detalhes';
  });

  const mudarAba = (novaAba) => {
    setAbaAtiva(novaAba);
    try {
      if (novaAba && novaAba !== 'detalhes') {
        sessionStorage.setItem(`modal_aba_ativa_${os?.id}`, novaAba);
      } else {
        sessionStorage.removeItem(`modal_aba_ativa_${os?.id}`);
      }
    } catch (e) {
      console.warn('Erro ao salvar aba ativa no sessionStorage:', e);
    }
  };

  const handleFecharModal = () => {
    try {
      sessionStorage.removeItem(`modal_aba_ativa_${os?.id}`);
    } catch (e) {}
    onClose();
  };
  
  // 1. Fotos indexadas por chave de equipamento: { [equipKey]: { file, previewUrl, equipamento_id } }
  const [fotos, setFotos] = useState({});
  // 3. Equipamentos marcados individualmente como 'Não Entregue': { [equipKey]: true }
  const [naoEntregues, setNaoEntregues] = useState({});

  const [comprimindoKey, setComprimindoKey] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [equipamentosPrevistos, setEquipamentosPrevistos] = useState([]);
  const [aparelhosExtras, setAparelhosExtras] = useState([]);

  // Fluxo de Improdutiva
  const [motivoImprodutiva, setMotivoImprodutiva] = useState('Cliente ausente');
  const [obsTecnico, setObsTecnico] = useState('');

  // Endereço e Google Maps
  const enderecoCompleto = `${os.endereco || ''}${os.bairro ? ` - ${os.bairro}` : ''}${os.cidade ? `, ${os.cidade}` : ''}`;
  const mapsUrl = os.link_maps || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(enderecoCompleto)}`;
  
  // Lista de Contatos (CONTATO_1 e CONTATO_2)
  const listaContatos = [];
  const c1 = os.telefone_1;
  const c2 = os.telefone_2;
  if (c1 && String(c1).trim()) listaContatos.push(String(c1).trim());
  if (c2 && String(c2).trim() && String(c2).trim() !== String(c1).trim()) listaContatos.push(String(c2).trim());

  const obsCliente = os.observacao_cliente;

  // Carrega fotos rascunho persistidas no Dexie caso o app da câmera tenha reciclado a RAM
  useEffect(() => {
    let ativo = true;
    async function carregarFotosSalvas() {
      if (!os?.id) return;
      try {
        const osLocal = await db.ordens_servico.get(os.id);
        if (ativo && (!osLocal?.status || osLocal?.status === 'PENDENTE')) {
          if (osLocal?.fotos_por_equipamento && typeof osLocal.fotos_por_equipamento === 'object') {
            const fotosRestauradas = {};
            for (const [k, v] of Object.entries(osLocal.fotos_por_equipamento)) {
              if (v) {
                const blob = v instanceof Blob ? v : (v?.file || v?.blob);
                const pUrl = v?.previewUrl || (blob instanceof Blob ? URL.createObjectURL(blob) : null);
                fotosRestauradas[k] = {
                  file: blob || v,
                  previewUrl: pUrl,
                  equipamento_id: k
                };
              }
            }
            setFotos(fotosRestauradas);
          }
          if (osLocal?.equipamentos_nao_entregues && typeof osLocal.equipamentos_nao_entregues === 'object') {
            setNaoEntregues(osLocal.equipamentos_nao_entregues);
          }
        }
      } catch (err) {
        console.warn('Erro ao carregar fotos locais do Dexie:', err);
      }
    }
    carregarFotosSalvas();
    return () => { ativo = false; };
  }, [os?.id]);

  // URLs de fotos de OS já concluída (para exibição no card de histórico)
  const fotosConcluidaUrls = useMemo(() => {
    if (!Array.isArray(os?.fotos_recolhimento)) return [];
    return os.fotos_recolhimento.map((f) => {
      if (typeof f === 'string') return f;
      if (f instanceof Blob) return URL.createObjectURL(f);
      return null;
    }).filter(Boolean);
  }, [os?.fotos_recolhimento]);

  useEffect(() => {
    return () => {
      fotosConcluidaUrls.forEach((url) => {
        if (typeof url === 'string' && url.startsWith('blob:')) {
          try { URL.revokeObjectURL(url); } catch (e) {}
        }
      });
    };
  }, [fotosConcluidaUrls]);

  // Carrega lista de equipamentos / MACs vinculados à OS no Dexie
  useEffect(() => {
    let ativo = true;
    async function carregarEquipamentos() {
      if (!os) return;
      try {
        let items = [];

        // Tenta busca direta por os_id = os.id (funciona se os.id é o UUID Supabase)
        if (os.id) {
          items = await db.equipamentos.where({ os_id: os.id }).toArray();
        }

        // Se não achou (os.id é autoincrement Dexie), tenta via numero_os para obter UUID real
        if ((!items || items.length === 0) && os.numero_os) {
          const osLocal = await db.ordens_servico.where({ numero_os: os.numero_os }).first();
          if (osLocal && osLocal.id && osLocal.id !== os.id) {
            items = await db.equipamentos.where({ os_id: osLocal.id }).toArray();
          }
        }

        if (!items) items = [];

        if (ativo) {
          setEquipamentosPrevistos(items);
        }
      } catch (err) {
        console.error('Erro ao buscar equipamentos previstos no Dexie:', err);
      }
    }
    carregarEquipamentos();
    return () => { ativo = false; };
  }, [os?.id, os?.numero_os]);

  // Compressão assíncrona em background que não bloqueia a interface nem o preview
  const comprimirEPersistirFoto = async (eqId, file, previewUrl) => {
    try {
      setComprimindoKey(eqId);
      const options = {
        maxSizeMB: 0.2,
        maxWidthOrHeight: 1024,
        useWebWorker: true,
      };

      const compressedFile = await imageCompression(file, options);

      // Atualiza o estado com o arquivo comprimido mantendo o previewUrl intacto
      setFotos((prev) => {
        if (!prev[eqId]) return prev;
        return {
          ...prev,
          [eqId]: {
            file: compressedFile,
            previewUrl: prev[eqId].previewUrl || previewUrl,
            equipamento_id: eqId,
          },
        };
      });

      // Gravação local imediata no Dexie (offline-first & proteção contra RAM reciclada)
      if (os?.id) {
        const osLocal = await db.ordens_servico.get(os.id);
        const fotosAtuais = osLocal?.fotos_por_equipamento || {};
        await db.ordens_servico.update(os.id, {
          fotos_por_equipamento: {
            ...fotosAtuais,
            [eqId]: compressedFile,
          },
        });
      }
    } catch (err) {
      console.warn('Falha na compressão da foto (mantendo arquivo original):', err);
    } finally {
      setComprimindoKey(null);
    }
  };

  // 1. Fix do Preview de Foto na Primeira Captura com persistência imediata
  const handleCapturaFoto = async (eqId, e) => {
    const file = e.target.files?.[0];

    // Resete o valor do input imediatamente para permitir novas capturas do mesmo arquivo sem travar
    e.target.value = '';

    // Se não houver arquivo, interrompa a execução sem alterar estados
    if (!file) return;

    // Crie a URL temporária de visualização antes de qualquer operação assíncrona
    const previewUrl = URL.createObjectURL(file);

    // Atualize o estado visual usando atualização funcional
    setFotos((prev) => ({
      ...prev,
      [eqId]: { file, previewUrl, equipamento_id: eqId },
    }));

    // Remova a flag nao_entregue do equipamento caso ele estivesse marcado anteriormente nessa condição
    let proximoNaoEntregues = null;
    setNaoEntregues((prev) => {
      if (!prev[eqId]) {
        proximoNaoEntregues = prev;
        return prev;
      }
      const copy = { ...prev };
      delete copy[eqId];
      proximoNaoEntregues = copy;
      return copy;
    });

    // Gravação local imediata no Dexie do arquivo original (proteção instantânea contra descarte de RAM da câmera)
    if (os?.id) {
      try {
        const osLocal = await db.ordens_servico.get(os.id);
        const fotosAtuais = osLocal?.fotos_por_equipamento || {};
        const updatePayload = {
          fotos_por_equipamento: {
            ...fotosAtuais,
            [eqId]: file,
          },
        };
        if (proximoNaoEntregues !== null) {
          updatePayload.equipamentos_nao_entregues = proximoNaoEntregues;
        }
        await db.ordens_servico.update(os.id, updatePayload);
      } catch (errDexie) {
        console.warn('Erro ao salvar rascunho de foto inicial no Dexie:', errDexie);
      }
    }

    // Inicia compressão e persistência do arquivo otimizado em background
    comprimirEPersistirFoto(eqId, file, previewUrl);
  };

  const handleRemoverFotoEquipamento = async (eqId) => {
    setFotos((prev) => {
      const copy = { ...prev };
      if (copy[eqId]?.previewUrl) {
        try { URL.revokeObjectURL(copy[eqId].previewUrl); } catch (e) {}
      }
      delete copy[eqId];
      return copy;
    });

    if (os?.id) {
      try {
        const osLocal = await db.ordens_servico.get(os.id);
        if (osLocal?.fotos_por_equipamento) {
          const fotosAtualizadas = { ...osLocal.fotos_por_equipamento };
          delete fotosAtualizadas[eqId];
          await db.ordens_servico.update(os.id, {
            fotos_por_equipamento: fotosAtualizadas,
          });
        }
      } catch (err) {
        console.warn('Erro ao remover foto do Dexie:', err);
      }
    }
  };

  // 3. Botão 'Não Entregue' Individual por MAC com persistência imediata no Dexie
  const handleToggleNaoEntregue = async (eqId) => {
    const novoStatusNaoEntregue = !naoEntregues[eqId];
    let proximoNaoEntregues = {};

    setNaoEntregues((prev) => {
      const next = { ...prev };
      if (novoStatusNaoEntregue) {
        next[eqId] = true;
      } else {
        delete next[eqId];
      }
      proximoNaoEntregues = next;
      return next;
    });

    // Se havia uma foto previamente associada em fotos[eq.id], remova a foto desse item do estado fotos
    if (novoStatusNaoEntregue) {
      setFotos((prev) => {
        if (!prev[eqId]) return prev;
        const copy = { ...prev };
        if (copy[eqId]?.previewUrl) {
          try { URL.revokeObjectURL(copy[eqId].previewUrl); } catch (e) {}
        }
        delete copy[eqId];
        return copy;
      });
    }

    // Persiste imediatamente no Dexie para que a abertura da câmera não resete a seleção
    if (os?.id) {
      try {
        const osLocal = await db.ordens_servico.get(os.id);
        const updatePayload = {
          equipamentos_nao_entregues: proximoNaoEntregues,
        };
        if (novoStatusNaoEntregue && osLocal?.fotos_por_equipamento?.[eqId]) {
          const fotosAtuais = { ...osLocal.fotos_por_equipamento };
          delete fotosAtuais[eqId];
          updatePayload.fotos_por_equipamento = fotosAtuais;
        }
        await db.ordens_servico.update(os.id, updatePayload);
      } catch (errDexie) {
        console.warn('Erro ao persistir estado de não entregue no Dexie:', errDexie);
      }
    }
  };

  const handleAdicionarAparelhoExtra = () => {
    const novoIndex = aparelhosExtras.length + 1;
    setAparelhosExtras((prev) => [
      ...prev,
      { key: `extra-${Date.now()}`, mac_esperado: `Aparelho Extra #${novoIndex}`, isExtra: true },
    ]);
  };

  // Lista unificada para o formulário de recolhimento
  const listaRecolhimento = equipamentosPrevistos.length > 0 
    ? [...equipamentosPrevistos, ...aparelhosExtras]
    : [
        { key: 'avulso-1', mac_esperado: 'Aparelho Recolhido (ONU/Roteador)', isPadrao: true },
        ...aparelhosExtras
      ];

  // 3. Regra de Habilitação do Botão 'Concluir O.S.':
  // O botão 'Concluir' deve ser habilitado quando todos os equipamentos da O.S. possuírem um status definido
  // (ou seja, para cada equipamento em os.equipamentos, deve haver foto em fotos[eq.id] OU estar marcado com nao_entregue === true).
  const totalEquipamentos = listaRecolhimento.length;
  const equipamentosDefinidosQtd = listaRecolhimento.filter((eq) => {
    const k = eq.id !== undefined && eq.id !== null ? String(eq.id) : (eq.key || eq.mac_esperado);
    const temFoto = Boolean(fotos[k]?.previewUrl || fotos[k]?.file);
    const isNaoEntregue = Boolean(naoEntregues[k]);
    return temFoto || isNaoEntregue;
  }).length;

  const todosEquipamentosDefinidos = totalEquipamentos > 0
    ? equipamentosDefinidosQtd === totalEquipamentos
    : Object.keys(fotos).length > 0;

  const totalFotosAnexadas = Object.keys(fotos).filter((k) => Boolean(fotos[k]?.previewUrl || fotos[k]?.file)).length;
  const temNaoEntregue = Object.values(naoEntregues).some(Boolean);

  // Flag de Auditoria (requer_verificacao):
  // Se pelo menos 1 equipamento da O.S. for marcado como 'Não Entregue'
  // (ou se o número de fotos capturadas for menor que o total de equipamentos e houver >1 equipamento),
  // defina requer_verificacao = true na Ordem de Serviço.
  const requerVerificacao = temNaoEntregue || (totalEquipamentos > 1 && totalFotosAnexadas < totalEquipamentos);

  const podeConcluir = todosEquipamentosDefinidos && comprimindoKey === null && !salvando;

  // Encerramento Produtivo com salvamento local no Dexie e disparo imediato em background
  const handleSalvarConclusao = async (e) => {
    e.preventDefault();
    if (!podeConcluir) return;

    try {
      setSalvando(true);

      // Persistência no Dexie dos equipamentos:
      // Para equipamentos com foto -> foi_recolhido = true
      // Para equipamentos marcados como 'Não Entregue' -> foi_recolhido = false
      for (const eq of equipamentosPrevistos) {
        const eqId = eq.id !== undefined && eq.id !== null ? String(eq.id) : (eq.mac_esperado || '');
        const temFoto = Boolean(fotos[eqId]?.previewUrl || fotos[eqId]?.file || fotos[eqId]?.blob);
        const isNaoEntregue = Boolean(naoEntregues[eqId]);

        if (eq.id !== undefined && eq.id !== null) {
          await db.equipamentos.update(eq.id, {
            foi_recolhido: temFoto && !isNaoEntregue,
          });
        }
      }

      // Persistência dos equipamentos extras no Dexie (Opção 1)
      for (const extra of aparelhosExtras) {
        const k = extra.key;
        const temFoto = Boolean(fotos[k]?.previewUrl || fotos[k]?.file || fotos[k]?.blob);
        if (temFoto) {
          await db.equipamentos.add({
            os_id: os.id,
            mac_esperado: 'EXTRA',
            foi_recolhido: true,
            is_extra: true,
            temp_key: k,
          });
        }
      }

      const arrayFotosBlobs = Object.values(fotos)
        .map((item) => (item instanceof Blob ? item : (item?.file || item?.blob)))
        .filter((f) => f instanceof Blob);

      // Salva no Dexie local com status_sincronizacao = 'pendente'
      await db.ordens_servico.update(os.id, {
        status: 'CONCLUIDA',
        status_sincronizacao: 'pendente',
        sync_status: 'pendente',
        sincronizado: false,
        requer_verificacao: requerVerificacao,
        fotos_recolhimento: arrayFotosBlobs,
        fotos_por_equipamento: fotos,
        equipamentos_nao_entregues: naoEntregues,
        concluido_em: new Date().toISOString(),
      });

      // Limpa retenção de aba
      try {
        sessionStorage.removeItem(`modal_aba_ativa_${os?.id}`);
      } catch (err) {}

      // Fecha o modal instantaneamente (otimista)
      onClose();

      // Disparo imediato em background sem travar a interface
      sincronizarPendentes().catch((err) => console.warn('Erro sync automático em background:', err));
    } catch (err) {
      console.error('Erro ao finalizar O.S.:', err);
      alert('Falha ao salvar conclusão da O.S.');
    } finally {
      setSalvando(false);
    }
  };

  // Encerramento Improdutivo: Limpeza completa de fotos, requer_verificacao = false e sync imediato
  const handleRegistrarImprodutiva = async (e) => {
    e.preventDefault();
    if (motivoImprodutiva === 'Outro' && !obsTecnico.trim()) {
      alert('Observação obrigatória ao selecionar o motivo "Outro".');
      return;
    }

    try {
      setSalvando(true);

      await db.ordens_servico.update(os.id, {
        status: 'IMPRODUTIVA',
        status_sincronizacao: 'pendente',
        sync_status: 'pendente',
        sincronizado: false,
        requer_verificacao: false,
        fotos_recolhimento: null,
        fotos_por_equipamento: null,
        equipamentos_nao_entregues: null,
        motivo_improdutiva: motivoImprodutiva,
        observacao_tecnico: obsTecnico.trim(),
        concluido_em: new Date().toISOString(),
      });

      // Reverte status de equipamentos previstos
      if (equipamentosPrevistos.length > 0) {
        for (const eq of equipamentosPrevistos) {
          if (eq.id !== undefined && eq.id !== null) {
            await db.equipamentos.update(eq.id, { foi_recolhido: false });
          }
        }
      }

      // Limpa retenção de aba
      try {
        sessionStorage.removeItem(`modal_aba_ativa_${os?.id}`);
      } catch (err) {}

      // Fecha o modal instantaneamente
      onClose();

      // Disparo imediato em background sem travar a interface
      sincronizarPendentes().catch((err) => console.warn('Erro sync automático em background:', err));
    } catch (err) {
      console.error('Erro ao registrar improdutiva:', err);
      alert('Falha ao registrar improdutiva.');
    } finally {
      setSalvando(false);
    }
  };

  const handleAbrirImprodutiva = () => {
    setFotos({});
    setNaoEntregues({});
    mudarAba('improdutiva');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4">
      <div className="w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom duration-200">
        
        {/* Header Modal */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-xs font-bold text-brand bg-brand/10 px-2.5 py-1 rounded">
              <Hash className="w-3.5 h-3.5" />
              {os.numero_os}
            </span>
            {os.horario_marcado && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-950 border border-action-alert">
                <Clock className="w-3 h-3 text-action-alert" />
                {os.horario_marcado}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={handleFecharModal}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corpo com Scroll */}
        <div className="p-4 overflow-y-auto space-y-4">
          {/* Cliente */}
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
              <User className="w-3.5 h-3.5" />
              Cliente
            </div>
            <h2 className="text-lg font-bold text-brand-dark">
              {os.cliente_nome || 'Nome não informado'}
            </h2>
          </div>

          {/* Endereço Completo & Botão Google Maps */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2.5">
            <div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                Endereço Completo
              </div>
              <p className="text-sm font-medium text-slate-800">
                {os.endereco || 'Endereço não informado'}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                {os.bairro ? `Bairro: ${os.bairro}` : ''} {os.cidade ? ` • ${os.cidade}` : ''}
              </p>
            </div>

            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-bold shadow-xs hover:bg-slate-50 active:scale-98 transition-all"
            >
              <Navigation className="w-4 h-4 text-blue-600" />
              <span>Abrir no Google Maps</span>
            </a>
          </div>

          {/* Lista de Contatos: Telefone e WhatsApp */}
          <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
              <Phone className="w-3.5 h-3.5 text-slate-400" />
              Contatos
            </div>
            {listaContatos.length > 0 ? (
              <div className="space-y-2">
                {listaContatos.map((numero, idx) => {
                  const cleanNum = numero.replace(/\D/g, '');
                  return (
                    <div
                      key={idx}
                      className="flex items-center justify-between gap-2 p-2.5 bg-white rounded-lg border border-slate-200"
                    >
                      <span className="text-sm font-semibold text-slate-800 font-mono">
                        {numero}
                      </span>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <a
                          href={`tel:${cleanNum}`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold hover:bg-blue-100 active:scale-95 transition-all"
                        >
                          <Phone className="w-3.5 h-3.5" />
                          Ligar
                        </a>
                        <a
                          href={`https://wa.me/55${cleanNum}?text=${encodeURIComponent(`Olá, sou o técnico da Sinuelo referente à retirada da O.S. ${os.numero_os}.`)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold hover:bg-emerald-100 active:scale-95 transition-all"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          WhatsApp
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-slate-400 italic">Nenhum contato informado.</p>
            )}
          </div>

          {/* Bloco Visual de Conferência de MACs Recomendados (quando na aba de detalhes) */}
          {abaAtiva === 'detalhes' && (
            <div className="bg-blue-50/90 border-2 border-blue-300 p-3.5 rounded-xl space-y-2.5 shadow-2xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-blue-600 text-white rounded-lg shadow-xs">
                    <Router className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-blue-950 uppercase tracking-wider block">
                      Aparelhos / MACs Recomendados
                    </span>
                    <span className="text-[11px] text-blue-700 font-medium">
                      Conferir na etiqueta do equipamento antes de recolher
                    </span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full text-xs font-extrabold bg-blue-100 text-blue-900 border border-blue-300">
                  {equipamentosPrevistos.length} {equipamentosPrevistos.length === 1 ? 'item' : 'itens'}
                </span>
              </div>

              {equipamentosPrevistos.length > 0 ? (
                <div className="space-y-1.5 pt-1">
                  {equipamentosPrevistos.map((eq, idx) => {
                    const mac = eq.mac_esperado || 'MAC não informado';
                    const jaRecolhido = eq.foi_recolhido;
                    return (
                      <div
                        key={eq.id || idx}
                        className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-blue-200 shadow-2xs"
                      >
                        <div className="flex items-center gap-2 overflow-hidden">
                          <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-center flex-shrink-0">
                            {idx + 1}
                          </span>
                          <span className="font-mono text-sm font-bold text-slate-900 tracking-wider truncate">
                            {mac}
                          </span>
                        </div>
                        {jaRecolhido ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded flex-shrink-0">
                            <CheckCircle className="w-3 h-3 text-emerald-600" />
                            Recolhido
                          </span>
                        ) : (
                          <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded flex-shrink-0">
                            A Recolher
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-2.5 bg-white/80 rounded-lg border border-dashed border-blue-300 text-center">
                  <p className="text-xs font-medium text-slate-600">
                    Nenhum MAC específico cadastrado para esta O.S.
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Recolha os aparelhos da operadora presentes no local.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Destaque de Observações da OS */}
          {obsCliente && (
            <div className="bg-yellow-50 border-l-4 border-yellow-500 text-yellow-900 p-3 rounded-r-xl shadow-xs">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider mb-1 text-yellow-800">
                <AlertTriangle className="w-4 h-4 text-yellow-600 flex-shrink-0" />
                Observação do Cliente
              </div>
              <p className="text-sm font-medium leading-relaxed">
                {obsCliente}
              </p>
            </div>
          )}

          {/* Formulário Condicional: Finalizar OS (Sucesso) - Aba 'concluir' */}
          {abaAtiva === 'concluir' && (
            <form onSubmit={handleSalvarConclusao} className="p-4 bg-emerald-50/90 rounded-2xl border-2 border-emerald-300 space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-emerald-950 flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4 text-action-success" />
                  Equipamentos Recolhidos & Fotos
                </h3>
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-white text-slate-700 border border-emerald-200">
                  {totalFotosAnexadas} foto(s) anexada(s)
                </span>
              </div>

              {/* Status Dinâmico de Triagem e Auditoria */}
              <div className="p-2.5 bg-white rounded-xl border border-emerald-200 text-xs">
                {!todosEquipamentosDefinidos ? (
                  <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                    <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                    <span>
                      Defina o status de cada item ({equipamentosDefinidosQtd} de {totalEquipamentos} definidos): tire foto ou marque "Não Entregue".
                    </span>
                  </div>
                ) : requerVerificacao ? (
                  <div className="flex items-center gap-1.5 text-amber-800 font-bold">
                    <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                    <span>
                      Requer Auditoria: {temNaoEntregue ? 'Contém item marcado como Não Entregue.' : `${totalFotosAnexadas} de ${totalEquipamentos} recolhidos.`} A O.S. será finalizada com flag de auditoria.
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 text-emerald-800 font-bold">
                    <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <span>
                      Triagem Automática: Todos os {totalEquipamentos} equipamentos recolhidos com foto. Pronto para conclusão!
                    </span>
                  </div>
                )}
              </div>

              {/* Lista de Seleção de Equipamentos com Câmera Individual, Toggle Não Entregue e Preview Instantâneo */}
              <div className="space-y-3">
                <span className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Itens da O.S. (Tire a foto ou marque Não Entregue):
                </span>

                {listaRecolhimento.map((eq, idx) => {
                  const eqId = eq.id !== undefined && eq.id !== null ? String(eq.id) : (eq.key || eq.mac_esperado || `eq-${idx}`);
                  const mac = eq.mac_esperado || 'Aparelho';
                  const temFoto = Boolean(fotos[eqId]?.previewUrl || fotos[eqId]?.file);
                  const isNaoEntregue = Boolean(naoEntregues[eqId]);
                  const isComprimindoEste = comprimindoKey === eqId;

                  return (
                    <div
                      key={eqId}
                      className={`p-3.5 rounded-xl border transition-all ${
                        temFoto 
                          ? 'bg-white border-emerald-400 shadow-xs ring-1 ring-emerald-300' 
                          : isNaoEntregue
                            ? 'bg-amber-50/70 border-amber-300 shadow-2xs'
                            : 'bg-white/90 border-slate-200 shadow-2xs'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 overflow-hidden">
                          <span className={`w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0 ${
                            temFoto 
                              ? 'bg-emerald-100 text-emerald-800' 
                              : isNaoEntregue
                                ? 'bg-amber-200 text-amber-900'
                                : 'bg-slate-100 text-slate-700'
                          }`}>
                            {idx + 1}
                          </span>
                          <div className="overflow-hidden">
                            <span className="font-mono text-xs font-bold text-slate-900 block truncate">
                              {mac}
                            </span>
                            <span className={`text-[10px] font-semibold block ${
                              temFoto 
                                ? 'text-emerald-700' 
                                : isNaoEntregue
                                  ? 'text-amber-800'
                                  : 'text-slate-400'
                            }`}>
                              {temFoto 
                                ? '✓ Recolhido (com foto)' 
                                : isNaoEntregue
                                  ? '⚠️ Não entregue pelo cliente'
                                  : 'Pendente de definição'}
                            </span>
                          </div>
                        </div>

                        {/* Duas Ações Claras: [Não Entregue] e [Tirar/Alterar Foto] */}
                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {/* Botão [Não Entregue] com estilo toggle/badge */}
                          <button
                            type="button"
                            onClick={() => handleToggleNaoEntregue(eqId)}
                            disabled={salvando}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                              isNaoEntregue
                                ? 'bg-amber-500 text-white shadow-xs border border-amber-600'
                                : 'bg-slate-100 text-slate-600 hover:bg-amber-100 hover:text-amber-900 border border-slate-200'
                            }`}
                          >
                            <span>Não Entregue</span>
                          </button>

                          {/* Botão [Tirar Foto] / [Alterar Foto] */}
                          <label className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-2xs ${
                            temFoto
                              ? 'bg-emerald-100 text-emerald-900 hover:bg-emerald-200 border border-emerald-300'
                              : 'bg-emerald-600 text-white hover:bg-emerald-700 active:scale-95'
                          }`}>
                            {isComprimindoEste ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span>Processando...</span>
                              </>
                            ) : (
                              <>
                                <Camera className="w-3.5 h-3.5" />
                                <span>{temFoto ? 'Alterar Foto' : 'Tirar Foto'}</span>
                              </>
                            )}
                            <input
                              type="file"
                              accept="image/*"
                              capture="environment"
                              disabled={salvando}
                              onChange={(e) => handleCapturaFoto(eqId, e)}
                              className="hidden"
                            />
                          </label>
                        </div>
                      </div>

                      {/* 1. Preview Visual da Thumbnail instantânea com w-full h-40 */}
                      {fotos[eqId]?.previewUrl && (
                        <div className="mt-2.5 pt-2 border-t border-slate-100">
                          <div className="relative">
                            <img
                              src={fotos[eqId]?.previewUrl}
                              alt={`Foto do equipamento ${mac}`}
                              className="w-full h-40 object-cover rounded-lg border mt-2 shadow-xs"
                            />
                            <button
                              type="button"
                              onClick={() => handleRemoverFotoEquipamento(eqId)}
                              disabled={salvando}
                              className="absolute top-3 right-3 p-1.5 bg-black/60 hover:bg-red-600 text-white rounded-lg transition-colors backdrop-blur-xs cursor-pointer"
                              title="Remover foto deste equipamento"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          <p className="text-[11px] text-emerald-700 font-medium mt-1">
                            ✓ Foto vinculada a este equipamento
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Botão para adicionar equipamento extra não listado na O.S. */}
                <button
                  type="button"
                  onClick={handleAdicionarAparelhoExtra}
                  className="w-full py-2 px-3 border border-dashed border-emerald-400 bg-white/70 hover:bg-emerald-50 text-emerald-800 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Adicionar Aparelho Extra Recolhido</span>
                </button>
              </div>

              {/* Botões de Ação do Formulário de Sucesso */}
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={!podeConcluir}
                  className={`flex-1 py-3 px-4 text-white font-bold text-sm rounded-xl shadow transition-all ${
                    podeConcluir
                      ? 'bg-action-success hover:opacity-95 active:scale-98 cursor-pointer' 
                      : 'bg-slate-300 cursor-not-allowed opacity-70'
                  }`}
                >
                  {salvando 
                    ? 'Salvando...' 
                    : !todosEquipamentosDefinidos 
                      ? `Defina todos os itens (${equipamentosDefinidosQtd}/${totalEquipamentos})` 
                      : 'Concluir O.S.'}
                </button>
                <button
                  type="button"
                  onClick={() => mudarAba('detalhes')}
                  disabled={salvando}
                  className="py-3 px-4 bg-slate-200 text-slate-700 font-semibold text-sm rounded-xl hover:bg-slate-300 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}

          {/* Formulário Condicional: Visita Improdutiva (Falha) - Aba 'improdutiva' */}
          {abaAtiva === 'improdutiva' && (
            <form onSubmit={handleRegistrarImprodutiva} className="p-4 bg-red-50 rounded-xl border border-red-200 space-y-3 animate-in fade-in">
              <h3 className="text-sm font-bold text-red-950 flex items-center gap-1.5">
                <XCircle className="w-4 h-4 text-action-danger" />
                Registrar Visita Improdutiva
              </h3>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Motivo da improdutiva
                </label>
                <select
                  value={motivoImprodutiva}
                  onChange={(e) => setMotivoImprodutiva(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm font-medium focus:outline-none focus:ring-2 focus:ring-action-danger"
                >
                  <option value="Cliente ausente">Cliente ausente</option>
                  <option value="Endereço não encontrado">Endereço não encontrado</option>
                  <option value="Equipamento não localizado">Equipamento não localizado</option>
                  <option value="Outro">Outro</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Observação do Técnico {motivoImprodutiva === 'Outro' && <span className="text-red-600">*</span>}
                </label>
                <textarea
                  rows="3"
                  required={motivoImprodutiva === 'Outro'}
                  placeholder={motivoImprodutiva === 'Outro' ? 'Descreva obrigatoriamente o motivo...' : 'Observação adicional (opcional)...'}
                  value={obsTecnico}
                  onChange={(e) => setObsTecnico(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-action-danger"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={salvando}
                  className="flex-1 py-3 px-4 bg-action-danger text-white font-bold text-sm rounded-xl shadow hover:opacity-95 active:scale-98 transition-all cursor-pointer"
                >
                  {salvando ? 'Registrando...' : 'Registrar Falha'}
                </button>
                <button
                  type="button"
                  onClick={() => mudarAba('detalhes')}
                  disabled={salvando}
                  className="py-3 px-4 bg-slate-200 text-slate-700 font-semibold text-sm rounded-xl hover:bg-slate-300 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}

          {/* Exibição de Fotos e Resolução para O.S. Concluída ou Improdutiva */}
          {os.status && os.status !== 'PENDENTE' && (
            <div className="space-y-3 pt-2">
              <div className={`p-3.5 rounded-xl border text-xs font-bold space-y-1.5 ${
                os.status === 'CONCLUIDA'
                  ? 'bg-emerald-50 text-emerald-950 border-emerald-200'
                  : 'bg-red-50 text-red-950 border-red-200'
              }`}>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-sm">
                    {os.status === 'CONCLUIDA' ? (
                      <CheckCircle className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-600" />
                    )}
                    {os.status === 'CONCLUIDA' ? 'O.S. Concluída' : 'Visita Improdutiva'}
                  </span>
                  {os.sincronizado || os.status_sincronizacao === 'sincronizado' ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                      <Cloud className="w-3 h-3 text-blue-600" />
                      Enviado para a nuvem
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                      Pendente de Sincronização
                    </span>
                  )}
                </div>

                {os.motivo_improdutiva && (
                  <p className="text-xs text-red-800 font-medium">
                    Motivo: <span className="font-bold">{os.motivo_improdutiva}</span>
                  </p>
                )}

                {os.observacao_tecnico && (
                  <p className="text-xs text-slate-700 font-normal">
                    Obs: {os.observacao_tecnico}
                  </p>
                )}
              </div>

              {/* Miniaturas de fotos anexadas ou URLs públicas da nuvem */}
              {fotosConcluidaUrls.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-xs font-bold text-slate-700">Fotos Registradas</span>
                  <div className="grid grid-cols-2 gap-2">
                    {fotosConcluidaUrls.map((src, idx) => (
                      <img
                        key={idx}
                        src={src}
                        alt={`Registro ${idx + 1}`}
                        className="w-full h-24 object-cover rounded-lg border border-slate-300 shadow-2xs"
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Rodapé: Botões de Ação Principal (apenas na aba 'detalhes' de O.S. PENDENTE) */}
        {abaAtiva === 'detalhes' && (!os.status || os.status === 'PENDENTE') && (
          <div className="p-4 border-t border-slate-100 bg-slate-50 flex flex-col gap-2.5">
            <button
              type="button"
              onClick={() => mudarAba('concluir')}
              className="w-full py-3.5 px-4 bg-action-success text-white font-bold text-base rounded-xl shadow-md hover:opacity-95 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <CheckCircle className="w-5 h-5" />
              <span>Finalizar O.S.</span>
            </button>

            <button
              type="button"
              onClick={handleAbrirImprodutiva}
              className="w-full py-3.5 px-4 bg-action-danger text-white font-bold text-base rounded-xl shadow-md hover:opacity-95 active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <XCircle className="w-5 h-5" />
              <span>Visita Improdutiva</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
