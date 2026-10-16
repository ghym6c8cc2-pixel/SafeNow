import { describe, it, expect } from "vitest";
import { authErrorMessage } from "../src/services/auth-errors";

describe("Mensagens de autenticação sem vazamento de dados", () => {
  it("explica a cota de e-mail em cadastro e recuperação", () => {
    for (const operation of ["signup", "recovery"] as const)
      expect(
        authErrorMessage(
          { code: "over_email_send_rate_limit", status: 429 },
          operation,
        ),
      ).toContain("Limite de envio de e-mails atingido");
  });
  it("distingue destinatário não autorizado de erro de formulário", () => {
    expect(
      authErrorMessage({ code: "email_address_not_authorized" }, "signup"),
    ).toContain("ainda não está liberado para esse destinatário");
    expect(
      authErrorMessage({ code: "email_address_invalid" }, "signup"),
    ).toContain("e-mail válido");
  });
  it("trata limite genérico sem prometer um prazo de desbloqueio", () => {
    expect(authErrorMessage({ status: 429 }, "signup")).toContain("Aguarde");
    expect(
      authErrorMessage({ code: "over_request_rate_limit" }, "login"),
    ).toContain("Aguarde");
  });
  it("orienta confirmação, senha e configuração de cadastro", () => {
    expect(
      authErrorMessage({ code: "email_not_confirmed" }, "login"),
    ).toContain("Confirme seu e-mail");
    expect(authErrorMessage({ code: "weak_password" }, "signup")).toContain(
      "requisitos de segurança",
    );
    expect(authErrorMessage({ code: "signup_disabled" }, "signup")).toContain(
      "desativado",
    );
  });
  it("mantém login inválido e cadastro existente sem revelar contas ou erros internos", () => {
    expect(authErrorMessage({ code: "invalid_credentials" }, "login")).toBe(
      "E-mail ou senha incorretos, ou serviço indisponível.",
    );
    const internal = {
      code: "unexpected_failure",
      message: "SMTP password=secret; SQL auth.users usuario@example.invalid",
    };
    for (const operation of ["signup", "login", "recovery"] as const)
      expect(authErrorMessage(internal, operation)).not.toMatch(
        /secret|SQL|auth.users|usuario@/,
      );
    expect(
      authErrorMessage({ code: "user_already_exists" }, "signup"),
    ).not.toContain("já existe");
  });
  it("trata falhas de rede e valores desconhecidos", () => {
    expect(
      authErrorMessage({ name: "AuthRetryableFetchError" }, "signup"),
    ).toContain("Verifique sua conexão");
    expect(authErrorMessage(null, "signup")).toContain("Não foi possível");
    expect(authErrorMessage("erro", "recovery")).toContain("Não foi possível");
  });
});
