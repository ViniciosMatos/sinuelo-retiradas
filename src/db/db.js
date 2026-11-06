import Dexie from 'dexie';

export const db = new Dexie('SinueloDB');

db.version(1).stores({
  ordens_servico: '++id, &numero_os, data, turno, horario_marcado, cliente, bairro, status, tecnico_id, sync_status',
  equipamentos: '++id, os_id, mac_esperado, foi_recolhido',
  contatos: '++id, os_id, numero'
});

// v2: adiciona índices para ordem_importacao (ordenação) e is_nova (badge)
db.version(2).stores({
  ordens_servico: '++id, &numero_os, data, turno, horario_marcado, cliente, bairro, status, tecnico_id, sync_status, ordem_importacao, is_nova',
  equipamentos: '++id, os_id, mac_esperado, foi_recolhido',
  contatos: '++id, os_id, numero'
});

// v3: suporte a fotos pendentes de upload (offline-first) e foto_url por equipamento
db.version(3).stores({
  ordens_servico: '++id, &numero_os, data, turno, horario_marcado, cliente, bairro, status, tecnico_id, sync_status, ordem_importacao, is_nova',
  equipamentos: '++id, os_id, mac_esperado, foi_recolhido, foto_url',
  contatos: '++id, os_id, numero',
  fotos_pendentes: '++id, numero_os, mac_aparelho, status, os_id, equip_id, criado_em'
});

// v4: índice para status_sincronizacao (sincronização instantânea orientada a eventos)
db.version(4).stores({
  ordens_servico: '++id, &numero_os, data, turno, horario_marcado, cliente, bairro, status, tecnico_id, sync_status, status_sincronizacao, ordem_importacao, is_nova',
  equipamentos: '++id, os_id, mac_esperado, foi_recolhido, foto_url',
  contatos: '++id, os_id, numero',
  fotos_pendentes: '++id, numero_os, mac_aparelho, status, os_id, equip_id, criado_em'
});

// v5: alinha equipamentos com schema real do banco (foto_url, foi_recolhido apenas — sem url_foto ou recolhido)
//     ordens_servico local usa data_agendada (espelho do banco) + campos locais offline-first
db.version(5).stores({
  ordens_servico: '++id, &numero_os, data_agendada, turno, horario_marcado, cliente_nome, bairro, status, tecnico_id, status_sincronizacao, ordem_importacao, is_nova',
  equipamentos: '++id, os_id, mac_esperado, foi_recolhido, foto_url',
  contatos: '++id, os_id, numero',
  fotos_pendentes: '++id, numero_os, status, os_id, equip_id, criado_em'
});

