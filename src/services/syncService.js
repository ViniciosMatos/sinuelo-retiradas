import { supabase } from '../supabase';
import { db } from '../db/db';

/**
 * Passo 1 - A) Baixa O.S. com status 'PENDENTE' do Supabase com Merge Inteligente no Dexie.js:
 * - Identifica O.S. locais pendentes de envio (sync_status === 'pendente', fotos/improdutivas locais).
 * - NUNCA sobrescreve nem apaga O.S. locais pendentes de sincronização.
 * - Adiciona novas O.S. não presentes no dispositivo.
 * - Atualiza apenas O.S. já totalmente sincronizadas.
 */
export async function baixarCargaDoDia() {
  if (!navigator.onLine) {
    throw new Error('Sem conexão com a internet para baixar tarefas.');
  }

  // 1. Busca ordens de serviço pendentes no Supabase, trazendo equipamentos relacionais
  const { data: ordens, error } = await supabase
    .from('ordens_servico')
    .select('*, equipamentos(*)')
    .eq('status', 'PENDENTE');

  if (error) {
    console.error('Erro ao buscar ordens pendentes no Supabase:', error);
    throw error;
  }

  if (!ordens || ordens.length === 0) {
    return { total: 0, ordens: [], novas: 0, atualizadas: 0, pendentesPreservadas: 0 };
  }

  // 2. Deduplicação in-memory de ordens remotas
  const dadosUnicos = ordens.reduce((acc, os) => {
    if (!acc.some((item) => item.numero_os === os.numero_os)) {
      acc.push(os);
    }
    return acc;
  }, []);

  // 3. Lê o banco local Dexie para mapear tarefas e identificar pendências de envio
  const todasLocais = await db.ordens_servico.toArray();

  const pendentesEnvioIds = new Set();
  const mapaLocaisPorId = new Map();
  const mapaLocaisPorNum = new Map();

  for (const local of todasLocais) {
    const isPendenteEnvio =
      local.status_sincronizacao === 'pendente' ||
      local.sync_status === 'pendente' ||
      (local.status && local.status !== 'PENDENTE' && !local.sincronizado) ||
      ((local.fotos_recolhimento && local.fotos_recolhimento.length > 0) && !local.sincronizado) ||
      (local.motivo_improdutiva && !local.sincronizado);

    if (isPendenteEnvio) {
      if (local.id !== undefined && local.id !== null) {
        pendentesEnvioIds.add(String(local.id));
      }
      if (local.numero_os) {
        pendentesEnvioIds.add(String(local.numero_os));
      }
    }

    if (local.id !== undefined && local.id !== null) {
      mapaLocaisPorId.set(String(local.id), local);
    }
    if (local.numero_os) {
      mapaLocaisPorNum.set(String(local.numero_os), local);
    }
  }

  // 4. Merge inteligente: NUNCA sobrescreve O.S. pendente; adiciona novas; atualiza apenas sincronizadas
  let novas = 0;
  let atualizadas = 0;
  let pendentesPreservadas = 0;

  for (const remota of dadosUnicos) {
    const isLocalPendente =
      (remota.id && pendentesEnvioIds.has(String(remota.id))) ||
      (remota.numero_os && pendentesEnvioIds.has(String(remota.numero_os)));

    // NUNCA sobrescreve ou apaga O.S. local que esteja pendente de sincronização
    if (isLocalPendente) {
      pendentesPreservadas++;
      continue;
    }

    const localExistente =
      (remota.id && mapaLocaisPorId.get(String(remota.id))) ||
      (remota.numero_os && mapaLocaisPorNum.get(String(remota.numero_os)));

    try {
      if (!localExistente) {
        // Nova O.S. vinda do Supabase ainda não presente no dispositivo
        await db.ordens_servico.put({
          ...remota,
          sync_status: 'synced',
          status_sincronizacao: 'synced',
        });
        novas++;
      } else {
        // O.S. já existente e totalmente sincronizada: atualiza dados mantendo a PK local
        await db.ordens_servico.put({
          ...localExistente,
          ...remota,
          id: localExistente.id, // preserva ID local caso numérico no Dexie
          sync_status: 'synced',
          status_sincronizacao: 'synced',
        });
        atualizadas++;
      }
    } catch (saveErr) {
      console.warn(`Erro ao sincronizar OS ${remota.numero_os} no Dexie:`, saveErr);
    }
  }

  // 5. Busca equipamentos previstos associados às OS baixadas
  try {
    const osIds = dadosUnicos.map((o) => o.id).filter(Boolean);
    if (osIds.length > 0) {
      const { data: equipamentos, error: eqError } = await supabase
        .from('equipamentos')
        .select('*')
        .in('os_id', osIds);

      if (!eqError && equipamentos && equipamentos.length > 0) {
        for (const eq of equipamentos) {
          try {
            const localEq = await db.equipamentos.get(eq.id);
            // Se já foi recolhido localmente, não sobrescreve
            if (localEq && (localEq.foi_recolhido || localEq.recolhido)) {
              continue;
            }
            await db.equipamentos.put(eq);
          } catch (errEq) {
            console.warn(`Erro ao salvar equipamento ${eq.id} no Dexie:`, errEq);
          }
        }
      }
    }
  } catch (eqErr) {
    console.warn('Aviso ao sincronizar equipamentos previstos:', eqErr);
  }

  return { 
    total: novas + atualizadas, 
    novas, 
    atualizadas, 
    pendentesPreservadas,
    ordens: dadosUnicos 
  };
}

