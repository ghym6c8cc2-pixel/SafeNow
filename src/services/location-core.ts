import type { Position } from "../domain/types";
import { validatePosition } from "../domain/rules";
export interface LocationGateway {
  enabled(): Promise<boolean>;
  permission(): Promise<boolean>;
  current(): Promise<Position>;
}
export async function locateWith(g: LocationGateway): Promise<Position> {
  if (!(await g.enabled()))
    throw new Error("Ative a localização do dispositivo para usar o GPS.");
  if (!(await g.permission()))
    throw new Error(
      "Localização não autorizada. Você pode conceder acesso nas configurações do dispositivo.",
    );
  const p = await g.current();
  if (!validatePosition(p))
    throw new Error("O GPS retornou uma posição inválida. Tente novamente.");
  return p;
}
export function accuracyLabel(p: Position | null) {
  if (!p) return "GPS ainda não confirmado";
  if (p.accuracy === null) return "Precisão não informada pelo dispositivo";
  return `Precisão aproximada: ${Math.round(p.accuracy)} m${p.accuracy > 20 ? " · sinal impreciso" : ""}`;
}
