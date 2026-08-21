import { Node, mergeAttributes } from "@tiptap/core";

const ALLOWED_EMBED_HOSTS = [
  "www.youtube.com",
  "youtube.com",
  "player.vimeo.com",
  "www.loom.com",
];

export function isAllowedEmbedUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (parsed.protocol === "https:") && ALLOWED_EMBED_HOSTS.includes(parsed.hostname);
  } catch {
    return false;
  }
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    embed: {
      setEmbed: (attributes: { src: string }) => ReturnType;
    };
  }
}

export const Embed = Node.create({
  name: "embed",
  group: "block",
  atom: true,

  addAttributes() {
    return {
      src: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: "div[data-embed]" }];
  },

  renderHTML({ HTMLAttributes }) {
    const src = HTMLAttributes.src as string | undefined;
    const allowed = !!src && isAllowedEmbedUrl(src);
    // A rejected URL is dropped from the wrapper too, so it never appears in
    // the page's markup at all — not even on an inert attribute.
    const { src: _src, ...withoutSrc } = HTMLAttributes;
    return [
      "div",
      mergeAttributes(allowed ? HTMLAttributes : withoutSrc, { "data-embed": "" }),
      allowed
        ? [
            "iframe",
            {
              src,
              allow: "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture",
              allowfullscreen: "true",
              loading: "lazy",
            },
          ]
        : ["p", "Invalid embed URL"],
    ];
  },

  addCommands() {
    return {
      setEmbed:
        (attributes) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: attributes }),
    };
  },
});
