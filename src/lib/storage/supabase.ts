import type { Comment, Item, Section, Template, TemplateSummary } from "../types";
import { newId } from "../id";
import { deepCopyTemplate } from "./deepCopy";
import { getSupabaseAdmin } from "./supabaseClient";
import type { CommentPatch, TemplateRepo } from "./types";

// ---------------------------------------------------------------------------
// Supabase (Postgres) storage driver - the real backend for the deployed app.
//
// Tables (see supabase/migrations/0001_init.sql):
//   templates(id, name, source, copied_from_id, created_at, updated_at)
//   sections(id, template_id, name, position)
//   items(id, section_id, name, position)
//   comments(id, item_id, name, body_html, type, severity, recommendation,
//            options jsonb, position, extra jsonb)
// Foreign keys cascade on delete.
// ---------------------------------------------------------------------------

function nowIso() {
  return new Date().toISOString();
}

export class SupabaseRepo implements TemplateRepo {
  private db = getSupabaseAdmin();

  async listTemplates(): Promise<TemplateSummary[]> {
    const { data: templates, error } = await this.db
      .from("templates")
      .select("id, name, source, copied_from_id, created_at, updated_at")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    if (!templates?.length) return [];

    // Fetch counts via lightweight joins.
    const ids = templates.map((t) => t.id);
    const { data: sections } = await this.db
      .from("sections")
      .select("id, template_id")
      .in("template_id", ids);
    const sectionIdToTemplate = new Map((sections ?? []).map((s) => [s.id, s.template_id]));
    const { data: items } = await this.db
      .from("items")
      .select("id, section_id")
      .in("section_id", (sections ?? []).map((s) => s.id).length ? (sections ?? []).map((s) => s.id) : ["_none_"]);
    const itemIdToTemplate = new Map(
      (items ?? []).map((i) => [i.id, sectionIdToTemplate.get(i.section_id)]),
    );
    const { data: comments } = await this.db
      .from("comments")
      .select("id, item_id")
      .in("item_id", (items ?? []).map((i) => i.id).length ? (items ?? []).map((i) => i.id) : ["_none_"]);

    const counts = new Map<string, { s: number; i: number; c: number }>();
    for (const t of templates) counts.set(t.id, { s: 0, i: 0, c: 0 });
    for (const s of sections ?? []) counts.get(s.template_id)!.s++;
    for (const i of items ?? []) {
      const tid = sectionIdToTemplate.get(i.section_id);
      if (tid) counts.get(tid)!.i++;
    }
    for (const c of comments ?? []) {
      const tid = itemIdToTemplate.get(c.item_id);
      if (tid) counts.get(tid)!.c++;
    }

    return templates.map((t) => ({
      id: t.id,
      name: t.name,
      source: t.source,
      copiedFromId: t.copied_from_id,
      createdAt: t.created_at,
      updatedAt: t.updated_at,
      sectionCount: counts.get(t.id)!.s,
      itemCount: counts.get(t.id)!.i,
      commentCount: counts.get(t.id)!.c,
    }));
  }

  async getTemplate(id: string): Promise<Template | null> {
    const { data: t, error } = await this.db
      .from("templates")
      .select("id, name, source, copied_from_id, created_at, updated_at")
      .eq("id", id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!t) return null;

    const { data: sections } = await this.db
      .from("sections")
      .select("id, name, position")
      .eq("template_id", id)
      .order("position");
    const sectionIds = (sections ?? []).map((s) => s.id);
    const { data: items } = await this.db
      .from("items")
      .select("id, section_id, name, position")
      .in("section_id", sectionIds.length ? sectionIds : ["_none_"])
      .order("position");
    const itemIds = (items ?? []).map((i) => i.id);
    const { data: comments } = await this.db
      .from("comments")
      .select("*")
      .in("item_id", itemIds.length ? itemIds : ["_none_"])
      .order("position");

    const commentsByItem = new Map<string, Comment[]>();
    for (const c of comments ?? []) {
      const list = commentsByItem.get(c.item_id) ?? [];
      list.push({
        id: c.id,
        name: c.name,
        bodyHtml: c.body_html,
        type: c.type,
        severity: c.severity,
        recommendation: c.recommendation,
        options: c.options ?? [],
        position: c.position,
        extra: c.extra ?? {},
      });
      commentsByItem.set(c.item_id, list);
    }
    const itemsBySection = new Map<string, Item[]>();
    for (const i of items ?? []) {
      const list = itemsBySection.get(i.section_id) ?? [];
      list.push({ id: i.id, name: i.name, position: i.position, comments: commentsByItem.get(i.id) ?? [] });
      itemsBySection.set(i.section_id, list);
    }
    const builtSections: Section[] = (sections ?? []).map((s) => ({
      id: s.id,
      name: s.name,
      position: s.position,
      items: itemsBySection.get(s.id) ?? [],
    }));

    return {
      id: t.id,
      name: t.name,
      source: t.source,
      copiedFromId: t.copied_from_id,
      createdAt: t.created_at,
      updatedAt: t.updated_at,
      sections: builtSections,
    };
  }

