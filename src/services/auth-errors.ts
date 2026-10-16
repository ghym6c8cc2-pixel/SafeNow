type AuthOperation = "signup" | "login" | "recovery";

// Translate known Auth codes; never display raw provider/SMTP/database messages.
export function authErrorMessage(
  error: unknown,
  operation: AuthOperation,
): string {
  const value = error && typeof error === "object" ? error : {};
  const code =
    "code" in value && typeof value.code === "string" ? value.code : "";
  const status = "status" in value ? value.status : undefined;
  switch (code) {
    case "over_email_send_rate_limit":
      return "Limite de envio de e-mails atingido. Aguarde antes de tentar novamente. Se continuar, a administração precisa configurar o serviço de envio de e-mails.";
    case "email_address_not_authorized":
      return "O serviço de e-mail deste projeto ainda não está liberado para esse destinatário. A administração precisa configurar o envio de confirmações para outros usuários.";
    case "email_address_invalid":
    case "validation_failed":
      return "Confira os dados informados e use um e-mail válido ao qual você tenha acesso.";
    case "weak_password":
      return "A senha não atende aos requisitos de segurança. Use pelo menos 10 caracteres e evite senhas comuns.";
    case "signup_disabled":
    case "email_provider_disabled":
      return "O cadastro por e-mail está desativado neste projeto. Entre em contato com a administração.";
    case "email_not_confirmed":
      return "Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada e a pasta de spam.";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit_by_email":
      return "Muitas tentativas em pouco tempo. Aguarde antes de tentar novamente.";
  }
  if (status === 429)
    return "Muitas tentativas em pouco tempo. Aguarde antes de tentar novamente.";
  if ("name" in value && value.name === "AuthRetryableFetchError")
    return "Não foi possível acessar o serviço de autenticação. Verifique sua conexão e tente novamente.";
  if (operation === "login")
    return "E-mail ou senha incorretos, ou serviço indisponível.";
  if (operation === "recovery")
    return "Não foi possível solicitar a recuperação. Tente novamente mais tarde.";
  return "Não foi possível concluir o cadastro. Confira os dados ou tente recuperar a senha.";
}
