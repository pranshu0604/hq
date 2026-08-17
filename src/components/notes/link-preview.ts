import { Node, mergeAttributes } from "@tiptap/core";

// an atomic "banner" card for a pasted link — renders its OG image + title + description.
// serialized as a <div> (NOT <a>) so the editor's Link mark can't claim it and strip the
// card down to plain text on reload. A full-cover overlay <a> keeps it clickable.
export const LinkPreview = Node.create({
  name: "linkPreview",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      url: { default: "" },
      title: { default: "" },
      description: { default: "" },
      image: { default: "" },
      siteName: { default: "" },
    };
  },

  parseHTML() {
    const getAttrs = (el: HTMLElement | string) => {
      const dom = el as HTMLElement;
      return {
        url: dom.getAttribute("data-url") || dom.getAttribute("href") || "",
        title: dom.getAttribute("data-title") || "",
        description: dom.getAttribute("data-description") || "",
        image: dom.getAttribute("data-image") || "",
        siteName: dom.getAttribute("data-site") || "",
      };
    };
    // high priority so it wins over the Link mark; second rule recovers legacy <a> cards
    return [
      { tag: "div[data-link-preview]", priority: 1100, getAttrs },
      { tag: "a[data-link-preview]", priority: 1100, getAttrs },
    ];
  },

  renderHTML({ node }) {
    const { url, title, description, image, siteName } = node.attrs as Record<string, string>;
    let host = siteName;
    try {
      if (!host) host = new URL(url).hostname.replace(/^www\./, "");
    } catch {}

    const body: unknown[] = [
      ["div", { class: "rte-embed-site" }, host || url],
      ["div", { class: "rte-embed-title" }, title || url],
    ];
    if (description) body.push(["div", { class: "rte-embed-desc" }, description]);

    const children: unknown[] = [];
    if (image) children.push(["div", { class: "rte-embed-img", style: `background-image:url("${image.replace(/"/g, "%22")}")` }]);
    children.push(["div", { class: "rte-embed-body" }, ...body]);
    // clickable overlay
    children.push(["a", { href: url, target: "_blank", rel: "noopener noreferrer", class: "rte-embed-link", "aria-label": title || url, contenteditable: "false" }]);

    return [
      "div",
      mergeAttributes({
        class: "rte-embed",
        "data-link-preview": "true",
        "data-url": url,
        "data-title": title,
        "data-description": description,
        "data-image": image,
        "data-site": siteName,
      }),
      ...children,
    ];
  },
});
