import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CalendarClock,
  Eye,
  FileText,
  ImagePlus,
  Loader2,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Upload,
  Video,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BlogMarkdownContent } from "@/components/blog/BlogMarkdownContent";
import {
  adminCardClass,
  adminHeroClass,
  adminStatCardClass,
} from "@/components/admin/ui/adminStyles";
import {
  blogStatusLabel,
  createBlogPost,
  deleteBlogPost,
  estimateReadMinutes,
  fetchAdminBlogPosts,
  formatBlogDate,
  formatSiteBlogError,
  isBlogPostPublic,
  slugifyBlogTitle,
  updateBlogPost,
  uploadBlogContentImage,
  uploadBlogCoverImage,
  type BlogPostStatus,
  type BlogPostType,
  type SiteBlogPost,
} from "@/lib/siteBlogApi";
import { cn } from "@/lib/utils";

type Props = {
  client: SupabaseClient;
  currentUserId: string | null;
};

type EditorState = {
  id?: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  author_name: string;
  post_type: BlogPostType;
  status: BlogPostStatus;
  scheduled_at: string;
  published_at: string;
  meta_title: string;
  meta_description: string;
  tags: string;
  is_featured: boolean;
  is_active: boolean;
  sort_order: number;
  cover_image_url?: string | null;
};

const EMPTY_EDITOR: EditorState = {
  title: "",
  slug: "",
  excerpt: "",
  content: "",
  author_name: "Apna Intern",
  post_type: "blog",
  status: "draft",
  scheduled_at: "",
  published_at: "",
  meta_title: "",
  meta_description: "",
  tags: "",
  is_featured: false,
  is_active: true,
  sort_order: 0,
};

