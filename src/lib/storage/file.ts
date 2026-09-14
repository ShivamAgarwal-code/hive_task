import { promises as fs } from "node:fs";
import path from "node:path";
import type { Comment, Item, Section, Template, TemplateSummary } from "../types";
import { newId } from "../id";
import { deepCopyTemplate } from "./deepCopy";
import type { CommentPatch, TemplateRepo } from "./types";

// ---------------------------------------------------------------------------
// Local file storage driver.
//
// A real, on-disk, normalized store used for offline development and demos. It
// mirrors the relational shape of the Supabase schema (separate templates /
// sections / items / comments collections joined by foreign keys) so behavior
// is identical to production. Data survives app restarts.
//
// NOTE: this is for local dev only. The deployed app uses the Supabase driver.
// ---------------------------------------------------------------------------

interface TemplateRow {
  id: string;
  name: string;
  source: string | null;
  copied_from_id: string | null;
  created_at: string;
  updated_at: string;
}
interface SectionRow {
  id: string;
  template_id: string;
  name: string;
  position: number;
}
interface ItemRow {
  id: string;
  section_id: string;
  name: string;
  position: number;
}
interface CommentRow {
  id: string;
  item_id: string;
  name: string;
  body_html: string;
  type: Comment["type"];
  severity: Comment["severity"];
  recommendation: string | null;
  options: string[];
  position: number;
  extra: Record<string, string>;
}
interface DB {
  templates: TemplateRow[];
  sections: SectionRow[];
  items: ItemRow[];
  comments: CommentRow[];
}

const DATA_DIR = path.join(process.cwd(), ".data");
const DB_PATH = path.join(DATA_DIR, "db.json");

let chain: Promise<unknown> = Promise.resolve();
/** Serialize all reads/writes to avoid interleaved file writes clobbering data. */
function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn, fn);
  chain = run.catch(() => undefined);
  return run;
}

async function load(): Promise<DB> {
  try {
    const raw = await fs.readFile(DB_PATH, "utf8");
    const db = JSON.parse(raw) as Partial<DB>;
    return {
      templates: db.templates ?? [],
      sections: db.sections ?? [],
      items: db.items ?? [],
      comments: db.comments ?? [],
    };
  } catch {
    return { templates: [], sections: [], items: [], comments: [] };
  }
}

async function save(db: DB): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmp = DB_PATH + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(db, null, 2), "utf8");
  await fs.rename(tmp, DB_PATH);
}

function bump(db: DB, templateId: string) {
  const t = db.templates.find((x) => x.id === templateId);
  if (t) t.updated_at = new Date().toISOString();
}

function assembleTree(db: DB, t: TemplateRow): Template {
  const sections: Section[] = db.sections
    .filter((s) => s.template_id === t.id)
    .sort((a, b) => a.position - b.position)
    .map((s) => {
      const items: Item[] = db.items
        .filter((i) => i.section_id === s.id)
        .sort((a, b) => a.position - b.position)
        .map((i) => {
          const comments: Comment[] = db.comments
            .filter((c) => c.item_id === i.id)
            .sort((a, b) => a.position - b.position)
            .map((c) => ({
              id: c.id,
              name: c.name,
              bodyHtml: c.body_html,
              type: c.type,
              severity: c.severity,
              recommendation: c.recommendation,
              options: c.options ?? [],
              position: c.position,
              extra: c.extra ?? {},
            }));
          return { id: i.id, name: i.name, position: i.position, comments };
        });
      return { id: s.id, name: s.name, position: s.position, items };
    });
  return {
    id: t.id,
    name: t.name,
    source: t.source,
    copiedFromId: t.copied_from_id,
    createdAt: t.created_at,
    updatedAt: t.updated_at,
    sections,
  };
}

