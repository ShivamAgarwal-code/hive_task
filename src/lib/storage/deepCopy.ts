import type { Template } from "../types";
import { newId } from "../id";

/**
 * Produce an independent deep copy of a template tree with fresh ids on every
 * node. This is the core of the "copy is independent of the original" guarantee:
 * the returned tree shares NO ids or object references with the source, so once
 * inserted it lives in its own rows.
 */
export function deepCopyTemplate(source: Template, newName: string): Template {
  const now = new Date().toISOString();
  return {
    id: newId(),
    name: newName,
    source: source.source,
    copiedFromId: source.id,
    createdAt: now,
    updatedAt: now,
    sections: source.sections.map((s, si) => ({
      id: newId(),
      name: s.name,
      position: si,
      items: s.items.map((it, ii) => ({
        id: newId(),
        name: it.name,
        position: ii,
        comments: it.comments.map((c, ci) => ({
          id: newId(),
          name: c.name,
          bodyHtml: c.bodyHtml,
          type: c.type,
          severity: c.severity,
          recommendation: c.recommendation,
          options: [...c.options],
          position: ci,
          extra: { ...c.extra },
        })),
      })),
    })),
  };
}
