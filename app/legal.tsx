import { Page, Heading, Card, Body } from "../src/components/ui";
export default function Legal() {
  return (
    <Page>
      <Heading sub="Versão acadêmica · 14 de outubro de 2026">
        Termos e privacidade
      </Heading>
      <Card>
        <Body>
          O SafeNow é um protótipo acadêmico de informação comunitária. Não
          substitui polícia, bombeiros, atendimento médico ou canais oficiais.
          Relatos, níveis de risco, locais de apoio e indicadores podem conter
          erros. Nunca procure ou confronte pessoas com base em um alerta.
        </Body>
        <Body>
          Publique somente informações que você possa descrever de forma
          responsável. Não publique nomes de suspeitos, placas, endereços
          residenciais, rostos identificáveis, documentos ou conteúdo ilegal.
          Não se exponha para coletar evidências.
        </Body>
        <Body>
          O e-mail e a senha são tratados pelo Supabase Auth. O perfil, as
          contribuições e as preferências são usados para o funcionamento do
          protótipo. O GPS só é solicitado após sua ação explícita. As
          coordenadas exatas do relato ficam restritas ao servidor; a comunidade
          recebe uma região aproximada, arredondada a três casas decimais.
        </Body>
        <Body>
          Relato anônimo oculta seu nome e identificador dos demais
          participantes. A associação interna com a conta é preservada para
          controle de abuso. Comentários são exibidos sem autoria pública. O
          anonimato não remove informações identificáveis que você mesmo escreva
          ou mostre na mídia.
        </Body>
        <Body>
          Imagens são recodificadas e vídeos MP4 têm contêineres de metadados
          removidos no servidor. Isso não desfoca rostos ou apaga dados
          presentes na própria cena. Evidências ficam em bucket privado,
          acessíveis somente a contas autorizadas por links temporários.
        </Body>
        <Body>
          Notificações usam uma zona aproximada que você salva, categorias e
          raio. Não rastreamos sua localização em segundo plano. Sons e horários
          silenciosos são opcionais. Você pode revogar as permissões no
          dispositivo.
        </Body>
        <Body>
          Alertas expiram para revisão em 24 horas. A política proposta de
          retenção é 30 dias para alertas e mídias excluídos e 90 dias para
          auditoria; a limpeza deve ser agendada pelo responsável conforme
          README. A solicitação de exclusão bloqueia a conta, remove tokens e
          anonimiza o nome imediatamente; o responsável deve concluir a exclusão
          em até 30 dias.
        </Body>
        <Body>
          Ao se cadastrar, você aceita esta política e o uso apenas em cenários
          simulados. Antes de uso público, a instituição responsável deve
          publicar identificação, canal do titular, política definitiva e
          realizar avaliação jurídica, operacional e de proteção de dados.
        </Body>
      </Card>
    </Page>
  );
}