/** Find which template a node belongs to, for updated_at bumping. */
function templateIdOfSection(db: DB, sectionId: string): string | undefined {
  return db.sections.find((s) => s.id === sectionId)?.template_id;
}
function templateIdOfItem(db: DB, itemId: string): string | undefined {
  const item = db.items.find((i) => i.id === itemId);
  return item ? templateIdOfSection(db, item.section_id) : undefined;
}
function templateIdOfComment(db: DB, commentId: string): string | undefined {
  const c = db.comments.find((x) => x.id === commentId);
  return c ? templateIdOfItem(db, c.item_id) : undefined;
}

export class FileRepo implements TemplateRepo {
  async listTemplates(): Promise<TemplateSummary[]> {
    return withLock(async () => {
      const db = await load();
      return db.templates
        .map((t) => {
          const sectionIds = new Set(db.sections.filter((s) => s.template_id === t.id).map((s) => s.id));
          const itemIds = new Set(db.items.filter((i) => sectionIds.has(i.section_id)).map((i) => i.id));
          const commentCount = db.comments.filter((c) => itemIds.has(c.item_id)).length;
          return {
            id: t.id,
            name: t.name,
            source: t.source,
            copiedFromId: t.copied_from_id,
            createdAt: t.created_at,
            updatedAt: t.updated_at,
            sectionCount: sectionIds.size,
            itemCount: itemIds.size,
            commentCount,
          } satisfies TemplateSummary;
        })
        .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
    });
  }

  async getTemplate(id: string): Promise<Template | null> {
    return withLock(async () => {
      const db = await load();
      const t = db.templates.find((x) => x.id === id);
      return t ? assembleTree(db, t) : null;
    });
  }

  async insertTemplate(template: Template): Promise<Template> {
    return withLock(async () => {
      const db = await load();
      db.templates.push({
        id: template.id,
        name: template.name,
        source: template.source,
        copied_from_id: template.copiedFromId,
        created_at: template.createdAt,
        updated_at: template.updatedAt,
      });
      template.sections.forEach((s, si) => {
        db.sections.push({ id: s.id, template_id: template.id, name: s.name, position: si });
        s.items.forEach((i, ii) => {
          db.items.push({ id: i.id, section_id: s.id, name: i.name, position: ii });
          i.comments.forEach((c, ci) => {
            db.comments.push({
              id: c.id,
              item_id: i.id,
              name: c.name,
              body_html: c.bodyHtml,
              type: c.type,
              severity: c.severity,
              recommendation: c.recommendation,
              options: c.options,
              position: ci,
              extra: c.extra,
            });
          });
        });
      });
      await save(db);
      return template;
    });
  }

  async deleteTemplate(id: string): Promise<void> {
    return withLock(async () => {
      const db = await load();
      const sectionIds = new Set(db.sections.filter((s) => s.template_id === id).map((s) => s.id));
      const itemIds = new Set(db.items.filter((i) => sectionIds.has(i.section_id)).map((i) => i.id));
      db.comments = db.comments.filter((c) => !itemIds.has(c.item_id));
      db.items = db.items.filter((i) => !sectionIds.has(i.section_id));
      db.sections = db.sections.filter((s) => s.template_id !== id);
      db.templates = db.templates.filter((t) => t.id !== id);
      await save(db);
    });
  }

  async updateTemplate(id: string, patch: { name?: string; source?: string | null }): Promise<void> {
    return withLock(async () => {
      const db = await load();
      const t = db.templates.find((x) => x.id === id);
      if (!t) throw new Error("Template not found");
      if (patch.name !== undefined) t.name = patch.name;
      if (patch.source !== undefined) t.source = patch.source;
      t.updated_at = new Date().toISOString();
      await save(db);
    });
  }

  async updateSection(id: string, patch: { name?: string }): Promise<void> {
    return withLock(async () => {
      const db = await load();
      const s = db.sections.find((x) => x.id === id);
      if (!s) throw new Error("Section not found");
      if (patch.name !== undefined) s.name = patch.name;
      bump(db, s.template_id);
      await save(db);
    });
  }

