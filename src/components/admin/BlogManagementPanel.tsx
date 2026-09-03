import { useCallback, useEffect, useMemo, useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { BookOpen, Loader2, Pencil, Plus, Search, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  createBlogPost,
  deleteBlogPost,
  fetchAdminBlogPosts,
  formatBlogDate,
  slugifyBlogTitle,
  updateBlogPost,
  uploadBlogCoverImage,
  type SiteBlogPost,
} from "@/lib/siteBlogApi";

type Props = {
  client: SupabaseClient;
  currentUserId: string | null;
};

type EditorState = {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  author_name: string;
  published_at: string;
  is_active: boolean;
  is_featured: boolean;
  sort_order: number;
};

const emptyEditor = (): EditorState => ({
  title: "",
  slug: "",
  excerpt: "",
  content: "",
  author_name: "Apna Intern",
  published_at: new Date().toISOString().slice(0, 16),
  is_active: true,
  is_featured: false,
  sort_order: 0,
});

function toEditor(row: SiteBlogPost): EditorState {
  return {
    title: row.title || "",
    slug: row.slug || "",
    excerpt: row.excerpt || "",
    content: row.content || "",
    author_name: row.author_name || "Apna Intern",
    published_at: row.published_at
      ? new Date(row.published_at).toISOString().slice(0, 16)
      : new Date().toISOString().slice(0, 16),
    is_active: row.is_active !== false,
    is_featured: row.is_featured === true,
    sort_order: row.sort_order ?? 0,
  };
}

export function BlogManagementPanel({ client, currentUserId }: Props) {
  const [rows, setRows] = useState<SiteBlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SiteBlogPost | null>(null);
  const [form, setForm] = useState<EditorState>(emptyEditor);
  const [slugTouched, setSlugTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [uploadingCover, setUploadingCover] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await fetchAdminBlogPosts(client));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load blog posts.");
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      [row.title, row.slug, row.excerpt, row.author_name]
        .filter(Boolean)
        .some((part) => String(part).toLowerCase().includes(q))
    );
  }, [rows, search]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyEditor());
    setSlugTouched(false);
    setCoverFile(null);
    setDialogOpen(true);
  };

  const openEdit = (row: SiteBlogPost) => {
    setEditing(row);
    setForm(toEditor(row));
    setSlugTouched(true);
    setCoverFile(null);
    setDialogOpen(true);
  };

  const handleTitleChange = (title: string) => {
    setForm((prev) => ({
      ...prev,
      title,
      slug: slugTouched ? prev.slug : slugifyBlogTitle(title),
    }));
  };

  const savePost = async () => {
    if (!currentUserId) {
      toast.error("You must be signed in to manage blog posts.");
      return;
    }
    if (!form.title.trim()) {
      toast.error("Title is required.");
      return;
    }
    if (!form.content.trim()) {
      toast.error("Content is required.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        slug: form.slug.trim() || slugifyBlogTitle(form.title),
        excerpt: form.excerpt.trim() || null,
        content: form.content.trim(),
        author_name: form.author_name.trim() || "Apna Intern",
        published_at: form.published_at ? new Date(form.published_at).toISOString() : new Date().toISOString(),
        is_active: form.is_active,
        is_featured: form.is_featured,
        sort_order: Number(form.sort_order) || 0,
      };

      let postId = editing?.id;
      if (editing) {
        await updateBlogPost(client, editing.id, payload);
      } else {
        const created = await createBlogPost(client, currentUserId, payload);
        postId = created.id;
      }

      if (coverFile && postId) {
        setUploadingCover(true);
        await uploadBlogCoverImage(client, postId, coverFile);
      }

      toast.success(editing ? "Blog post updated." : "Blog post created.");
      setDialogOpen(false);
      setEditing(null);
      setCoverFile(null);
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSaving(false);
      setUploadingCover(false);
    }
  };

  const handleDelete = async (row: SiteBlogPost) => {
    if (!window.confirm(`Delete “${row.title}”? This cannot be undone.`)) return;
    try {
      await deleteBlogPost(client, row);
      toast.success("Blog post deleted.");
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed.");
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <BookOpen className="size-5 text-primary" /> Blog Management
          </h2>
          <p className="text-sm text-slate-600 mt-1 max-w-2xl">
            Create and manage blog posts for the public blog page and homepage section. Only active
            posts are visible on the site.
          </p>
        </div>
        <Button type="button" className="gap-2 font-bold" onClick={openCreate}>
          <Plus className="size-4" /> New post
        </Button>
      </div>

      <div className="rounded-2xl border bg-white p-5 shadow-sm space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search posts…"
              className="pl-9"
            />
          </div>
          {loading ? <Loader2 className="size-4 animate-spin text-slate-400" /> : null}
        </div>

        {filtered.length === 0 && !loading ? (
          <p className="text-sm text-slate-500">No blog posts yet.</p>
        ) : (
          <ScrollArea className="h-[32rem] rounded-xl border">
            <div className="divide-y">
              {filtered.map((row) => (
                <div
                  key={row.id}
                  className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="flex min-w-0 gap-4">
                    <div className="size-20 shrink-0 overflow-hidden rounded-xl border bg-slate-50">
                      {row.cover_image_url ? (
                        <img
                          src={row.cover_image_url}
                          alt={row.title}
                          className="size-full object-cover"
                        />
                      ) : (
                        <div className="flex size-full items-center justify-center text-xs text-slate-400">
                          No cover
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-slate-900 truncate">{row.title}</p>
                        {row.is_featured ? <Badge variant="secondary">Featured</Badge> : null}
                        {!row.is_active ? <Badge variant="outline">Hidden</Badge> : null}
                      </div>
                      <p className="text-xs text-slate-500">/{row.slug}</p>
                      <p className="text-sm text-slate-600 line-clamp-2">{row.excerpt || "—"}</p>
                      <p className="text-[11px] text-slate-400">
                        {row.author_name || "Apna Intern"} · {formatBlogDate(row.published_at || row.created_at)}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button type="button" size="sm" variant="outline" className="gap-1" onClick={() => openEdit(row)}>
                      <Pencil className="size-3" /> Edit
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      className="gap-1"
                      onClick={() => void handleDelete(row)}
                    >
                      <Trash2 className="size-3" /> Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit blog post" : "Create blog post"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Title</Label>
                <Input value={form.title} onChange={(e) => handleTitleChange(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Slug</Label>
                <Input
                  value={form.slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    setForm((prev) => ({ ...prev, slug: slugifyBlogTitle(e.target.value) }));
                  }}
                  placeholder="my-blog-post"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Author</Label>
                <Input
                  value={form.author_name}
                  onChange={(e) => setForm((prev) => ({ ...prev, author_name: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Excerpt</Label>
                <Textarea
                  value={form.excerpt}
                  onChange={(e) => setForm((prev) => ({ ...prev, excerpt: e.target.value }))}
                  rows={2}
                  placeholder="Short summary shown on cards"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Content</Label>
                <Textarea
                  value={form.content}
                  onChange={(e) => setForm((prev) => ({ ...prev, content: e.target.value }))}
                  rows={10}
                  placeholder="Write the full blog post content…"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Published at</Label>
                <Input
                  type="datetime-local"
                  value={form.published_at}
                  onChange={(e) => setForm((prev) => ({ ...prev, published_at: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Sort order</Label>
                <Input
                  type="number"
                  value={form.sort_order}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, sort_order: Number(e.target.value) || 0 }))
                  }
                />
              </div>
            </div>

            <div className="space-y-2 rounded-xl border p-4">
              <Label>Cover image</Label>
              {editing?.cover_image_url ? (
                <img
                  src={editing.cover_image_url}
                  alt={editing.title}
                  className="h-32 w-full rounded-lg object-cover"
                />
              ) : null}
              <Input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={(e) => setCoverFile(e.target.files?.[0] || null)}
              />
              {coverFile ? (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Upload className="size-3" /> {coverFile.name}
                </p>
              ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                <Label htmlFor="blog-active">Published</Label>
                <Switch
                  id="blog-active"
                  checked={form.is_active}
                  onCheckedChange={(checked) => setForm((prev) => ({ ...prev, is_active: checked }))}
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                <Label htmlFor="blog-featured">Featured on homepage</Label>
                <Switch
                  id="blog-featured"
                  checked={form.is_featured}
                  onCheckedChange={(checked) => setForm((prev) => ({ ...prev, is_featured: checked }))}
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={saving || uploadingCover} onClick={() => void savePost()}>
              {saving || uploadingCover ? <Loader2 className="size-4 animate-spin" /> : "Save post"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
