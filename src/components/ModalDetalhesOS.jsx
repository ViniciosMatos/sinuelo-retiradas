import React, { useState, useEffect } from 'react';
import imageCompression from 'browser-image-compression';
import { db } from '../db/db';
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
  Cloud
} from 'lucide-react';

export default function ModalDetalhesOS({ os, onClose }) {
  if (!os) return null;

  // Estados dos fluxos secundários
  const [fluxoAtivo, setFluxoAtivo] = useState(null); // 'SUCESSO' | 'IMPRODUTIVA' | null
  
  // Fluxo de Sucesso - Fotos (Array de File/Blob)
  const [fotos, setFotos] = useState([]); // File/Blob[]
  const [comprimindo, setComprimindo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [equipamentosPrevistos, setEquipamentosPrevistos] = useState([]);

  // Fluxo de Improdutiva
  const [motivoImprodutiva, setMotivoImprodutiva] = useState('Cliente ausente');
  const [obsTecnico, setObsTecnico] = useState('');

  // Endereço e Google Maps
  const enderecoCompleto = `${os.endereco || ''}${os.bairro ? ` - ${os.bairro}` : ''}${os.cidade ? `, ${os.cidade}` : ''}`;
  const mapsUrl = os.link_maps || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(enderecoCompleto)}`;
  
  // Lista de Contatos (CONTATO_1 e CONTATO_2)
  const listaContatos = [];
  const c1 = os.contato_1 || os.CONTATO_1 || os.contato;
  const c2 = os.contato_2 || os.CONTATO_2;
  if (c1 && String(c1).trim()) listaContatos.push(String(c1).trim());
  if (c2 && String(c2).trim() && String(c2).trim() !== String(c1).trim()) listaContatos.push(String(c2).trim());

  const obsCliente = os.observacao_cliente || os.obs_cliente;

  // Carrega quantidade de equipamentos previstos da OS no Dexie
  useEffect(() => {
    let ativo = true;
    async function carregarEquipamentos() {
      if (!os?.id) return;
      try {
        const os_id = os.id;
        let items = await db.equipamentos.where({ os_id }).toArray();
        if ((!items || items.length === 0) && typeof os_id === 'string' && !isNaN(Number(os_id))) {
          items = await db.equipamentos.where({ os_id: Number(os_id) }).toArray();
        }
        if (ativo) {
          setEquipamentosPrevistos(items || []);
        }
      } catch (err) {
        console.error('Erro ao buscar equipamentos previstos no Dexie:', err);
      }
    }
    carregarEquipamentos();
    return () => { ativo = false; };
  }, [os?.id]);

  // Passo 1: Fim do Base64 (Adoção de Blob)
  const handleFotoChange = async (file) => {
    if (!file) return;

    try {
      setComprimindo(true);
      const options = {
        maxSizeMB: 0.2,
        maxWidthOrHeight: 1024,
        useWebWorker: true,
      };

      const compressedFile = await imageCompression(file, options);
      // Salva o próprio objeto File/Blob retornado diretamente no array do estado
      setFotos((prev) => [...prev, compressedFile]);
    } catch (err) {
      console.error('Erro na compressão da foto:', err);
      alert('Falha ao processar foto. Tente novamente.');
    } finally {
      setComprimindo(false);
    }
  };

  const handleRemoverFoto = (indexRemover) => {
    setFotos((prev) => prev.filter((_, idx) => idx !== indexRemover));
  };

  // Passo 3: A Lógica de Triagem (Malha Fina)
  const handleSalvarConclusao = async (e) => {
    e.preventDefault();
    if (fotos.length === 0 || comprimindo || salvando) return;

    try {
      setSalvando(true);

      const os_id = os.id;
      let previstos = await db.equipamentos.where({ os_id }).toArray();
      if ((!previstos || previstos.length === 0) && typeof os_id === 'string' && !isNaN(Number(os_id))) {
        previstos = await db.equipamentos.where({ os_id: Number(os_id) }).toArray();
      }
      previstos = previstos || [];

      // CENÁRIO A (Triagem Automática): Se equipamentosPrevistos.length === 1 E fotos.length === 1
      if (previstos.length === 1 && fotos.length === 1) {
        await db.ordens_servico.update(os.id, {
          status: 'CONCLUIDA',
          requer_verificacao: false,
          fotos_recolhimento: fotos,
          data_finalizacao: new Date().toISOString()
        });

        if (previstos[0]?.id !== undefined) {
          await db.equipamentos.update(previstos[0].id, {
            foi_recolhido: true
          });
        }
      } 
      // CENÁRIO B (Requer Auditoria do Admin): Se equipamentosPrevistos.length === 1 E fotos.length > 1, OU se equipamentosPrevistos.length >= 2 (ou fallback)
      else {
        await db.ordens_servico.update(os.id, {
          status: 'CONCLUIDA',
          requer_verificacao: true,
          fotos_recolhimento: fotos,
          data_finalizacao: new Date().toISOString()
        });
        // NÃO altera nada na db.equipamentos (mantém foi_recolhido: false)
      }

      onClose();
    } catch (err) {
      console.error('Erro ao finalizar O.S.:', err);
      alert('Falha ao salvar conclusão da O.S.');
    } finally {
      setSalvando(false);
    }
  };

  const handleRegistrarImprodutiva = async (e) => {
    e.preventDefault();
    if (motivoImprodutiva === 'Outro' && !obsTecnico.trim()) {
      alert('Observação obrigatória ao selecionar o motivo "Outro".');
      return;
    }

    try {
      await db.ordens_servico.update(os.id, {
        status: 'IMPRODUTIVA',
        motivo_improdutiva: motivoImprodutiva,
        observacao_tecnico: obsTecnico.trim(),
        data_finalizacao: new Date().toISOString()
      });
      onClose();
    } catch (err) {
      console.error('Erro ao registrar improdutiva:', err);
    }
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
            onClick={onClose}
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
              {os.cliente || 'Nome não informado'}
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
          {listaContatos.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Contatos do Cliente
              </div>
              <div className="space-y-2">
                {listaContatos.map((numero, idx) => {
                  const cleanNum = numero.replace(/\D/g, '');
                  return (
                    <div 
                      key={idx}
                      className="flex items-center justify-between p-2.5 bg-slate-50 rounded-xl border border-slate-200"
                    >
                      <span className="text-sm font-semibold text-slate-800">
                        {numero}
                      </span>
                      <div className="flex items-center gap-2">
                        {/* Botão Discador Nativo */}
                        <a
                          href={`tel:${cleanNum}`}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-xs font-bold hover:bg-blue-100 active:scale-95 transition-all"
                          title="Ligar para cliente"
                        >
                          <Phone className="w-3.5 h-3.5" />
                          <span>Ligar</span>
                        </a>

                        {/* Botão WhatsApp */}
                        <a
                          href={`https://wa.me/55${cleanNum}?text=${encodeURIComponent(`Olá, sou o técnico da Sinuelo referente à retirada da O.S. ${os.numero_os}.`)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold hover:bg-emerald-100 active:scale-95 transition-all"
                          title="Abrir WhatsApp"
                        >
                          <MessageCircle className="w-3.5 h-3.5" />
                          <span>WhatsApp</span>
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Destaque de Observações da OS: Posicionado logo acima dos botões de ação */}
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

          {/* Formulário Condicional: Finalizar OS (Sucesso) */}
          {fluxoAtivo === 'SUCESSO' && (
            <form onSubmit={handleSalvarConclusao} className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 space-y-4 animate-in fade-in">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-emerald-950 flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4 text-action-success" />
                  Finalização de Recolhimento
                </h3>
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-white text-slate-700 border border-emerald-200">
                  Previstos: {equipamentosPrevistos.length}
                </span>
              </div>

              {/* Status Informativo da Triagem (Malha Fina) */}
              <div className="p-2.5 bg-white rounded-lg border border-emerald-200 text-xs">
                {equipamentosPrevistos.length === 1 && fotos.length === 1 ? (
                  <span className="text-emerald-700 font-bold flex items-center gap-1">
                    ✓ Triagem Automática (1 previsto, 1 foto)
                  </span>
                ) : fotos.length > 0 ? (
                  <span className="text-amber-700 font-bold flex items-center gap-1">
                    ℹ Requer Auditoria do Admin ({equipamentosPrevistos.length} previstos, {fotos.length} fotos)
                  </span>
                ) : (
                  <span className="text-slate-500 font-medium">
                    Tire ao menos 1 foto dos aparelhos recolhidos para salvar.
                  </span>
                )}
              </div>

              {/* Botão de Câmera / Anexar Fotos */}
              <div>
                <label className="w-full flex items-center justify-center gap-2 px-3 py-3 bg-white border-2 border-dashed border-emerald-400 rounded-xl cursor-pointer text-emerald-800 text-xs font-bold hover:bg-emerald-100/50 active:scale-98 transition-all shadow-xs">
                  {comprimindo ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-emerald-700" />
                      <span>Comprimindo foto...</span>
                    </>
                  ) : (
                    <>
                      <Camera className="w-4 h-4 text-emerald-700" />
                      <span>{fotos.length === 0 ? 'Tirar Foto do Aparelho (Câmera)' : 'Adicionar Mais Fotos'}</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    disabled={comprimindo}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFotoChange(file);
                      e.target.value = '';
                    }}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Passo 2: Preview da Imagem com URL.createObjectURL(fotoBlob) */}
              {fotos.length > 0 && (
                <div className="space-y-2">
                  <span className="block text-xs font-bold text-slate-700">
                    Fotos Anexadas ({fotos.length})
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {fotos.map((fotoBlob, index) => (
                      <div 
                        key={index} 
                        className="relative p-2 bg-white rounded-lg border border-slate-200 flex flex-col items-center gap-1.5 shadow-xs"
                      >
                        <img 
                          src={URL.createObjectURL(fotoBlob)} 
                          alt={`Preview Foto ${index + 1}`} 
                          className="w-full h-24 rounded object-cover border border-slate-200"
                        />
                        <div className="w-full flex items-center justify-between text-[11px] font-semibold text-slate-600 px-1">
                          <span>Foto {index + 1}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoverFoto(index)}
                            className="p-1 text-red-500 hover:text-red-700 rounded hover:bg-red-50 transition-colors"
                            title="Remover foto"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Botões de Ação do Formulário de Sucesso */}
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={fotos.length === 0 || comprimindo || salvando}
                  className={`flex-1 py-3 px-4 text-white font-bold text-sm rounded-xl shadow transition-all ${
                    fotos.length > 0 && !comprimindo && !salvando
                      ? 'bg-action-success hover:opacity-95 active:scale-98 cursor-pointer' 
                      : 'bg-slate-300 cursor-not-allowed opacity-70'
                  }`}
                >
                  {salvando ? 'Salvando...' : fotos.length === 0 ? 'Anexe ao menos 1 foto para salvar' : 'Salvar Conclusão'}
                </button>
                <button
                  type="button"
                  onClick={() => setFluxoAtivo(null)}
                  className="py-3 px-4 bg-slate-200 text-slate-700 font-semibold text-sm rounded-xl hover:bg-slate-300 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}

          {/* Formulário Condicional: Visita Improdutiva (Falha) */}
          {fluxoAtivo === 'IMPRODUTIVA' && (
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
                  className="flex-1 py-3 px-4 bg-action-danger text-white font-bold text-sm rounded-xl shadow hover:opacity-95 active:scale-98 transition-all"
                >
                  Registrar Falha
                </button>
                <button
                  type="button"
                  onClick={() => setFluxoAtivo(null)}
                  className="py-3 px-4 bg-slate-200 text-slate-700 font-semibold text-sm rounded-xl hover:bg-slate-300 transition-colors"
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
                  {os.sincronizado ? (
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
              {((os.fotos_urls && os.fotos_urls.length > 0) || (os.fotos_recolhimento && os.fotos_recolhimento.length > 0)) && (
                <div className="space-y-1.5">
                  <span className="text-xs font-bold text-slate-700">Fotos Registradas</span>
                  <div className="grid grid-cols-2 gap-2">
                    {(os.fotos_urls || os.fotos_recolhimento).map((foto, idx) => {
                      const src = typeof foto === 'string' 
                        ? foto 
                        : (foto instanceof Blob ? URL.createObjectURL(foto) : '');
                      if (!src) return null;
                      return (
                        <img
                          key={idx}
                          src={src}
                          alt={`Registro ${idx + 1}`}
                          className="w-full h-24 object-cover rounded-lg border border-slate-300 shadow-2xs"
                        />
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Rodapé: Botões de Ação Principal (apenas para O.S. PENDENTE) */}
        {!fluxoAtivo && (!os.status || os.status === 'PENDENTE') && (
          <div className="p-4 border-t border-slate-100 bg-slate-50 flex flex-col gap-2.5">
            <button
              type="button"
              onClick={() => setFluxoAtivo('SUCESSO')}
              className="w-full py-3.5 px-4 bg-action-success text-white font-bold text-base rounded-xl shadow-md hover:opacity-95 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            >
              <CheckCircle className="w-5 h-5" />
              <span>Finalizar O.S.</span>
            </button>

            <button
              type="button"
              onClick={() => setFluxoAtivo('IMPRODUTIVA')}
              className="w-full py-3.5 px-4 bg-action-danger text-white font-bold text-base rounded-xl shadow-md hover:opacity-95 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
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
