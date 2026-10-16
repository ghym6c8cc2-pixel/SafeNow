# Integração hospedada verificada

Em 14/10/2026, o projeto Supabase conectado foi configurado com cinco migrações de aplicação e uma migração operacional dos jobs. A migração posterior `safenow_two_roles` simplifica os perfis para usuário comum e administrador. Há nove categorias, bucket `evidence` privado, publicação Realtime de `alerts`, Edge Functions `evidence-upload`, `push-dispatch` e `retention`. A URL e a chave publicável foram gravadas no `.env` local, ignorado pelo Git, tanto no projeto de trabalho quanto no projeto aberto no VS Code.

O primeiro administrador já possui conta ativa e papel definido no servidor. Usa o mesmo login por e-mail e senha dos demais usuários. A conta usada no painel Supabase é separada das contas dos usuários do aplicativo. A confirmação de e-mail foi desativada por solicitação do proprietário para o protótipo acadêmico: novos cadastros entram diretamente, como usuário comum. Para outro projeto sem confirmação, use o bootstrap privilegiado descrito no README; não use a posse de um endereço não verificado como autorização administrativa.

## Evidência de integração real

O teste de implantação criou três contas Auth descartáveis com senhas aleatórias somente no servidor e verificou:

- Na verificação inicial, login por senha para os três perfis então existentes usando a mesma API Auth; senha incorreta recusada.
- `signup_role=admin` convertido para usuário comum e alteração direta do próprio papel recusada.
- RPCs administrativas negadas ao usuário comum; moderação e suspensão permitidas ao administrador autorizado.
- Conta suspensa sem acesso aos dados e operações, mesmo que o Auth ainda emita JWT.
- Criação de relato anônimo com GPS; feed sem identidade interna e com coordenadas arredondadas.
- Comentário, voto único, rejeição de voto duplicado e de autovalidação.
- Upload HTTP de JPEG fictício pela Edge Function, evidência no bucket privado e URL assinada para usuário elegível.
- Envio por outra pessoa, acesso sem sessão e acesso à evidência depois de ocultar o alerta recusados.
- Geração de link de recuperação pelo Auth, sem enviar e-mail real.
- JWT de usuário comum recusado pelo despachante.

Todos passaram. Contas, alertas, comentários e objetos temporários foram removidos. A base ficou sem contas ou relatos de demonstração; nove categorias foram mantidas. O endpoint de verificação foi **desativado** com resposta 410 após o teste. A fonte `deployment-check` permite repetir uma verificação somente por operador: exige credencial do Vault e registro privado de execução com validade de dez minutos. Não implante esse endpoint como parte da operação normal; nunca o exponha sem essas duas barreiras e desative-o após o teste.

`push-dispatch` executou pelo Cron e retornou HTTP 200 com zero envios, pois ainda não há dispositivos cadastrados. Isso comprova a execução do worker, não a entrega de push em um telefone. A retenção está agendada diariamente às 06:20 UTC. O segredo foi gerado no Vault e não foi colocado no aplicativo ou nos arquivos locais.

A função `retention` também foi chamada com a credencial de servidor no ambiente vazio e retornou HTTP 200, zero contas e zero alertas removidos. A interface compilada foi aberta em Chromium separado: login chamou o hostname configurado do Supabase, credenciais inválidas foram recusadas e retorno de Auth inválido exibiu mensagem tratada, sem erro de runtime.

Em um novo projeto, após `supabase db push`, o proprietário deve preencher a configuração operacional e executar `supabase/hosting/enable-jobs.sql`:

```sql
insert into private.runtime_config(id,project_url)
values (true,'https://SEU_PROJECT_REF.supabase.co')
on conflict(id) do update set project_url=excluded.project_url;
```

A sexta migração ignora o agendamento quando essa configuração ainda não existe, permitindo reset local sem jobs inválidos. Nunca substitua a URL por um endpoint de terceiros: os jobs enviam a credencial de servidor para esse endereço.

