import { supabase } from '../supabase';
import { db } from '../db/db';

/**
 * Passo 1 - A) Baixa todas as O.S. com status 'PENDENTE' do Supabase
 * e grava no Dexie (db.ordens_servico.bulkPut) com os IDs reais da nuvem.
 */
export async function baixarCargaDoDia() {
  if (!navigator.onLine) {
    throw new Error('Sem conexão com a internet para baixar tarefas.');
  }

  // 1. Busca ordens de serviço pendentes no Supabase
  const { data: ordens, error } = await supabase
    .from('ordens_servico')
    .select('*')
    .eq('status', 'PENDENTE');

  if (error) {
    console.error('Erro ao buscar ordens pendentes no Supabase:', error);
    throw error;
  }

  if (!ordens || ordens.length === 0) {
    return { total: 0, ordens: [] };
  }

  // 2. Grava ou atualiza no Dexie com os IDs reais do Supabase
  await db.ordens_servico.bulkPut(ordens);

  // 3. Busca equipamentos previstos associados às OS baixadas (se existirem na nuvem)
  try {
    const osIds = ordens.map((o) => o.id).filter(Boolean);
    if (osIds.length > 0) {
      const { data: equipamentos, error: eqError } = await supabase
        .from('equipamentos')
        .select('*')
        .in('os_id', osIds);

      if (!eqError && equipamentos && equipamentos.length > 0) {
        await db.equipamentos.bulkPut(equipamentos);
      }
    }
  } catch (eqErr) {
    console.warn('Aviso ao sincronizar equipamentos previstos:', eqErr);
  }

  return { total: ordens.length, ordens };
}

/**
 * Passo 1 - B) Envia para o Supabase tarefas concluídas/improdutivas
 * pendentes de sincronização local, subindo fotos para o storage 'fotos-os'.
 */
export async function sincronizarConcluidas() {
  if (!navigator.onLine) {
    throw new Error('Sem conexão com a internet para sincronizar.');
  }

  // 1. Busca no Dexie tarefas finalizadas (status !== 'PENDENTE') e não sincronizadas
  const tarefasPendentesSync = await db.ordens_servico
    .filter((t) => t.status !== 'PENDENTE' && !t.sincronizado)
    .toArray();

  if (tarefasPendentesSync.length === 0) {
    return { total: 0 };
  }

  let sincronizadasComSucesso = 0;

  for (const tarefa of tarefasPendentesSync) {
    const urlsFotos = [];
    const fotos = tarefa.fotos_recolhimento || tarefa.fotos || [];

    // 2. Upload de cada foto (Blob/File) para o storage do Supabase
    for (let i = 0; i < fotos.length; i++) {
      const fotoItem = fotos[i];

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

    // 3. Monta objeto de atualização
    const payload = {
      status: tarefa.status,
      observacao_tecnico: tarefa.observacao_tecnico || tarefa.obs_tecnico || null,
      motivo_improdutiva: tarefa.motivo_improdutiva || null,
      requer_verificacao: Boolean(tarefa.requer_verificacao),
      fotos_recolhimento: urlsFotos,
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

    // 5. Se houver equipamentos recolhidos localmente com sucesso, sincroniza também
    try {
      const equipLocais = await db.equipamentos.where({ os_id: tarefa.id }).toArray();
      for (const eq of equipLocais) {
        if (eq.foi_recolhido) {
          await supabase
            .from('equipamentos')
            .update({ recolhido: true })
            .eq('id', eq.id);
        }
      }
    } catch (eqSyncErr) {
      console.warn('Aviso ao sincronizar status de equipamentos:', eqSyncErr);
    }

    // 6. Atualiza registro no Dexie marcando sincronizado: true e DELETA os Blobs locais
    // para não consumir o armazenamento local do celular permanentemente (Passo 3)
    await db.ordens_servico.update(tarefa.id, {
      sincronizado: true,
      sync_status: 'synced',
      fotos_recolhimento: null, // Deleta os Blobs de fotos do Dexie
      fotos: null,              // Deleta Blobs legados se houver
      fotos_urls: urlsFotos,    // Mantém as URLs públicas remotas salvas
    });

    sincronizadasComSucesso++;
  }

  return { total: sincronizadasComSucesso };
}
