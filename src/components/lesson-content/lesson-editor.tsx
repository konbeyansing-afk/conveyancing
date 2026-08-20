"use client";

import { useState } from "react";
import { useEditor, EditorContent, type JSONContent } from "@tiptap/react";
import { tiptapExtensions } from "@/lib/tiptap/extensions";
import { Button, buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Bold,
  Italic,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Table as TableIcon,
  AlertTriangle,
  Info,
  Lightbulb,
  Image as ImageIcon,
  Video,
  Undo2,
  Redo2,
} from "lucide-react";
import { isAllowedEmbedUrl } from "@/lib/tiptap/embed-extension";

const EMPTY_DOC: JSONContent = { type: "doc", content: [{ type: "paragraph" }] };

export function LessonEditor({
  initialContent,
  onSave,
  emptyHint,
}: {
  initialContent: JSONContent | null;
  onSave: (content: JSONContent) => Promise<void>;
  emptyHint?: string;
}) {
  const [saving, setSaving] = useState(false);
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState("");
  const [imageAlt, setImageAlt] = useState("");
  const [videoDialogOpen, setVideoDialogOpen] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");
  const [videoError, setVideoError] = useState<string | null>(null);

  const editor = useEditor({
    extensions: tiptapExtensions,
    content: initialContent ?? EMPTY_DOC,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "lesson-content min-h-48 rounded-md border border-input px-3 py-2 focus:outline-none",
      },
    },
  });

  if (!editor) return null;

  function openImageDialog() {
    setImageUrl("");
    setImageAlt("");
    setImageDialogOpen(true);
  }

  function insertImage() {
    if (!editor) return;
    const url = imageUrl.trim();
    if (!url) return;
    editor.chain().focus().setImage({ src: url, alt: imageAlt.trim() }).run();
    setImageDialogOpen(false);
  }

  function openVideoDialog() {
    setVideoUrl("");
    setVideoError(null);
    setVideoDialogOpen(true);
  }

  function insertVideo() {
    if (!editor) return;
    const url = videoUrl.trim();
    if (!url) return;
    if (!isAllowedEmbedUrl(url)) {
      setVideoError("Only YouTube, Vimeo, and Loom embed URLs are supported.");
      return;
    }
    editor.chain().focus().setEmbed({ src: url }).run();
    setVideoDialogOpen(false);
  }

  async function handleSave() {
    if (!editor) return;
    setSaving(true);
    try {
      await onSave(editor.getJSON());
      toast.success("Saved");
    } catch {
      toast.error("Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-1 rounded-md border border-input bg-muted/30 p-1">
        <Button
          type="button"
          variant={editor.isActive("bold") ? "secondary" : "ghost"}
          size="icon-sm"
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold />
        </Button>
        <Button
          type="button"
          variant={editor.isActive("italic") ? "secondary" : "ghost"}
          size="icon-sm"
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic />
        </Button>
        <Separator orientation="vertical" className="mx-1 h-5" />
        <Button
          type="button"
          variant={editor.isActive("heading", { level: 2 }) ? "secondary" : "ghost"}
          size="icon-sm"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <Heading2 />
        </Button>
        <Button
          type="button"
          variant={editor.isActive("heading", { level: 3 }) ? "secondary" : "ghost"}
          size="icon-sm"
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          <Heading3 />
        </Button>
        <Separator orientation="vertical" className="mx-1 h-5" />
        <Button
          type="button"
          variant={editor.isActive("bulletList") ? "secondary" : "ghost"}
          size="icon-sm"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List />
        </Button>
        <Button
          type="button"
          variant={editor.isActive("orderedList") ? "secondary" : "ghost"}
          size="icon-sm"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered />
        </Button>
        <Separator orientation="vertical" className="mx-1 h-5" />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() =>
            editor.chain().focus().insertTable({ rows: 2, cols: 2, withHeaderRow: true }).run()
          }
        >
          <TableIcon />
        </Button>
        <Separator orientation="vertical" className="mx-1 h-5" />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          title="Insert warning callout"
          onClick={() => editor.chain().focus().setCallout({ variant: "warning" }).run()}
        >
          <AlertTriangle />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          title="Insert note callout"
          onClick={() => editor.chain().focus().setCallout({ variant: "note" }).run()}
        >
          <Info />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          title="Insert tip callout"
          onClick={() => editor.chain().focus().setCallout({ variant: "tip" }).run()}
        >
          <Lightbulb />
        </Button>
        <Separator orientation="vertical" className="mx-1 h-5" />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          title="Insert image (by URL)"
          onClick={openImageDialog}
        >
          <ImageIcon />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          title="Embed video (YouTube, Vimeo, Loom)"
          onClick={openVideoDialog}
        >
          <Video />
        </Button>
        <Separator orientation="vertical" className="mx-1 h-5" />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => editor.chain().focus().undo().run()}
        >
          <Undo2 />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => editor.chain().focus().redo().run()}
        >
          <Redo2 />
        </Button>
      </div>

      {emptyHint && editor.isEmpty && (
        <p className="text-xs text-muted-foreground">{emptyHint}</p>
      )}

      <EditorContent editor={editor} />

      <div>
        <Button type="button" size="sm" onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>

      <Dialog open={imageDialogOpen} onOpenChange={setImageDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Insert image</DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="image-url">Image URL</Label>
              <Input
                id="image-url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="https://…"
                autoFocus
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="image-alt">Alt text (for accessibility)</Label>
              <Input
                id="image-alt"
                value={imageAlt}
                onChange={(e) => setImageAlt(e.target.value)}
                placeholder="Describe the image"
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose className={buttonVariants({ variant: "outline" })}>Cancel</DialogClose>
            <Button type="button" onClick={insertImage} disabled={!imageUrl.trim()}>
              Insert
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={videoDialogOpen} onOpenChange={setVideoDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Embed video</DialogTitle>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="video-url">Embed URL (YouTube, Vimeo, or Loom)</Label>
            <Input
              id="video-url"
              value={videoUrl}
              onChange={(e) => {
                setVideoUrl(e.target.value);
                setVideoError(null);
              }}
              placeholder="https://…"
              autoFocus
            />
            {videoError && <p className="text-sm text-destructive">{videoError}</p>}
          </div>
          <DialogFooter>
            <DialogClose className={buttonVariants({ variant: "outline" })}>Cancel</DialogClose>
            <Button type="button" onClick={insertVideo} disabled={!videoUrl.trim()}>
              Insert
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
