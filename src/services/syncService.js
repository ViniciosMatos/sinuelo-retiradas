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
      const urlsFotos = [];

      // Extrai fotos de array ou do objeto indexado por equipamento
      let fotos = [];
      if (Array.isArray(tarefa.fotos_recolhimento)) {
        fotos = tarefa.fotos_recolhimento;
      } else if (tarefa.fotos_por_equipamento && typeof tarefa.fotos_por_equipamento === 'object') {
        fotos = Object.values(tarefa.fotos_por_equipamento).filter(Boolean);
      } else if (Array.isArray(tarefa.fotos)) {
        fotos = tarefa.fotos;
      }

      // 2. Upload de cada foto (Blob/File) para o storage do Supabase
      for (let i = 0; i < fotos.length; i++) {
        const rawItem = fotos[i];
        const fotoItem = (rawItem instanceof Blob) ? rawItem : (rawItem?.file || rawItem?.blob || rawItem);

        if (fotoItem instanceof Blob) {
          const extensao = fotoItem.type === 'image/png' ? 'png' : 'jpg';
          const nomeArquivo = `${tarefa.id || tarefa.numero_os}_${Date.now()}_${i}.${extensao}`;

          const { error: uploadError } = await supabase.storage
            .from('fotos-os')
            .upload(nomeArquivo, fotoItem, {
              contentType: fotoItem.type || 'image/jpeg',
              upsert: true,
            });

          if (uploadError) {
            console.error(`Falha no upload da foto ${i} da OS ${tarefa.numero_os}:`, uploadError);
            throw uploadError;
          }

          // Recupera a URL pública gerada
          const { data: urlData } = supabase.storage
            .from('fotos-os')
            .getPublicUrl(nomeArquivo);

          if (urlData?.publicUrl) {
            urlsFotos.push(urlData.publicUrl);
          }
        } else if (typeof fotoItem === 'string' && fotoItem.startsWith('http')) {
          urlsFotos.push(fotoItem);
        }
      }

      // 3. Monta objeto de atualização — apenas colunas que existem no banco
      const payload = {
        status: tarefa.status,
        observacao_tecnico: tarefa.observacao_tecnico || null,
        motivo_improdutiva: tarefa.motivo_improdutiva || null,
        requer_verificacao: Boolean(tarefa.requer_verificacao),
        fotos_recolhimento: urlsFotos.length > 0 ? urlsFotos : null,
        concluido_em: tarefa.status !== 'PENDENTE' ? new Date().toISOString() : null,
      };

      // 4. Update na tabela ordens_servico do Supabase
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

      // 5. Sincroniza equipamentos: upload da foto para recolhidos e foto_url=null para não entregues
      try {
        const fotosPorEquip = (tarefa.fotos_por_equipamento && typeof tarefa.fotos_por_equipamento === 'object')
          ? tarefa.fotos_por_equipamento
          : {};

        const equipLocais = await db.equipamentos.where({ os_id: tarefa.id }).toArray();

        for (const eq of equipLocais) {
          if (eq.foi_recolhido) {
            let fotoUrl = null;
            const item = fotosPorEquip[String(eq.id)];
            const blob = (item instanceof Blob) ? item : (item?.file || item?.blob);

            if (blob instanceof Blob) {
              const ext = blob.type === 'image/png' ? 'png' : 'jpg';
              const nome = `${tarefa.numero_os}_${eq.id}.${ext}`;
              const { error: upErr } = await supabase.storage
                .from('fotos-os')
                .upload(nome, blob, { contentType: blob.type || 'image/jpeg', upsert: true });

              if (!upErr) {
                const { data: urlData } = supabase.storage.from('fotos-os').getPublicUrl(nome);
                fotoUrl = urlData?.publicUrl || null;
              } else {
                console.warn(`Falha upload foto equipamento ${eq.id}:`, upErr);
              }
            }

            await supabase
              .from('equipamentos')
              .update({ foi_recolhido: true, ...(fotoUrl ? { foto_url: fotoUrl } : {}) })
              .eq('id', eq.id);
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

      // 6. Atualiza registro no Dexie marcando status_sincronizacao = 'sincronizado' e substitui Blobs por URLs públicas
      await db.ordens_servico.update(tarefa.id, {
        status_sincronizacao: 'sincronizado',
        sync_status: 'synced',
        sincronizado: true,
        fotos_recolhimento: urlsFotos.length > 0 ? urlsFotos : null, // Guarda URLs da nuvem no campo fotos_recolhimento
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