  async updateItem(id: string, patch: { name?: string }): Promise<void> {
    return withLock(async () => {
      const db = await load();
      const i = db.items.find((x) => x.id === id);
      if (!i) throw new Error("Item not found");
      if (patch.name !== undefined) i.name = patch.name;
      const tid = templateIdOfSection(db, i.section_id);
      if (tid) bump(db, tid);
      await save(db);
    });
  }

  async updateComment(id: string, patch: CommentPatch): Promise<void> {
    return withLock(async () => {
      const db = await load();
      const c = db.comments.find((x) => x.id === id);
      if (!c) throw new Error("Comment not found");
      if (patch.name !== undefined) c.name = patch.name;
      if (patch.bodyHtml !== undefined) c.body_html = patch.bodyHtml;
      if (patch.type !== undefined) c.type = patch.type;
      if (patch.severity !== undefined) c.severity = patch.severity;
      if (patch.recommendation !== undefined) c.recommendation = patch.recommendation;
      const tid = templateIdOfComment(db, id);
      if (tid) bump(db, tid);
      await save(db);
    });
  }

  async addSection(templateId: string, name: string): Promise<Section> {
    return withLock(async () => {
      const db = await load();
      const position = db.sections.filter((s) => s.template_id === templateId).length;
      const section: Section = { id: newId(), name, position, items: [] };
      db.sections.push({ id: section.id, template_id: templateId, name, position });
      bump(db, templateId);
      await save(db);
      return section;
    });
  }

  async addItem(sectionId: string, name: string): Promise<Item> {
    return withLock(async () => {
      const db = await load();
      const position = db.items.filter((i) => i.section_id === sectionId).length;
      const item: Item = { id: newId(), name, position, comments: [] };
      db.items.push({ id: item.id, section_id: sectionId, name, position });
      const tid = templateIdOfSection(db, sectionId);
      if (tid) bump(db, tid);
      await save(db);
      return item;
    });
  }

  async addComment(itemId: string, name: string): Promise<Comment> {
    return withLock(async () => {
      const db = await load();
      const position = db.comments.filter((c) => c.item_id === itemId).length;
      const comment: Comment = {
        id: newId(),
        name,
        bodyHtml: "",
        type: "info",
        severity: "none",
        recommendation: null,
        options: [],
        position,
        extra: {},
      };
      db.comments.push({
        id: comment.id,
        item_id: itemId,
        name,
        body_html: "",
        type: "info",
        severity: "none",
        recommendation: null,
        options: [],
        position,
        extra: {},
      });
      const tid = templateIdOfItem(db, itemId);
      if (tid) bump(db, tid);
      await save(db);
      return comment;
    });
  }

  async deleteSection(id: string): Promise<void> {
    return withLock(async () => {
      const db = await load();
      const tid = templateIdOfSection(db, id);
      const itemIds = new Set(db.items.filter((i) => i.section_id === id).map((i) => i.id));
      db.comments = db.comments.filter((c) => !itemIds.has(c.item_id));
      db.items = db.items.filter((i) => i.section_id !== id);
      db.sections = db.sections.filter((s) => s.id !== id);
      if (tid) bump(db, tid);
      await save(db);
    });
  }

  async deleteItem(id: string): Promise<void> {
    return withLock(async () => {
      const db = await load();
      const tid = templateIdOfItem(db, id);
      db.comments = db.comments.filter((c) => c.item_id !== id);
      db.items = db.items.filter((i) => i.id !== id);
      if (tid) bump(db, tid);
      await save(db);
    });
  }

  async deleteComment(id: string): Promise<void> {
    return withLock(async () => {
      const db = await load();
      const tid = templateIdOfComment(db, id);
      db.comments = db.comments.filter((c) => c.id !== id);
      if (tid) bump(db, tid);
      await save(db);
    });
  }

  async copyTemplate(id: string, newName: string): Promise<Template> {
    const source = await this.getTemplate(id);
    if (!source) throw new Error("Template not found");
    const copy = deepCopyTemplate(source, newName);
    return this.insertTemplate(copy);
  }
}
