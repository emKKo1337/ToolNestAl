#!/usr/bin/env node
/**
 * Regenerates TOOLS.md from lib/tools.ts.
 * Run: node scripts/generate-tools-md.js
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const SRC = path.join(ROOT, "lib", "tools.ts");
const OUT = path.join(ROOT, "TOOLS.md");

// ── Parse tools.ts ────────────────────────────────────────────────────────────

const src = fs.readFileSync(SRC, "utf8");
const blocks = src.split(/(?=\n  \{)/);

const tools = [];
for (const block of blocks) {
  const slug = block.match(/slug:\s*"([^"]+)"/)?.[1];
  const cat = block.match(/categorySlug:\s*"([^"]+)"/)?.[1];
  const name = block.match(/name:\s*"([^"]+)"/)?.[1];
  const short = block.match(/shortDescription:\s*"([^"]+)"/)?.[1];
  const coming = /comingSoon:\s*true/.test(block);
  if (slug && cat && name && short) tools.push({ slug, cat, name, short, coming });
}

// ── Category metadata ─────────────────────────────────────────────────────────

const CATEGORIES = [
  { slug: "ai-tools",        label: "AI Tools",        path: "/ai-tools" },
  { slug: "pdf-tools",       label: "PDF Tools",        path: "/pdf-tools" },
  { slug: "image-tools",     label: "Image Tools",      path: "/image-tools" },
  { slug: "developer-tools", label: "Developer Tools",  path: "/developer-tools" },
  { slug: "calculators",     label: "Calculators",      path: "/calculators" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

const status = (coming) => (coming ? "⏳ Coming Soon" : "✅ Production");

function categoryTable(catSlug, catPath) {
  const list = tools
    .filter((t) => t.cat === catSlug)
    .sort((a, b) => a.name.localeCompare(b.name));

  if (!list.length) return "";

  const rows = list
    .map(
      (t) =>
        `| ${t.name} | \`${t.slug}\` | [${catPath}/${t.slug}](${catPath}/${t.slug}) | ${status(t.coming)} | ${t.short} |`
    )
    .join("\n");

  return rows;
}

// ── Build markdown ────────────────────────────────────────────────────────────

const today = new Date().toISOString().split("T")[0];
const totalProduction = tools.filter((t) => !t.coming).length;
const totalComingSoon = tools.filter((t) => t.coming).length;

const sections = CATEGORIES.map(({ slug, label, path: catPath }) => {
  const count = tools.filter((t) => t.cat === slug).length;
  return `## ${label}

${count} tool${count !== 1 ? "s" : ""} · \`${catPath}\`

| Tool | Slug | URL | Status | Description |
|------|------|-----|--------|-------------|
${categoryTable(slug, catPath)}`;
}).join("\n\n---\n\n");

const summaryRows = CATEGORIES.map(({ slug, label }) => {
  const list = tools.filter((t) => t.cat === slug);
  const prod = list.filter((t) => !t.coming).length;
  const soon = list.filter((t) => t.coming).length;
  const detail = soon > 0 ? `${prod} production · ${soon} coming soon` : "All production";
  return `| ${label} | ${list.length} | ${detail} |`;
}).join("\n");

const md = `# ToolNest AI — Tool Inventory

Complete inventory of every tool on [toolnestai.net](https://www.toolnestai.net).
**${tools.length} tools · ${CATEGORIES.length} categories · Last updated: ${today}**

> **Maintainers:** Update this file whenever a tool is added, removed, or changes status.
> Run \`node scripts/generate-tools-md.js\` to regenerate automatically from \`lib/tools.ts\`.

---

${sections}

---

## Summary

| Category | Tools | Status |
|----------|-------|--------|
${summaryRows}
| **Total** | **${tools.length}** | **${totalProduction} production · ${totalComingSoon} coming soon** |

---

## How to Update This File

When a new tool is added to \`lib/tools.ts\`, regenerate this file by running:

\`\`\`bash
node scripts/generate-tools-md.js
\`\`\`

Or update the relevant table manually — keep rows sorted alphabetically within each category, update the count in the section header, and update the Summary table at the bottom.
`;

fs.writeFileSync(OUT, md, "utf8");
console.log(`✓ TOOLS.md updated — ${tools.length} tools (${totalProduction} production, ${totalComingSoon} coming soon)`);
