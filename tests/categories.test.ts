import { describe, expect, it } from "vitest";
import { nextReportTitle, orderedCategories } from "../src/domain/categories";
import type { Category } from "../src/domain/types";
const categories: Category[] = [
  {
    id: "other",
    name: "Outra ocorrência",
    default_risk: 2,
    icon: "",
    active: true,
  },
  {
    id: "animal",
    name: "Animal perdido",
    default_risk: 1,
    icon: "",
    active: true,
  },
  {
    id: "violence",
    name: "Violência",
    default_risk: 4,
    icon: "",
    active: true,
  },
  {
    id: "blocked",
    name: "Via bloqueada",
    default_risk: 2,
    icon: "",
    active: true,
  },
];
describe("Categorias e título específico", () => {
  it("ordena pelo risco sugerido sem mudar os valores e sem modificar a origem", () => {
    const result = orderedCategories(categories);
    expect(result.map((c) => c.id)).toEqual([
      "violence",
      "blocked",
      "other",
      "animal",
    ]);
    expect(result.map((c) => c.default_risk)).toEqual([4, 2, 2, 1]);
    expect(categories[0]!.id).toBe("other");
    expect(categories[3]!.name).toBe("Via bloqueada");
    expect(result[1]!.name).toBe("Trânsito / via bloqueada");
  });
  it("trânsito e outra ocorrência pedem texto livre em vez de um título genérico", () => {
    expect(nextReportTitle("", undefined, categories[0]!)).toBe("");
    expect(
      nextReportTitle(
        "Violência · relato comunitário",
        categories[2],
        categories[3]!,
      ),
    ).toBe("");
    expect(nextReportTitle("", undefined, categories[2]!)).toBe(
      "Violência · relato comunitário",
    );
  });
  it("preserva o título escrito ao trocar de categoria e substitui somente sugestões", () => {
    expect(
      nextReportTitle("Semáforo apagado", categories[3], categories[0]!),
    ).toBe("Semáforo apagado");
    expect(
      nextReportTitle(
        "Via bloqueada · relato comunitário",
        categories[3],
        categories[2]!,
      ),
    ).toBe("Violência · relato comunitário");
  });
});
