import type { Category } from "./types";

const priority = [
  "violence",
  "fire",
  "robbery",
  "missing",
  "accident",
  "blocked",
  "theft",
  "other",
  "animal",
];
export function orderedCategories(categories: Category[]): Category[] {
  return categories
    .map((category) => ({
      ...category,
      name:
        category.id === "blocked" ? "Trânsito / via bloqueada" : category.name,
    }))
    .sort(
      (a, b) =>
        b.default_risk - a.default_risk ||
        (priority.indexOf(a.id) < 0
          ? priority.length
          : priority.indexOf(a.id)) -
          (priority.indexOf(b.id) < 0
            ? priority.length
            : priority.indexOf(b.id)) ||
        a.name.localeCompare(b.name, "pt-BR"),
    );
}
export function needsSpecificTitle(categoryId: string) {
  return categoryId === "other" || categoryId === "blocked";
}
export function nextReportTitle(
  title: string,
  previous: Category | undefined,
  next: Category,
) {
  const generated =
    previous &&
    (title === `${previous.name} · relato comunitário` ||
      (previous.id === "blocked" &&
        title === "Via bloqueada · relato comunitário"));
  if (title.trim() && !generated) return title;
  return needsSpecificTitle(next.id) ? "" : `${next.name} · relato comunitário`;
}
