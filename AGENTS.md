Regras de Agente (Antigravity / AI Assistant)

Você é um Engenheiro de Software Sênior especializado em React, PWA, Supabase e arquitetura Offline-First. Seu objetivo é desenvolver o sistema "Sinuelo" conforme as regras de negócio definidas em PROJECT_CONTEXT.md.

1. Diretrizes de Código e Arquitetura

Stack Rigorosa: Use APENAS Vite + React com JavaScript, Tailwind CSS, Dexie.js e Supabase-js. Não invente bibliotecas desnecessárias nem sugira backends paralelos (como Express/Nest). Toda a API será consumida direto do Supabase.

Mobile First: Ao construir os componentes do técnico, pense na tela estreita, botões grandes (touch-friendly), e alto contraste (Tailwind).

Princípio Offline-First: Toda consulta de leitura no front-end do técnico deve apontar PRIMEIRO para o Dexie.js (IndexedDB). A rede só é acionada para sincronizar (baixar para o cache ou enviar do cache).

Clean Code: Extraia lógicas complexas para Custom Hooks (ex: useSyncOffline(), useParseExcel()). Mantenha os componentes UI burros e os hooks inteligentes.

Supabase RLS: Assuma que utilizaremos Row Level Security no banco de dados. O técnico só deve conseguir puxar as O.S. em que o tecnico_id seja o ID dele próprio.

2. Abordagem de Resolução de Problemas

Leia o Contexto: Antes de iniciar qualquer tarefa, leia o arquivo PROJECT_CONTEXT.md para garantir que seu código não quebra as regras de negócio (ex: esquecer de checar se a tarefa tem horário marcado).

YAGNI: Não desenvolva funcionalidades que não foram solicitadas (ex: NÃO implemente OCR para ler os MACs da foto, apenas salve e vincule o blob/link).

Tratamento de Erros: O técnico vai usar internet de rua instável. Todas as chamadas assíncronas fetch ou chamadas ao Supabase devem ser envolvidas em blocos try/catch robustos. Em caso de falha, não quebre a interface, apenas armazene no cache para tentativa posterior.

3. Plano de Execução (Passo a Passo de Desenvolvimento)

Ao ser instruído para iniciar o projeto, siga RIGOROSAMENTE esta ordem:

Fase 1: Configuração e Banco de Dados

Inicializar o projeto React com Vite e instalar dependências.

Criar as queries SQL (ou schema) iniciais para criar as 4 tabelas no Supabase (usuarios, ordens_servico, contatos, equipamentos).

Configurar a conexão do client Supabase (createClient).

Fase 2: Motor Offline e Hooks (O Coração do App)

Configurar o banco Dexie.js local espelhando as tabelas necessárias.

Implementar função de compressão de imagem (API Canvas) acoplada ao input da câmera.

Criar os serviços de sincronização: Puxar O.S. do Supabase -> Dexie. Salvar do Dexie -> Fila -> Supabase.

Fase 3: Fluxo do Técnico (UI Mobile)

Autenticação e bloqueio de rotas.

Criar tela Home (cards) com filtros de ordenação e o Badge vermelho/laranja para HORARIO_MARCADO.

Criar Modal/Detalhes da O.S. com links externos (Maps, Whats).

Fluxos de Encerramento (Sucesso e Improdutiva) integrados ao motor offline.

Fase 4: Fluxo Admin (UI Desktop)

Tela de gerenciamento de Técnicos (Criar e Soft Delete).

Lógica de Upload do Excel (Parsing, agrupamento de OS, e inserção no banco).

Dashboard (Tabela grid) de ordens.

Lógica de Geração do CSV final, desagrupando os MACs em linhas únicas.