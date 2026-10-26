import Dexie from 'dexie';

export const db = new Dexie('SinueloDB');

db.version(1).stores({
  ordens_servico: '++id, &numero_os, data, turno, horario_marcado, cliente, bairro, status, tecnico_id, sync_status',
  equipamentos: '++id, os_id, mac_esperado, recolhido',
  contatos: '++id, os_id, numero'
});