let isSyncing = false;

/**
 * Passo 1 - B) Sincronização automática instantânea (orientada a eventos):
 * Se online, faz upload das fotos para Supabase Storage, atualiza Supabase PostgreSQL
 * e atualiza Dexie local para status_sincronizacao = 'sincronizado'.
 */
export async function sincronizarPendentes() {
  if (!navigator.onLine) {
    return { total: 0 };
  }

  if (isSyncing) {
    return { total: 0 };
  }

  isSyncing = true;

  try {
    // 1. Busca no Dexie tarefas pendentes de sincronização
    const tarefasPendentesSync = await db.ordens_servico
      .filter((t) => 
        t.status_sincronizacao === 'pendente' ||
        t.sync_status === 'pendente' ||
        (t.status && t.status !== 'PENDENTE' && !t.sincronizado)
      )
      .toArray();

    if (tarefasPendentesSync.length === 0) {
      return { total: 0 };
    }

    let sincronizadasComSucesso = 0;

    for (const tarefa of tarefasPendentesSync) {
      // 2. Monta objeto de atualização — apenas colunas reais no banco (sem fotos_recolhimento)
      const payload = {
        status: tarefa.status,
        observacao_tecnico: tarefa.observacao_tecnico || null,
        motivo_improdutiva: tarefa.motivo_improdutiva || null,
        requer_verificacao: Boolean(tarefa.requer_verificacao),
        concluido_em: tarefa.status !== 'PENDENTE' ? new Date().toISOString() : null,
      };

      // 3. Update na tabela ordens_servico do Supabase
      let query = supabase.from('ordens_servico').update(payload);
      if (tarefa.id && isNaN(Number(tarefa.id))) {
        query = query.eq('id', tarefa.id);
      } else if (tarefa.numero_os) {
        query = query.eq('numero_os', tarefa.numero_os);
      } else {
        query = query.eq('id', tarefa.id);
      }

      const { error: updateError } = await query;

      if (updateError) {
        console.error(`Erro ao atualizar OS ${tarefa.numero_os} no Supabase:`, updateError);
        throw updateError;
      }

      // 4. Sincroniza equipamentos (único envio de fotos, sem duplicidade)
      try {
        const fotosPorEquip = (tarefa.fotos_por_equipamento && typeof tarefa.fotos_por_equipamento === 'object')
          ? tarefa.fotos_por_equipamento
          : {};

        const equipLocais = await db.equipamentos.where({ os_id: tarefa.id }).toArray();

        for (const eq of equipLocais) {
          if (eq.foi_recolhido) {
            let fotoUrl = null;
            // Busca pelo ID ou pela chave temporária (equipamentos extras)
            const item = fotosPorEquip[String(eq.id)] || (eq.temp_key ? fotosPorEquip[eq.temp_key] : null);
            const blob = (item instanceof Blob) ? item : (item?.file || item?.blob);

            if (blob instanceof Blob) {
              const ext = blob.type === 'image/png' ? 'png' : 'jpg';
              const nome = `${tarefa.numero_os}_${eq.is_extra ? `extra_${Date.now()}` : eq.id}.${ext}`;
              const { error: upErr } = await supabase.storage
                .from('fotos-os')
                .upload(nome, blob, { contentType: blob.type || 'image/jpeg', upsert: true });

              if (!upErr) {
                const { data: urlData } = supabase.storage.from('fotos-os').getPublicUrl(nome);
                fotoUrl = urlData?.publicUrl || null;
              } else {
                console.warn(`Falha upload foto equipamento ${eq.id}:`, upErr);
              }
            } else if (typeof item === 'string' && item.startsWith('http')) {
              fotoUrl = item;
            }

            // Opção 1: Equipamentos extras recebem INSERT com MAC "EXTRA" conectando à OS
            if (eq.is_extra || eq.mac_esperado === 'EXTRA') {
              const { data: insData, error: insErr } = await supabase
                .from('equipamentos')
                .insert([{
                  os_id: tarefa.id,
                  mac_esperado: 'EXTRA',
                  foi_recolhido: true,
                  foto_url: fotoUrl,
                }])
                .select()
                .single();

              if (!insErr && insData?.id) {
                await db.equipamentos.update(eq.id, { id: insData.id, foto_url: fotoUrl });
              } else if (insErr) {
                console.warn('Erro ao inserir equipamento extra no Supabase:', insErr);
              }
            } else {
              // Equipamento padrão existente na OS
              await supabase
                .from('equipamentos')
                .update({ foi_recolhido: true, ...(fotoUrl ? { foto_url: fotoUrl } : {}) })
                .eq('id', eq.id);
            }
          } else {
            // Equipamento não entregue / não recolhido
            await supabase
              .from('equipamentos')
              .update({ foi_recolhido: false, foto_url: null })
              .eq('id', eq.id);
          }
        }
      } catch (eqSyncErr) {
        console.warn('Aviso ao sincronizar equipamentos:', eqSyncErr);
      }

      // 5. Atualiza registro no Dexie marcando status_sincronizacao = 'sincronizado'
      await db.ordens_servico.update(tarefa.id, {
        status_sincronizacao: 'sincronizado',
        sync_status: 'synced',
        sincronizado: true,
        fotos_por_equipamento: null,
      });

      sincronizadasComSucesso++;
    }

    return { total: sincronizadasComSucesso };
  } finally {
    isSyncing = false;
  }
}

export const sincronizarConcluidas = sincronizarPendentes;
