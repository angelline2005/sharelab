// Prefixes the site's base path onto root-relative links and images inside
// Markdown and MDX.
//
// Astro components call withBase() for this, but Markdown can't call anything —
// which is why every republished post used to carry a hardcoded
// "/sharelab/some-logo.png". That spread the base path across every post and
// every importer, so changing it (moving to a custom domain, say) meant hunting
// through content instead of editing one line of config.
//
// With this plugin, content writes "/scidev-net-logo.png" and the base is
// applied at build time from a single source of truth in astro.config.mjs.
//
// Left alone: absolute URLs, protocol-relative "//host" URLs, anchors, mailto:
// and anything already carrying the prefix.

const SKIP = /^(?:[a-z][a-z0-9+.-]*:|\/\/|#|\?)/i;

function walk(node, visit) {
  visit(node);
  const children = node.children;
  if (Array.isArray(children)) for (const child of children) walk(child, visit);
}

export function rehypeBasePaths({ base }) {
  const prefix = base.replace(/\/+$/, '');

  // No prefix to add when the site is served from the domain root.
  if (prefix === '') return () => () => {};

  const rewrite = (value) => {
    if (typeof value !== 'string' || !value.startsWith('/')) return value;
    if (SKIP.test(value)) return value;
    if (value === prefix || value.startsWith(`${prefix}/`)) return value;
    return `${prefix}${value}`;
  };

  // Raw HTML blocks in Markdown — the attribution block every republished post
  // opens with — arrive as a single string node rather than parsed elements, so
  // they need rewriting textually.
  const rewriteRaw = (html) =>
    html.replace(/\b(src|href)=("|')(\/[^"']*)\2/gi, (match, attr, quote, value) => {
      const next = rewrite(value);
      return next === value ? match : `${attr}=${quote}${next}${quote}`;
    });

  return () => (tree) => {
    walk(tree, (node) => {
      if ((node.type === 'raw' || node.type === 'html') && typeof node.value === 'string') {
        node.value = rewriteRaw(node.value);
        return;
      }
      const props = node.properties;
      if (!props) return;
      if (props.src) props.src = rewrite(props.src);
      if (props.href) props.href = rewrite(props.href);
    });
  };
}
