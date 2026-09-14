import type { Comment, Item, Section, Template, TemplateSummary } from "../types";

export interface CommentPatch {
  name?: string;
  bodyHtml?: string;
  type?: Comment["type"];
  severity?: Comment["severity"];
  recommendation?: string | null;
}

/**
 * A storage driver. Both the Supabase driver (real backend) and the local file
 * driver (offline dev demo) implement this identical, normalized interface, so
 * every feature behaves the same regardless of where data lives.
 *
 * The data model is relational: templates -> sections -> items -> comments.
 * Nothing is stored as an opaque blob; every node is individually editable.
 */
export interface TemplateRepo {
  listTemplates(): Promise<TemplateSummary[]>;
  getTemplate(id: string): Promise<Template | null>;

  /** Deep-insert an entire parsed template tree in one shot. */
  insertTemplate(template: Template): Promise<Template>;
  deleteTemplate(id: string): Promise<void>;

  updateTemplate(id: string, patch: { name?: string; source?: string | null }): Promise<void>;
  updateSection(id: string, patch: { name?: string }): Promise<void>;
  updateItem(id: string, patch: { name?: string }): Promise<void>;
  updateComment(id: string, patch: CommentPatch): Promise<void>;

  addSection(templateId: string, name: string): Promise<Section>;
  addItem(sectionId: string, name: string): Promise<Item>;
  addComment(itemId: string, name: string): Promise<Comment>;

  deleteSection(id: string): Promise<void>;
  deleteItem(id: string): Promise<void>;
  deleteComment(id: string): Promise<void>;

  /**
   * Duplicate a template. The copy gets brand-new ids throughout and its own
   * rows, so edits to the copy can never touch the original.
   */
  copyTemplate(id: string, newName: string): Promise<Template>;
}
