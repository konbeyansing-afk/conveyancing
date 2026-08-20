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
    return [
      "div",
      mergeAttributes(HTMLAttributes, { "data-embed": "" }),
      src && isAllowedEmbedUrl(src)
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
