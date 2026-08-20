import StarterKit from "@tiptap/starter-kit";
import { TableKit } from "@tiptap/extension-table";
import Image from "@tiptap/extension-image";
import { Callout } from "@/lib/tiptap/callout-extension";
import { Embed } from "@/lib/tiptap/embed-extension";

export const tiptapExtensions = [
  StarterKit,
  TableKit.configure({ table: { resizable: false } }),
  Image,
  Callout,
  Embed,
];
