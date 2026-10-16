# Modelo de dados SafeNow

Correspondência com o artigo e com os textos verificáveis do modelo `SFNW.asta`. As relações de identidade e localização foram separadas para impedir que a API pública e os eventos Realtime revelem a autoria interna.

| Elemento original | Implementação | Relações e adaptação |
| --- | --- | --- |
| Pessoa | `auth.users` + `public.profiles` | UUID único. Nome no perfil; e-mail/senha somente em Auth. Telefone omitido por minimização. |
| Usuario | `public.profiles` | Papel e status autorizados no servidor; `senhaUsuario` não é replicado. |
| Ator Usuário / Colaborador / Administrador | `profiles.role` | `user` e `admin`; por decisão posterior do proprietário, Colaborador foi incorporado ao Usuário comum. O admin usa o mesmo Auth, sem autocadastro. |
| Alerta | `public.alerts` + `private.alert_owners` | Autor interno 1:N relatos; payload público não tem ID do autor. |
| Localizacao | `private.alert_owners` | Uma por alerta: lat/lon originais, precisão GPS e captura. Aproximação de três casas em `alerts`. `region` deve ser aproximada. |
| Categoria | `public.categories` | Uma categoria por alerta; nome, descrição, risco padrão, ícone, ativo. |
| Evidencia | `public.evidence` + bucket privado `evidence` | Alerta 1:N, limite de três. Caminho com ID do alerta e UUID aleatório, sem ID/nome do usuário. |
| Validação do artigo / Votar Validade e fluxo de atividade do Astah | `private.votes` | Participante N:M alerta, opinião atual/data, UNIQUE(usuario,alerta), troca ou retirada pela RPC; não se publica o usuário votante. |
| Comentário da validação / Comentar Alerta | `public.comments` + `private.comment_owners` | Texto público limitado, autor privado. Separado do voto para comentar mais de uma vez dentro do limite. |
| Interface SafeNow | `app/`, `src/components/` | Apresentação e navegação. |
| Control SafeNow | regras, serviços, RPCs e Edge Functions | Coordena entrada, GPS, persistência, validação, upload e push. |
| PushFirebase da sequência | Expo Push + FCM/APNs | Somente servidor dispara; tokens associados ao usuário, protegidos por RLS. |
| Gerenciar Usuários / suspenderAcesso(id,motivo) | `manage_user` + `audit_log` | Somente admin ativo; exige motivo; role não pode ser alterado pelo cliente. |

A extração do Astah encontrou classes e operações, atores, casos de uso, diagramas de sequência, atividade e máquina de estados. Não foi identificado um enum completo de risco, um algoritmo numérico de score nem limites numéricos de voto; esses parâmetros são decisões documentadas deste protótipo. O artigo descreve a entidade Validação; a extração textual do Astah confirmou os fluxos de voto, sem confirmar uma classe explicitamente nomeada `Validacao`.

## Entidades auxiliares

`private.resolution_reports` registra no máximo um aviso ativo de resolução por usuário/alerta. `private.contribution_history` preserva opinião anterior/nova ou envio/retirada de aviso, data e usuário interno. Ambas têm RLS e nenhum grant de cliente, não entram no Realtime e acompanham a retenção do alerta por FK. Exclusão Auth desassocia a identidade. `public.my_contribution` devolve apenas os dois estados do titular. O agregado `alerts.resolved_votes` conta esses avisos; não representa consenso de encerramento.


`private.admin_nomination` permite ao operador nomear o primeiro administrador antes do cadastro, sem expor e-mail ou poderes pela API. O trigger de Auth exige confirmação do e-mail e ausência de outro administrador. `private.runtime_config` contém a URL do serviço e o nome da credencial no Vault, sem armazenar o segredo. `private.verification_runs` registra resultados limitados de verificações operacionais, sem senhas, tokens ou relatos. Somente o servidor acessa essas tabelas.

