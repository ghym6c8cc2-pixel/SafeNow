import { describe, it, expect } from "vitest";
import {
  authRedirect,
  parseAuthCallback,
  rootAuthReturn,
} from "../src/services/auth-links";
describe("Retorno de autenticação por plataforma", () => {
  it("encaminha retornos de Auth na Site URL raiz, preservando código e hash", () => {
    expect(rootAuthReturn("http://localhost:3000/?code=example")).toBe(
      "/auth/callback?code=example",
    );
    expect(
      rootAuthReturn(
        "http://localhost:3000/#access_token=example&refresh_token=example2&type=recovery",
      ),
    ).toContain("/auth/callback#access_token=");
    expect(rootAuthReturn("http://localhost:3000/")).toBeNull();
    expect(rootAuthReturn("http://localhost:3000/alert/id?code=x")).toBeNull();
    expect(rootAuthReturn("javascript:alert(1)")).toBeNull();
  });
  it("usa a origem web atual, inclusive a porta escolhida", () => {
    expect(authRedirect("web", "http://127.0.0.1:8090", "signup")).toBe(
      "http://127.0.0.1:8090/auth/callback?flow=signup",
    );
    expect(authRedirect("web", "https://safenow.example", "recovery")).toBe(
      "https://safenow.example/auth/callback?flow=recovery",
    );
  });
  it("mantém o deep link do app nativo", () => {
    expect(authRedirect("android", undefined, "signup")).toBe(
      "safenow://auth/callback?flow=signup",
    );
    expect(authRedirect("ios", undefined, "recovery")).toBe(
      "safenow://auth/callback?flow=recovery",
    );
  });
  it("não aceita origem ausente ou protocolo executável", () => {
    expect(() => authRedirect("web", undefined, "signup")).toThrow();
    expect(() =>
      authRedirect("web", "javascript:alert(1)", "signup"),
    ).toThrow();
    expect(() => parseAuthCallback("javascript:alert(1)")).toThrow();
  });
  it("distingue confirmação de cadastro de recuperação", () => {
    expect(
      parseAuthCallback(
        "http://localhost:8081/auth/callback?flow=signup&code=example",
      ).recovery,
    ).toBe(false);
    expect(
      parseAuthCallback(
        "http://localhost:8081/auth/callback?flow=recovery&code=example",
      ),
    ).toMatchObject({ code: "example", recovery: true, tokens: null });
  });
  it("aceita o retorno legado por hash sem registrar tokens em logs", () => {
    expect(
      parseAuthCallback(
        "safenow://auth/callback#access_token=example&refresh_token=example2&type=recovery",
      ),
    ).toMatchObject({
      code: null,
      recovery: true,
      tokens: { access_token: "example", refresh_token: "example2" },
    });
  });
  it("recusa links sem código e respostas de erro", () => {
    expect(() =>
      parseAuthCallback("https://safenow.example/auth/callback"),
    ).toThrow();
    expect(() =>
      parseAuthCallback(
        "https://safenow.example/auth/callback?error=access_denied&code=x",
      ),
    ).toThrow();
  });
});
