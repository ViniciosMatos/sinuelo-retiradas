import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '../../supabase';
import { getTodayBR } from '../../utils/dateUtils';
import {
  FileSpreadsheet,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  FileCheck,
  Layers,
  Calendar,
  User
} from 'lucide-react';

export default function ImportarPlanilha() {
  const [arquivo, setArquivo] = useState(null);
  const [processando, setProcessando] = useState(false);
  const [progresso, setProgresso] = useState('');
  const [resultado, setResultado] = useState(null);
  const [erro, setErro] = useState('');
  const [importacaoAdicional, setImportacaoAdicional] = useState(false);

  // Campos de alocação de agenda
  const hoje = getTodayBR();
  const [dataAgendada, setDataAgendada] = useState(hoje);
  const [tecnicoId, setTecnicoId] = useState('');
  const [tecnicos, setTecnicos] = useState([]);
  const [carregandoTecnicos, setCarregandoTecnicos] = useState(true);

  // Busca técnicos ativos no Supabase
  useEffect(() => {
    async function fetchTecnicos() {
      try {
        const { data, error } = await supabase
          .from('usuarios')
          .select('id, nome, email')
          .eq('role', 'TECNICO')
          .eq('ativo', true)
          .order('nome');
        if (!error && data) {
          setTecnicos(data);
          if (data.length > 0) setTecnicoId(data[0].id);
        }
      } catch (e) {
        console.error('Erro ao buscar técnicos:', e);
      } finally {
        setCarregandoTecnicos(false);
      }
    }
    fetchTecnicos();
  }, []);

  // Função auxiliar para encontrar valor da coluna de forma flexível (case-insensitive)
  const getVal = (linha, aliases) => {
    for (const key of aliases) {
      if (linha[key] !== undefined && linha[key] !== null && String(linha[key]).trim() !== '') {
        return String(linha[key]).trim();
      }
      const encontrada = Object.keys(linha).find(
        (k) => k.trim().toLowerCase().replace(/[\s_]/g, '') === key.toLowerCase().replace(/[\s_]/g, '')
      );
      if (encontrada && linha[encontrada] !== undefined && linha[encontrada] !== null && String(linha[encontrada]).trim() !== '') {
        return String(linha[encontrada]).trim();
      }
    }
    return '';
  };

  const handleArquivoChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setArquivo(file);
      setResultado(null);
      setErro('');
    }
  };

  // Passo 3 & 4: Leitura com FileReader e Inserção no Supabase
  const handleProcessarPlanilha = async (e) => {
    e.preventDefault();
    if (!arquivo) {
      setErro('Por favor, selecione um arquivo Excel (.xlsx ou .xls).');
      return;
    }
    if (!dataAgendada) {
      setErro('Por favor, selecione a Data da Agenda.');
      return;
    }
    if (!tecnicoId) {
      setErro('Por favor, selecione um técnico.');
      return;
    }

    setProcessando(true);
    setErro('');
    setResultado(null);
    setProgresso('Lendo arquivo Excel...');

    try {
      const reader = new FileReader();

      reader.onload = async (evento) => {
        try {
          const data = new Uint8Array(evento.target.result);
          // Passo 3: Leitura com SheetJS
          const workbook = XLSX.read(data, { type: 'array', cellDates: true });
          const primeiraAba = workbook.Sheets[workbook.SheetNames[0]];
          const linhas = XLSX.utils.sheet_to_json(primeiraAba);

          if (!linhas || linhas.length === 0) {
            setErro('A planilha está vazia ou não contém dados válidos.');
            setProcessando(false);
            return;
          }

          // Ajuste 1: normaliza todas as chaves do objeto para minúsculo
          const linhasNormalizadas = linhas.map(row =>
            Object.fromEntries(Object.entries(row).map(([k, v]) => [k.toLowerCase(), v]))
          );

          setProgresso(`Processando ${linhasNormalizadas.length} linhas da planilha...`);

          let ordensCriadas = 0;
          let ordensRemarcadas = 0;
          let ordensExistentes = 0;
          let equipamentosInseridos = 0;
          const mapaOsIds = new Map();       // numero_os -> uuid
          const osProcessadas = new Set();   // deduplicação intra-lote

          // Loop assíncrono com try/catch individual por linha
          for (let i = 0; i < linhasNormalizadas.length; i++) {
            const linha = linhasNormalizadas[i];
            setProgresso(`Processando linha ${i + 1} de ${linhasNormalizadas.length}...`);

            let numeroOs;
            try {
              numeroOs = getVal(linha, ['numero_os', 'num_os', 'numero da os', 'os']);
              if (!numeroOs) {
                console.warn(`Linha ${i + 1} ignorada: sem numero_os. Chaves:`, Object.keys(linha).join(', '));
                continue;
              }

              // Deduplicação intra-lote: ignora linhas repetidas do próprio Excel
              if (osProcessadas.has(numeroOs)) {
                // Linha duplicada de equipamento — pula direto para processar MACs com id já no mapa
              } else {
                osProcessadas.add(numeroOs);
              }

              let osId = mapaOsIds.get(numeroOs);

              if (!osId) {
                // --- Campos de agendamento (usados em insert e em update de remarcação) ---
                const rawData = getVal(linha, ['dia', 'data', 'data_agendada']);
                let dataFormatada = null;
                if (rawData) {
                  const rawBruto = linha['dia'] ?? linha['data'] ?? linha['data_agendada'];
                  if (rawBruto instanceof Date) {
                    const y = rawBruto.getFullYear();
                    const m = String(rawBruto.getMonth() + 1).padStart(2, '0');
                    const d = String(rawBruto.getDate()).padStart(2, '0');
                    dataFormatada = `${y}-${m}-${d}`;
                  } else if (typeof rawBruto === 'number') {
                    const epoch = new Date(Date.UTC(1899, 11, 30) + rawBruto * 86400000);
                    const y = epoch.getUTCFullYear();
                    const m = String(epoch.getUTCMonth() + 1).padStart(2, '0');
                    const d = String(epoch.getUTCDate()).padStart(2, '0');
                    dataFormatada = `${y}-${m}-${d}`;
                  } else if (typeof rawBruto === 'string' && rawBruto.trim()) {
                    const partes = rawBruto.trim().split(/[\/\-]/);
                    if (partes.length === 3) {
                      const [a, b, c] = partes;
                      dataFormatada = a.length === 4
                        ? rawBruto.trim()
                        : `${c}-${b.padStart(2, '0')}-${a.padStart(2, '0')}`;
                    }
                  }
                }

                let horarioFormatado = null;
                const rawHorario = linha.horario_marcado;
                if (rawHorario) {
                  if (rawHorario instanceof Date) {
                    const h = String(rawHorario.getHours()).padStart(2, '0');
                    const min = String(rawHorario.getMinutes()).padStart(2, '0');
                    horarioFormatado = `${h}:${min}`;
                  } else if (typeof rawHorario === 'number') {
                    const totalMinutes = Math.round(rawHorario * 24 * 60);
                    const h = String(Math.floor(totalMinutes / 60) % 24).padStart(2, '0');
                    const min = String(totalMinutes % 60).padStart(2, '0');
                    horarioFormatado = `${h}:${min}`;
                  } else if (typeof rawHorario === 'string') {
                    const match = rawHorario.match(/(\d{1,2}:\d{2})/);
                    horarioFormatado = match ? match[0] : rawHorario;
                  }
                }

                // Verificação no Supabase: busca id e status da OS
                const { data: osExistente, error: erroBusca } = await supabase
                  .from('ordens_servico')
                  .select('id, status')
                  .eq('numero_os', numeroOs)
                  .maybeSingle();

                if (erroBusca) {
                  console.error(`Erro ao verificar OS ${numeroOs}:`, erroBusca);
                }

                if (osExistente?.id) {
                  osId = osExistente.id;

                  if (osExistente.status === 'PENDENTE') {
                    // Remarcação: atualiza dados de agendamento + alocação do formulário
                    const payloadRemarcacao = {
                      data_agendada: dataAgendada,
                      tecnico_id: tecnicoId,
                      turno: linha.turno || null,
                      horario_marcado: horarioFormatado,
                      observacao_cliente: linha.observacao_do_cliente || null,
                      ordem_importacao: i + 1,
                    };
                    // Remove nulos para não sobreescrever campos com null desnecessariamente
                    Object.keys(payloadRemarcacao).forEach((k) => {
                      if (payloadRemarcacao[k] === null || payloadRemarcacao[k] === undefined) {
                        delete payloadRemarcacao[k];
                      }
                    });

                    const { error: erroUpdate } = await supabase
                      .from('ordens_servico')
                      .update(payloadRemarcacao)
                      .eq('id', osId);

                    if (erroUpdate) {
                      console.error(`Erro ao remarcar OS ${numeroOs}:`, erroUpdate);
                    } else {
                      ordensRemarcadas++;
                    }
                  } else {
                    // Já concluída/improdutiva — não toca
                    ordensExistentes++;
                  }
                } else {
                  // OS nova — insert completo
                  const payloadOS = {
                    numero_os: numeroOs,
                    cliente_nome: linha.nome_cliente || 'Sem nome',
                    endereco: linha.endereco || 'Sem endereço',
                    bairro: linha.bairro || 'Sem bairro',
                    cidade: linha.cidade || 'Sem cidade',
                    telefone_1: String(linha.contato_1 || ''),
                    telefone_2: String(linha.contato_2 || ''),
                    link_maps: linha.maps_link || null,
                    observacao_cliente: linha.observacao_do_cliente || null,
                    data_agendada: dataAgendada,
                    tecnico_id: tecnicoId,
                    turno: linha.turno || null,
                    horario_marcado: horarioFormatado,
                    status: 'PENDENTE',
                    ordem_importacao: i + 1,
                    is_nova: importacaoAdicional ? true : null,
                  };

                  // Remove chaves nulas/vazias
                  Object.keys(payloadOS).forEach((key) => {
                    if (payloadOS[key] === null || payloadOS[key] === undefined || payloadOS[key] === '') {
                      delete payloadOS[key];
                    }
                  });
                  payloadOS.numero_os = numeroOs;
                  payloadOS.status = 'PENDENTE';

                  const insertRes = await supabase
                    .from('ordens_servico')
                    .insert([payloadOS])
                    .select()
                    .single();

                  if (insertRes.error) {
                    console.error(`Erro na OS ${numeroOs}:`, insertRes.error);
                    continue;
                  }

                  osId = insertRes.data?.id;
                  ordensCriadas++;
                }

                if (osId) {
                  mapaOsIds.set(numeroOs, osId);
                }
              }

              // Processa MACs — verifica duplicata antes de inserir
              if (osId) {
                const macsRaw = linha.mac_aparelho ? String(linha.mac_aparelho) : null;

                if (macsRaw) {
                  const listaMacs = macsRaw.split(',').map((m) => m.trim()).filter(Boolean);

                  for (const mac of listaMacs) {
                    const { data: macExistente } = await supabase
                      .from('equipamentos')
                      .select('id')
                      .eq('os_id', osId)
                      .eq('mac_esperado', mac)
                      .maybeSingle();

                    if (!macExistente) {
                      const { error: erroMac } = await supabase
                        .from('equipamentos')
                        .insert([{ os_id: osId, mac_esperado: mac, recolhido: false }]);

                      if (!erroMac) {
                        equipamentosInseridos++;
                      } else {
                        console.error(`Erro ao inserir MAC ${mac} para OS ${numeroOs}:`, erroMac);
                      }
                    }
                  }
                }
              }

            } catch (linhaErr) {
              console.error(`Erro ao processar linha ${i + 1} (OS: ${numeroOs || 'desconhecida'}):`, linhaErr);
            }
          }


          setResultado({
            sucesso: true,
            totalOS: ordensCriadas,
            totalRemarcadas: ordensRemarcadas,
            totalEquip: equipamentosInseridos,
            ignoradas: ordensExistentes,
            mensagem: `Importação concluída! ${ordensCriadas} nova(s) O.S., ${ordensRemarcadas} remarcada(s), ${equipamentosInseridos} equipamento(s)${ordensExistentes > 0 ? ` (${ordensExistentes} já concluídas, ignoradas).` : '.'}`
          });
        } catch (procErr) {
          console.error('Erro no processamento das linhas:', procErr);
          setErro(`Erro ao processar dados da planilha: ${procErr.message}`);
        } finally {
          setProcessando(false);
          setProgresso('');
        }
      };

      reader.onerror = () => {
        setErro('Falha ao ler o arquivo selecionado.');
        setProcessando(false);
        setProgresso('');
      };

      reader.readAsArrayBuffer(arquivo);
    } catch (err) {
      console.error('Erro na leitura do arquivo:', err);
      setErro('Erro inesperado ao processar arquivo.');
      setProcessando(false);
      setProgresso('');
    }
  };

  return (
    <div className="bg-white p-6 sm:p-8 rounded-2xl shadow-xs border border-slate-200 max-w-2xl mx-auto space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
        <div className="w-12 h-12 rounded-xl bg-blue-50 text-brand flex items-center justify-center shadow-xs">
          <FileSpreadsheet className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-800">
            Importar Planilha de O.S.
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 font-medium">
            Carregue o arquivo Excel (.xlsx ou .xls) para cadastrar ordens e equipamentos no Supabase.
          </p>
        </div>
      </div>

      {/* Formulário de Upload */}
      <form onSubmit={handleProcessarPlanilha} className="space-y-5">
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
            Arquivo Excel (.xlsx, .xls)
          </label>
          <div className="relative border-2 border-dashed border-slate-300 hover:border-brand rounded-2xl p-6 text-center cursor-pointer transition-colors bg-slate-50 hover:bg-blue-50/30">
            <input
              type="file"
              accept=".xlsx, .xls"
              onChange={handleArquivoChange}
              disabled={processando}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div className="flex flex-col items-center gap-2">
              <UploadCloud className="w-10 h-10 text-slate-400" />
              {arquivo ? (
                <div className="flex items-center gap-2 text-sm font-bold text-brand">
                  <FileCheck className="w-4 h-4 text-action-success" />
                  <span>{arquivo.name} ({(arquivo.size / 1024).toFixed(1)} KB)</span>
                </div>
              ) : (
                <>
                  <p className="text-sm font-semibold text-slate-700">
                    Clique para selecionar ou arraste o arquivo aqui
                  </p>
                  <p className="text-xs text-slate-400">
                    Formatos aceitos: Microsoft Excel (.xlsx, .xls)
                  </p>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Campos de Alocação: Data e Técnico */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Data da Agenda */}
          <div>
            <label htmlFor="data-agendada" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-brand" />
              Data da Agenda <span className="text-red-500">*</span>
            </label>
            <input
              id="data-agendada"
              type="date"
              value={dataAgendada}
              onChange={(e) => setDataAgendada(e.target.value)}
              required
              disabled={processando}
              className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm font-medium text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition-colors disabled:opacity-60"
            />
          </div>

          {/* Técnico */}
          <div>
            <label htmlFor="tecnico-select" className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-brand" />
              Técnico <span className="text-red-500">*</span>
            </label>
            {carregandoTecnicos ? (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-400">
                <Loader2 className="w-4 h-4 animate-spin" /> Carregando técnicos...
              </div>
            ) : tecnicos.length === 0 ? (
              <div className="px-3 py-2.5 rounded-xl border border-amber-200 bg-amber-50 text-xs font-semibold text-amber-700">
                ⚠️ Nenhum técnico cadastrado com perfil TECNICO e ativo.
              </div>
            ) : (
              <select
                id="tecnico-select"
                value={tecnicoId}
                onChange={(e) => setTecnicoId(e.target.value)}
                required
                disabled={processando}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-sm font-medium text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition-colors disabled:opacity-60"
              >
                <option value="">Selecione um técnico...</option>
                {tecnicos.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nome || t.email}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Importação Adicional */}
        <label className="flex items-start gap-3 cursor-pointer p-3.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-blue-50/40 transition-colors">
          <input
            type="checkbox"
            id="importacao-adicional"
            checked={importacaoAdicional}
            onChange={(e) => setImportacaoAdicional(e.target.checked)}
            disabled={processando}
            className="mt-0.5 w-4 h-4 accent-brand cursor-pointer flex-shrink-0"
          />
          <div>
            <p className="text-sm font-bold text-slate-700">Importação Adicional</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Marque se já existem O.S. cadastradas hoje. As novas serão marcadas com o selo “NOVA” na tela do técnico.
            </p>
          </div>
        </label>

        {/* Mensagem de Erro */}
        {erro && (
          <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2.5 text-xs font-semibold text-red-700">
            <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
            <span>{erro}</span>
          </div>
        )}

        {/* Mensagem de Progresso */}
        {processando && (
          <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-xl flex items-center gap-2.5 text-xs font-semibold text-blue-800">
            <Loader2 className="w-4 h-4 text-brand animate-spin flex-shrink-0" />
            <span>{progresso || 'Processando planilha...'}</span>
          </div>
        )}

        {/* Mensagem de Sucesso */}
        {resultado && (
          <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl space-y-2">
            <div className="flex items-center gap-2 text-sm font-bold text-emerald-950">
              <CheckCircle2 className="w-5 h-5 text-action-success flex-shrink-0" />
              <span>{resultado.mensagem}</span>
            </div>
            <div className="grid grid-cols-4 gap-2 pt-2 border-t border-emerald-200 text-center">
              <div className="bg-white p-2 rounded-lg border border-emerald-100">
                <p className="text-[10px] font-bold text-slate-500 uppercase">Novas O.S.</p>
                <p className="text-base font-black text-emerald-700">{resultado.totalOS}</p>
              </div>
              <div className="bg-white p-2 rounded-lg border border-amber-100">
                <p className="text-[10px] font-bold text-slate-500 uppercase">Remarcadas</p>
                <p className="text-base font-black text-amber-600">{resultado.totalRemarcadas ?? 0}</p>
              </div>
              <div className="bg-white p-2 rounded-lg border border-emerald-100">
                <p className="text-[10px] font-bold text-slate-500 uppercase">Equipamentos</p>
                <p className="text-base font-black text-brand">{resultado.totalEquip}</p>
              </div>
              <div className="bg-white p-2 rounded-lg border border-emerald-100">
                <p className="text-[10px] font-bold text-slate-500 uppercase">Ignoradas</p>
                <p className="text-base font-black text-slate-600">{resultado.ignoradas}</p>
              </div>
            </div>
          </div>
        )}

        {/* Botão de Ação */}
        <button
          type="submit"
          disabled={!arquivo || processando}
          className={`w-full py-3.5 px-4 text-white font-bold text-sm rounded-xl shadow-md transition-all flex items-center justify-center gap-2 ${arquivo && !processando
            ? 'bg-brand hover:bg-brand-light active:scale-[0.99] cursor-pointer'
            : 'bg-slate-300 cursor-not-allowed opacity-70'
            }`}
        >
          {processando ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Processando Planilha...</span>
            </>
          ) : (
            <>
              <Layers className="w-4 h-4" />
              <span>Processar Planilha</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}