  async insertTemplate(template: Template): Promise<Template> {
    const { error: tErr } = await this.db.from("templates").insert({
      id: template.id,
      name: template.name,
      source: template.source,
      copied_from_id: template.copiedFromId,
      created_at: template.createdAt,
      updated_at: template.updatedAt,
    });
    if (tErr) throw new Error(tErr.message);

    const sectionRows = template.sections.map((s, si) => ({
      id: s.id,
      template_id: template.id,
      name: s.name,
      position: si,
    }));
    if (sectionRows.length) {
      const { error } = await this.db.from("sections").insert(sectionRows);
      if (error) throw new Error(error.message);
    }

    const itemRows = template.sections.flatMap((s) =>
      s.items.map((i, ii) => ({ id: i.id, section_id: s.id, name: i.name, position: ii })),
    );
    if (itemRows.length) {
      const { error } = await this.db.from("items").insert(itemRows);
      if (error) throw new Error(error.message);
    }

    const commentRows = template.sections.flatMap((s) =>
      s.items.flatMap((i) =>
        i.comments.map((c, ci) => ({
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
        })),
      ),
    );
    // Insert comments in chunks to stay within payload limits on large templates.
    for (let i = 0; i < commentRows.length; i += 500) {
      const chunk = commentRows.slice(i, i + 500);
      const { error } = await this.db.from("comments").insert(chunk);
      if (error) throw new Error(error.message);
    }
    return template;
  }

  async deleteTemplate(id: string): Promise<void> {
    // FK cascade removes sections/items/comments.
    const { error } = await this.db.from("templates").delete().eq("id", id);
    if (error) throw new Error(error.message);
  }

  private async touchTemplate(id: string) {
    await this.db.from("templates").update({ updated_at: nowIso() }).eq("id", id);
  }

  async updateTemplate(id: string, patch: { name?: string; source?: string | null }): Promise<void> {
    const update: Record<string, unknown> = { updated_at: nowIso() };
    if (patch.name !== undefined) update.name = patch.name;
    if (patch.source !== undefined) update.source = patch.source;
    const { error } = await this.db.from("templates").update(update).eq("id", id);
    if (error) throw new Error(error.message);
  }

  async updateSection(id: string, patch: { name?: string }): Promise<void> {
    const { data, error } = await this.db
      .from("sections")
      .update({ name: patch.name })
      .eq("id", id)
      .select("template_id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data?.template_id) await this.touchTemplate(data.template_id);
  }

  async updateItem(id: string, patch: { name?: string }): Promise<void> {
    const { data, error } = await this.db
      .from("items")
      .update({ name: patch.name })
      .eq("id", id)
      .select("section_id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data?.section_id) await this.touchViaSection(data.section_id);
  }

  async updateComment(id: string, patch: CommentPatch): Promise<void> {
    const update: Record<string, unknown> = {};
    if (patch.name !== undefined) update.name = patch.name;
    if (patch.bodyHtml !== undefined) update.body_html = patch.bodyHtml;
    if (patch.type !== undefined) update.type = patch.type;
    if (patch.severity !== undefined) update.severity = patch.severity;
    if (patch.recommendation !== undefined) update.recommendation = patch.recommendation;
    const { data, error } = await this.db
      .from("comments")
      .update(update)
      .eq("id", id)
      .select("item_id")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data?.item_id) await this.touchViaItem(data.item_id);
  }

  private async touchViaSection(sectionId: string) {
    const { data } = await this.db.from("sections").select("template_id").eq("id", sectionId).maybeSingle();
    if (data?.template_id) await this.touchTemplate(data.template_id);
  }
  private async touchViaItem(itemId: string) {
    const { data } = await this.db.from("items").select("section_id").eq("id", itemId).maybeSingle();
    if (data?.section_id) await this.touchViaSection(data.section_id);
  }

  async addSection(templateId: string, name: string): Promise<Section> {
    const { count } = await this.db
      .from("sections")
      .select("id", { count: "exact", head: true })
      .eq("template_id", templateId);
    const section: Section = { id: newId(), name, position: count ?? 0, items: [] };
    const { error } = await this.db
      .from("sections")
      .insert({ id: section.id, template_id: templateId, name, position: section.position });
    if (error) throw new Error(error.message);
    await this.touchTemplate(templateId);
    return section;
  }

  async addItem(sectionId: string, name: string): Promise<Item> {
    const { count } = await this.db
      .from("items")
      .select("id", { count: "exact", head: true })
      .eq("section_id", sectionId);
    const item: Item = { id: newId(), name, position: count ?? 0, comments: [] };
    const { error } = await this.db
      .from("items")
      .insert({ id: item.id, section_id: sectionId, name, position: item.position });
    if (error) throw new Error(error.message);
    await this.touchViaSection(sectionId);
    return item;
  }

  async addComment(itemId: string, name: string): Promise<Comment> {
    const { count } = await this.db
      .from("comments")
      .select("id", { count: "exact", head: true })
      .eq("item_id", itemId);
    const comment: Comment = {
      id: newId(),
      name,
      bodyHtml: "",
      type: "info",
      severity: "none",
      recommendation: null,
      options: [],
      position: count ?? 0,
      extra: {},
    };
    const { error } = await this.db.from("comments").insert({
      id: comment.id,
      item_id: itemId,
      name,
      body_html: "",
      type: "info",
      severity: "none",
      recommendation: null,
      options: [],
      position: comment.position,
      extra: {},
    });
    if (error) throw new Error(error.message);
    await this.touchViaItem(itemId);
    return comment;
  }

  async deleteSection(id: string): Promise<void> {
    const { error } = await this.db.from("sections").delete().eq("id", id);
    if (error) throw new Error(error.message);
  }
  async deleteItem(id: string): Promise<void> {
    const { error } = await this.db.from("items").delete().eq("id", id);
    if (error) throw new Error(error.message);
  }
  async deleteComment(id: string): Promise<void> {
    const { error } = await this.db.from("comments").delete().eq("id", id);
    if (error) throw new Error(error.message);
  }

  async copyTemplate(id: string, newName: string): Promise<Template> {
    const source = await this.getTemplate(id);
    if (!source) throw new Error("Template not found");
    const copy = deepCopyTemplate(source, newName);
    return this.insertTemplate(copy);
  }
}