function toLocalDatetimeInput(iso?: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalDatetimeInput(value: string): string | null {
  if (!value.trim()) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function rowToEditor(row: SiteBlogPost): EditorState {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    excerpt: row.excerpt || "",
    content: row.content,
    author_name: row.author_name || "Apna Intern",
    post_type: row.post_type || "blog",
    status: row.status || "draft",
    scheduled_at: toLocalDatetimeInput(row.scheduled_at),
    published_at: toLocalDatetimeInput(row.published_at),
    meta_title: row.meta_title || "",
    meta_description: row.meta_description || "",
    tags: (row.tags || []).join(", "),
    is_featured: row.is_featured,
    is_active: row.is_active,
    sort_order: row.sort_order ?? 0,
    cover_image_url: row.cover_image_url,
  };
}

function statusBadgeClass(status: BlogPostStatus): string {
  switch (status) {
    case "published":
      return "bg-emerald-100 text-emerald-800 border-emerald-200";
    case "scheduled":
      return "bg-amber-100 text-amber-800 border-amber-200";
    default:
      return "bg-slate-100 text-slate-600 border-slate-200";
  }
}

export function BlogManagementPanel({ client, currentUserId }: Props) {
  const [rows, setRows] = useState<SiteBlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | BlogPostStatus>("all");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editor, setEditor] = useState<EditorState>(EMPTY_EDITOR);
  const [editorTab, setEditorTab] = useState<"write" | "preview">("write");
  const [saving, setSaving] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingInline, setUploadingInline] = useState(false);
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const inlineFileRef = useRef<HTMLInputElement>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await fetchAdminBlogPosts(client));
    } catch (err) {
      toast.error(formatSiteBlogError(err));
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const stats = useMemo(() => {
    const published = rows.filter((r) => r.status === "published").length;
    const scheduled = rows.filter((r) => r.status === "scheduled").length;
    const draft = rows.filter((r) => r.status === "draft").length;
    const live = rows.filter((r) => isBlogPostPublic(r)).length;
    return { published, scheduled, draft, live, total: rows.length };
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter !== "all" && r.status !== filter) return false;
      if (!q) return true;
      return (
        r.title.toLowerCase().includes(q) ||
        r.slug.toLowerCase().includes(q) ||
        (r.excerpt || "").toLowerCase().includes(q)
      );
    });
  }, [rows, search, filter]);

  const openCreate = () => {
    setEditor({ ...EMPTY_EDITOR });
    setEditorTab("write");
    setEditorOpen(true);
  };

  const openEdit = (row: SiteBlogPost) => {
    setEditor(rowToEditor(row));
    setEditorTab("write");
    setEditorOpen(true);
  };

  const insertAtCursor = (snippet: string) => {
    const el = contentRef.current;
    if (!el) {
      setEditor((e) => ({ ...e, content: e.content + snippet }));
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const next = editor.content.slice(0, start) + snippet + editor.content.slice(end);
    setEditor((e) => ({ ...e, content: next }));
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = start + snippet.length;
    });
  };

  const handleSave = async () => {
    let userId = currentUserId?.trim() || "";
    if (!userId) {
      const { data: sessionData } = await client.auth.getSession();
      userId = sessionData.session?.user?.id?.trim() || "";
    }
    if (!userId) {
      toast.error("Sign in to save blog posts.");
      return;
    }
    if (!editor.title.trim() || !editor.content.trim()) {
      toast.error("Title and content are required.");
      return;
    }
    if (editor.status === "scheduled" && !editor.scheduled_at) {
      toast.error("Pick a schedule date & time.");
      return;
    }

    setSaving(true);
    try {
      const tags = editor.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      const payload = {
        title: editor.title,
        slug: editor.slug || slugifyBlogTitle(editor.title),
        excerpt: editor.excerpt,
        content: editor.content,
        author_name: editor.author_name,
        post_type: editor.post_type,
        status: editor.status,
        scheduled_at: fromLocalDatetimeInput(editor.scheduled_at),
        published_at:
          editor.status === "published"
            ? fromLocalDatetimeInput(editor.published_at) || new Date().toISOString()
            : null,
        meta_title: editor.meta_title,
        meta_description: editor.meta_description,
        tags,
        is_featured: editor.is_featured,
        is_active: editor.is_active,
        sort_order: editor.sort_order,
      };

      if (editor.id) {
        await updateBlogPost(client, editor.id, payload);
        toast.success("Blog post updated.");
      } else {
        await createBlogPost(client, userId, payload);
        toast.success("Blog post created.");
      }
      setEditorOpen(false);
      await reload();
    } catch (err) {
      toast.error(formatSiteBlogError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row: SiteBlogPost) => {
    if (!window.confirm(`Delete "${row.title}"?`)) return;
    try {
      await deleteBlogPost(client, row);
      toast.success("Deleted.");
      await reload();
    } catch (err) {
      toast.error(formatSiteBlogError(err));
    }
  };

  const handleCoverUpload = async (file: File) => {
    if (!editor.id) {
      toast.error("Save the post first, then upload a cover image.");
      return;
    }
    setUploadingCover(true);
    try {
      const { cover_image_url } = await uploadBlogCoverImage(client, editor.id, file);
      setEditor((e) => ({ ...e, cover_image_url }));
      toast.success("Cover image uploaded.");
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Cover upload failed.");
    } finally {
      setUploadingCover(false);
    }
  };

  const handleInlineImage = async (file: File) => {
    let postId = editor.id;
    if (!postId) {
      if (!currentUserId || !editor.title.trim() || !editor.content.trim()) {
        toast.error("Add title & content, save once, then insert images.");
        return;
      }
      const created = await createBlogPost(client, currentUserId, {
        title: editor.title,
        content: editor.content,
        excerpt: editor.excerpt,
        status: "draft",
      });
      postId = created.id;
      setEditor((e) => ({ ...e, id: postId }));
    }
    setUploadingInline(true);
    try {
      const url = await uploadBlogContentImage(client, postId!, file);
      insertAtCursor(`\n\n![${file.name.replace(/\.[^.]+$/, "")}](${url})\n\n`);
      toast.success("Image inserted into content.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Image upload failed.");
    } finally {
      setUploadingInline(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className={adminHeroClass}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#5AA3E6]">Website & CMS</p>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Blog & Vlog Studio</h2>
            <p className="mt-1 max-w-xl text-sm text-slate-600">
              Write in Markdown — <strong># headings</strong>, <strong>**bold**</strong>, links, and inline images.
              Schedule publish or go live instantly. Readers see a full-screen article (no site header/footer).
            </p>
          </div>
          <Button onClick={openCreate} className="shrink-0 bg-[#5AA3E6] hover:bg-[#4a92d5]">
            <Plus className="mr-2 size-4" /> New post
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Total posts", value: stats.total },
          { label: "Live now", value: stats.live },
          { label: "Scheduled", value: stats.scheduled },
          { label: "Drafts", value: stats.draft },
        ].map((s) => (
          <div key={s.label} className={cn(adminStatCardClass, "p-4")}>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{s.label}</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{s.value}</p>
          </div>
        ))}
      </div>

      <div className={cn(adminCardClass, "p-4")}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search title or slug…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              <SelectItem value="published">Published</SelectItem>
              <SelectItem value="scheduled">Scheduled</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="size-8 animate-spin text-[#5AA3E6]" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-12 text-center text-sm text-slate-500">No posts match your filters.</p>
        ) : (
          <ScrollArea className="mt-4 max-h-[520px]">
            <div className="space-y-2 pr-3">
              {filtered.map((row) => (
                <div
                  key={row.id}
                  className="flex flex-col gap-3 rounded-xl border border-slate-200/80 bg-slate-50/50 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline" className={statusBadgeClass(row.status)}>
                        {blogStatusLabel(row.status)}
                      </Badge>
                      <Badge variant="outline" className="capitalize">
                        {row.post_type === "vlog" ? (
                          <span className="inline-flex items-center gap-1">
                            <Video className="size-3" /> vlog
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1">
                            <FileText className="size-3" /> blog
                          </span>
                        )}
                      </Badge>
                      {row.is_featured ? (
                        <Badge className="bg-[#5AA3E6]/15 text-[#2563eb] hover:bg-[#5AA3E6]/20">
                          <Sparkles className="mr-1 size-3" /> Featured
                        </Badge>
                      ) : null}
                      {isBlogPostPublic(row) ? (
                        <Badge variant="outline" className="border-emerald-200 text-emerald-700">
                          Live
                        </Badge>
                      ) : null}
                    </div>
                    <p className="mt-2 truncate font-semibold text-slate-900">{row.title}</p>
                    <p className="text-xs text-slate-500">
                      /blog/{row.slug} · {formatBlogDate(row.published_at || row.scheduled_at || row.created_at)} ·{" "}
                      {estimateReadMinutes(row.content)} min
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {isBlogPostPublic(row) ? (
                      <Button variant="outline" size="sm" asChild>
                        <a href={`/blog/${row.slug}`} target="_blank" rel="noopener noreferrer">
                          <Eye className="mr-1 size-3.5" /> View
                        </a>
                      </Button>
                    ) : null}
                    <Button variant="outline" size="sm" onClick={() => openEdit(row)}>
                      <Pencil className="mr-1 size-3.5" /> Edit
                    </Button>
                    <Button variant="outline" size="sm" className="text-red-600" onClick={() => void handleDelete(row)}>
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editor.id ? "Edit post" : "New blog / vlog post"}</DialogTitle>
          </DialogHeader>

          <Tabs value={editorTab} onValueChange={(v) => setEditorTab(v as typeof editorTab)}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="write">Write</TabsTrigger>
              <TabsTrigger value="preview">Preview</TabsTrigger>
            </TabsList>

            <TabsContent value="write" className="mt-4 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label>Title</Label>
                  <Input
                    value={editor.title}
                    onChange={(e) =>
                      setEditor((s) => ({
                        ...s,
                        title: e.target.value,
                        slug: s.slug || slugifyBlogTitle(e.target.value),
                      }))
                    }
                    placeholder="Internship tips for 2026"
                  />
                </div>
                <div className="space-y-2">
                  <Label>URL slug</Label>
                  <Input
                    value={editor.slug}
                    onChange={(e) => setEditor((s) => ({ ...s, slug: slugifyBlogTitle(e.target.value) }))}
                    placeholder="internship-tips-2026"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Author</Label>
                  <Input
                    value={editor.author_name}
                    onChange={(e) => setEditor((s) => ({ ...s, author_name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select
                    value={editor.post_type}
                    onValueChange={(v) => setEditor((s) => ({ ...s, post_type: v as BlogPostType }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="blog">Blog (text + images)</SelectItem>
                      <SelectItem value="vlog">Vlog (image-rich story)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={editor.status}
                    onValueChange={(v) => setEditor((s) => ({ ...s, status: v as BlogPostStatus }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="published">Publish now</SelectItem>
                      <SelectItem value="scheduled">Schedule</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {editor.status === "scheduled" ? (
                  <div className="space-y-2">
                    <Label className="inline-flex items-center gap-1">
                      <CalendarClock className="size-3.5" /> Schedule for
                    </Label>
                    <Input
                      type="datetime-local"
                      value={editor.scheduled_at}
                      onChange={(e) => setEditor((s) => ({ ...s, scheduled_at: e.target.value }))}
                    />
                  </div>
                ) : null}
                {editor.status === "published" ? (
                  <div className="space-y-2">
                    <Label>Published date (optional)</Label>
                    <Input
                      type="datetime-local"
                      value={editor.published_at}
                      onChange={(e) => setEditor((s) => ({ ...s, published_at: e.target.value }))}
                    />
                  </div>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label>Excerpt (listing card)</Label>
                <Textarea
                  rows={2}
                  value={editor.excerpt}
                  onChange={(e) => setEditor((s) => ({ ...s, excerpt: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Label>Content (Markdown)</Label>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => insertAtCursor("\n## Heading\n")}
                    >
                      # H
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => insertAtCursor("**bold**")}>
                      **B**
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => insertAtCursor("[link text](https://example.com)")}
                    >
                      Link
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={uploadingInline}
                      onClick={() => inlineFileRef.current?.click()}
                    >
                      {uploadingInline ? (
                        <Loader2 className="mr-1 size-3.5 animate-spin" />
                      ) : (
                        <ImagePlus className="mr-1 size-3.5" />
                      )}
                      Insert image
                    </Button>
                    <input
                      ref={inlineFileRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void handleInlineImage(f);
                        e.target.value = "";
                      }}
                    />
                  </div>
                </div>
                <p className="text-xs text-slate-500">
                  Use <code className="rounded bg-slate-100 px-1"># Heading</code>,{" "}
                  <code className="rounded bg-slate-100 px-1">**bold**</code>,{" "}
                  <code className="rounded bg-slate-100 px-1">[text](url)</code>,{" "}
                  <code className="rounded bg-slate-100 px-1">![caption](image-url)</code>
                </p>
                <Textarea
                  ref={contentRef}
                  rows={14}
                  value={editor.content}
                  onChange={(e) => setEditor((s) => ({ ...s, content: e.target.value }))}
                  className="font-mono text-sm"
                  placeholder={"# Welcome\n\nWrite your story here.\n\n![Photo description](https://...)\n\n**Bold** and [links](https://apnaintern.in) work too."}
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>SEO title</Label>
                  <Input
                    value={editor.meta_title}
                    onChange={(e) => setEditor((s) => ({ ...s, meta_title: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tags (comma separated)</Label>
                  <Input
                    value={editor.tags}
                    onChange={(e) => setEditor((s) => ({ ...s, tags: e.target.value }))}
                    placeholder="internship, career, tips"
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>SEO description</Label>
                  <Textarea
                    rows={2}
                    value={editor.meta_description}
                    onChange={(e) => setEditor((s) => ({ ...s, meta_description: e.target.value }))}
                  />
                </div>
              </div>

              <div className="rounded-xl border border-dashed border-slate-200 p-4">
                <Label>Cover image</Label>
                {editor.cover_image_url ? (
                  <img src={editor.cover_image_url} alt="" className="mt-2 max-h-40 rounded-lg object-cover" />
                ) : null}
                <div className="mt-2 flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!editor.id || uploadingCover}
                    onClick={() => {
                      const input = document.createElement("input");
                      input.type = "file";
                      input.accept = "image/*";
                      input.onchange = () => {
                        const f = input.files?.[0];
                        if (f) void handleCoverUpload(f);
                      };
                      input.click();
                    }}
                  >
                    {uploadingCover ? (
                      <Loader2 className="mr-1 size-3.5 animate-spin" />
                    ) : (
                      <Upload className="mr-1 size-3.5" />
                    )}
                    Upload cover
                  </Button>
                  {!editor.id ? (
                    <p className="self-center text-xs text-slate-500">Save post first to upload cover.</p>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-wrap gap-6">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={editor.is_featured}
                    onCheckedChange={(v) => setEditor((s) => ({ ...s, is_featured: v }))}
                  />
                  <Label>Featured on home</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={editor.is_active}
                    onCheckedChange={(v) => setEditor((s) => ({ ...s, is_active: v }))}
                  />
                  <Label>Active</Label>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="preview" className="mt-4">
              <div className="rounded-xl border border-slate-200 bg-white p-6">
                <h3 className="font-serif text-2xl font-bold">{editor.title || "Untitled"}</h3>
                {editor.excerpt ? <p className="mt-2 text-slate-600">{editor.excerpt}</p> : null}
                <div className="my-6 h-px bg-slate-200" />
                <BlogMarkdownContent content={editor.content || "*Nothing to preview yet.*"} />
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditorOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleSave()} disabled={saving} className="bg-[#5AA3E6] hover:bg-[#4a92d5]">
              {saving ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
              {editor.status === "published" ? "Publish" : editor.status === "scheduled" ? "Schedule" : "Save draft"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