## Verificar pelo aplicativo e pelo painel

1. Abra `http://localhost:3000`, com a prévia ou Expo em execução. Crie sua conta com e-mail em formato válido e senha; o aplicativo entra em seguida sem confirmação por e-mail. Não use os dados de login do painel Supabase como se fossem uma conta já criada no SafeNow.
2. Em Perfil, pressione **Verificar conexão real com Supabase**. O aplicativo consulta a sessão, o perfil e as tabelas; informa o servidor e as contagens.
3. No Supabase, **Authentication → Users** mostra a conta cadastrada. **Table Editor → profiles** mostra o papel; somente a conta definida no servidor tem papel `admin`.
4. Publique um relato fictício identificado como teste. Confira-o em **alerts**. Uma foto enviada aparece em **Storage → evidence**. Exclua o relato pelo próprio app ao terminar.

## Configuração externa ainda necessária

O cadastro atual não exige SMTP. Recuperação de senha exige um endereço existente e entrega de e-mail; SMTP/entrega na caixa postal não foi testado. O provedor padrão do Supabase tem restrições e limites; configure SMTP próprio para outros destinatários e uso contínuo. Em Auth → URL Configuration, confirme as URLs web e móveis indicadas no README antes de publicar ou mudar a porta/domínio. A configuração Auth hospedada não é alterada automaticamente pelo `config.toml` local.

Push remoto depende de projeto EAS, FCM/APNs e dispositivo físico. Google Maps Android exige chave restrita no build. Não há APK/IPA homologado nem garantia de GPS/latência/disponibilidade.

O advisor do Supabase apontou tabelas `private` com RLS sem políticas e RPCs `SECURITY DEFINER` executáveis por usuários autenticados. Esses acessos são intencionais e foram revisados: tabelas privadas sem grants/políticas negam clientes; RPCs validam conta ativa, papel/autoria, entradas e limites no servidor, com `search_path=''`. Os testes positivos e negativos passaram. Referências: [RLS sem políticas](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) e [RPC SECURITY DEFINER autenticada](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).

## Simplificação para dois perfis

A migração `20261015001712_safenow_two_roles.sql` foi aplicada no projeto conectado. O banco aceita somente `user` e `admin`; o trigger de cadastro sempre cria `user`. A conversão de contas antigas mantém o UUID e o status da conta e registra auditoria. A nomeação administrativa continua restrita ao servidor.

Verificação após a alteração: cadastro Auth real com sessão imediata; metadados forjados de colaborador/admin ignorados; leitura do perfil como `user`; alteração direta do papel e RPC administrativa recusadas; senha incorreta recusada e login válido aceito. A conta temporária foi desconectada e excluída após os testes. Não havia colaboradores na base hospedada no momento da migração. A migração de uma conta legada suspensa foi validada nos testes SQL, mantendo status e preferências.

## Opiniões editáveis e avisos de resolução

A migração `20261015003614_safenow_editable_contributions.sql` foi aplicada no projeto conectado. Avisos e histórico individual ficam no esquema privado, com RLS e sem grants de cliente. O titular consulta somente seu estado por RPC, enquanto alertas expõem agregados. Repetições são idempotentes; alterações usam lock do alerta e limites por conta.

Foram verificados via Auth/PostgREST reais: envio concorrente repetido sem duplicação, troca de confirmação para contestação com desconto da anterior, retirada de opinião, aviso independente e retirada de aviso, consulta do próprio estado e recusa de moderação por usuário comum. Na conexão SQL do servidor, com o papel autenticado, o administrador encerrou o alerta temporário com motivo; a retirada posterior das duas contribuições preservou `resolved` e `moderated=true`. As duas contas e o alerta temporários foram removidos. O teste SQL local também comprova que três avisos não encerram automaticamente, protege contas suspensas/sem sessão e migra histórico anterior.
