Contexto do Projeto: Sistema de Recolhimento de Equipamentos (Sinuelo)

1. Visão Geral

Sistema (SPA/PWA) para gerenciar o recolhimento de equipamentos de telecomunicação (roteadores/ONUs) na casa de clientes que cancelaram a internet.
O sistema possui duas pontas:

Painel Admin (Desktop): Importa planilhas (Excel) para criar rotas, gerencia técnicos e exporta relatórios (CSV) do que foi recolhido.

App do Técnico (Mobile PWA): Focado no uso em rua, 100% offline-first. O técnico visualiza rotas, aciona clientes no WhatsApp/Maps, tira fotos dos equipamentos (comprimidas localmente) e finaliza Ordens de Serviço (O.S.).

2. Stack Tecnológica

Frontend/UI: React (Vite), Tailwind CSS, Lucide Icons (para ícones UI).

Backend as a Service: Supabase (PostgreSQL relacional, Auth para login e Storage para fotos).

Offline/PWA: Service Worker (App Shell cache), IndexedDB via dexie (para cache das O.S. e fotos pendentes).

Manipulação de Planilhas: xlsx (ou similar) para leitura de Excel no Admin e papaparse para geração do CSV.

Compressão de Imagens: browser-image-compression ou Canvas API (comprimir foto antes de salvar no IndexedDB).

3. Regras de Negócio e Lógica (CRÍTICO)

3.1. Importação da Planilha (Fluxo Admin)

Colunas esperadas no Excel: DIA, TURNO, HORARIO_MARCADO,NUMERO_OS, NOME_CLIENTE, CONTATO_1, CONTATO_2, ENDEREÇO, BAIRRO, CIDADE, MAC_APARELHO, OBSERVAÇÃO_DO_CLIENTE.

Agrupamento (Upsert): A planilha lista um MAC por linha. O sistema deve ler a planilha e agrupar pela coluna NUMERO_OS. Se 3 linhas têm a mesma O.S., cria apenas 1 tarefa e adiciona os 3 MACs ao array de equipamentos dessa tarefa.

Ao salvar no Supabase, a O.S. é vinculada ao ID do técnico selecionado na tela.

3.2. Exportação para CSV (Fluxo Admin)

Ao baixar o relatório, o sistema faz a engenharia reversa: "descompacta" as O.S. concluídas/improdutivas e quebra em 1 linha para cada MAC.

Adiciona dinamicamente as colunas: STATUS_DA_RETIRADA (Concluída ou Improdutiva) e OBSERVAÇÃO_DA_RETIRADA.

3.3. Dinâmica Offline e Sincronização (App Técnico)

A Regra de Ouro: A ação do técnico offline sempre vence. Se ele finalizar a O.S. offline e o admin alterar o endereço depois, quando a internet voltar, a finalização do técnico sobrepõe a edição do admin.

O App usa o App Shell Model: todas as telas são cacheadas no Service Worker para navegação sem internet.

Tarefas do dia são baixadas e salvas no IndexedDB.

Sincronização Híbrida: Ao finalizar uma O.S., se tiver internet, envia na hora. Se não, salva na "Fila de Envio" do IndexedDB. A sincronização em background dispara automaticamente ao retomar a rede.

Compressão: O app DEVE comprimir fotos (max 800px) antes de salvar em Base64/Blob no cache local para não estourar a memória.

3.4. Fluxo de Autenticação (Supabase Auth)

Login dura 30 dias (Refresh Tokens).

Interceptador HTTP: Se o token expirar (401), o app desloga o técnico e vai para a tela de login.

Segurança de Dados Offline: Se o token expirar enquanto há O.S. na fila de envio do IndexedDB, os dados locais NÃO devem ser apagados. Apenas a sessão é derrubada.

4. UI / UX Design

Tela do Técnico (Mobile)

Filtros: Bairro (ordem alfabética) ou Padrão (ordem de index da planilha). Abas: Pendentes / Concluídas Hoje.

Card da Tarefa: 100% da largura. Mostrar Nome, Endereço e Turno.

Alerta Visual Crítico: Se o campo HORARIO_MARCADO estiver preenchido, o card deve exibir uma tarja lateral vermelha/laranja e um selo/badge alertando o horário (Ex: ⏰ 14:30).

Detalhes da O.S.: Botões de ação para abrir "Google Maps" e "WhatsApp" (um botão para cada contato existente).

Ações Finais:

Botão Verde "Finalizar O.S.": Pede quantidade recolhida -> Abre Câmera -> Salva.

Botão Vermelho "Visita Improdutiva": Abre dropdown de motivos (Cliente Ausente, etc) + Obs (obrigatório se "Outro") -> Salva.

Painel Admin (Desktop)

Tabela com todas as O.S.

Bloqueio de edição: Admin não pode editar tarefa se status for diferente de "PENDENTE".

Gerenciamento de Técnicos: Inativação por Soft Delete (ativo: false). Se inativar, as O.S. pendentes do técnico retornam para o status "Não Atribuído".

5. Estrutura de Tabelas (Supabase / Postgres)

usuarios: id, nome, login, role (ADMIN/TECNICO), ativo.

ordens_servico: id, numero_os (unique), data, turno, horario_marcado, cliente, endereco, bairro, cidade, link_maps, obs_cliente, obs_tecnico, status, motivo_improdutiva, tecnico_id (FK).

contatos: id, numero, os_id (FK cascade).

equipamentos: id, mac_esperado, recolhido (bool), url_foto, os_id (FK cascade).