`notification_preferences` guarda uma zona aproximada por conta, raio 100–20.000 m, categorias e silêncio no fuso escolhido. `push_tokens` guarda tokens privados. `status_history` é histórico público sem dados de autor ou motivo livre administrativo. `audit_log` registra motivo privado, ator e alvo, visível somente ao administrador. `safe_places` é um catálogo administrado no servidor, sem pontos reais presumidos pelo seed.

O esquema `private` também guarda rate limiting, fila e entregas de push; não está na lista de esquemas da API. Nem a aplicação nem usuários comuns recebem grants para essas tabelas. Não são criadas tabelas de senha, pessoa duplicada ou permissões desnecessárias.

## Máquina de estados

| Estado atual | Próximos estados administrativos permitidos |
| --- | --- |
| `active` | `under_review`, `confirmed`, `contested`, `resolved`, `inactive`, `spam`, `deleted` |
| `under_review` | `active`, `confirmed`, `contested`, `resolved`, `spam`, `deleted` |
| `confirmed` | `under_review`, `contested`, `resolved`, `inactive`, `spam`, `deleted` |
| `contested` | `under_review`, `confirmed`, `resolved`, `inactive`, `spam`, `deleted` |
| `resolved` | `under_review`, `deleted` |
| `inactive` | `under_review`, `deleted` |
| `spam` | `under_review`, `deleted` |
| `deleted` | Nenhum |

Entrada em `active` pela criação. O autor pode fazer exclusão lógica de qualquer estado ainda não excluído; não pode definir status de moderação. Os limiares comunitários são três confirmações, três contestações ou três sinalizações de spam, com prioridade spam → contestação → confirmação; uma decisão administrativa interrompe transições automáticas por votos. Trocas/retiradas recalculam o consenso atual, sem reabrir resolvidos ou excluídos. Avisos de resolução nunca mudam o status para resolvido automaticamente. O job de manutenção torna alertas ativos/confirmados/contestados vencidos inativos.

Na atividade do UML, o limite de votos leva a inativo/resolvido e à retirada do mapa. Por decisão posterior do proprietário, este protótipo exige decisão administrativa com motivo para encerrar como resolvido. Os avisos da comunidade são separados das opiniões e alimentam a fila de análise, preservando confirmações anteriores. Contestação e sinalização de falso não são tratadas como prova de que o perigo terminou: levam a contestado ou análise. Spam só é aplicado definitivamente pela administração. Essa distinção evita transformar uma votação em garantia de segurança.

O mapa padrão exclui resolvidos, inativos, spam e excluídos. Os filtros permitem consultar resolvidos/inativos; spam/excluídos só ficam acessíveis ao autor e à administração por RLS. `confirmed` pode decorrer da comunidade ou moderação; `moderated` e o histórico distinguem a origem.

## Integridade e exposição

- Chaves estrangeiras garantem categoria, conta, alerta e evidência existentes.
- A checagem `anonymous → public_author_name IS NULL` impede publicação de nome junto com a marca anônima.
- A precisão exata fica fora de `alerts`, inclusive para relatos não anônimos; consulta GPS local não é enviada ao servidor sem relato ou salvamento explícito de zona.
- RLS protege leituras, grants impedem escrita direta e RPCs validam autorização, entradas, transições e limites.
- `private.votes` usa UNIQUE por usuário e alerta e o alerta é bloqueado durante o voto, prevenindo corrida na contagem.
- Upload ocorre pelo servidor, seguido de registro transacional e recálculo; a função de registro é exclusiva de `service_role`.
- Auditoria e histórico não são mutáveis pelo cliente. Nenhum segredo é armazenado no histórico.
- Exclusão Auth remove perfil/preferências/tokens e desassocia autores de votos/alertas; dados comunitários já anônimos podem permanecer conforme política institucional.

O algoritmo de confiabilidade está em `src/domain/rules.ts` e `private.score`; testes comparam os dois para evitar divergência. Risco é uma escolha ordinal independente de 1 a 4. Score é um indicador contextual, não uma medida estatística de verdade.
