# Content backlog — thin tool pages (Phase 2)

**Context:** Google AdSense rejected the site for "Low value content." Phase 1
expanded the 20 highest-intent tool pages to 700–1000 words of unique,
technically specific content each (see `lib/tools.ts`, the `longContent`
field). The 88 tools below still carry only their original ~120–360 word
description + FAQ block and have been marked `noindex, follow` (see
`lib/metadata.ts` / individual `page.tsx` files) so they don't count against
the site's average content quality while still being fully functional and
linked in navigation for users.

**How to re-index a tool:** add a `longContent` array (5–6 sections drawn
from: mechanism, decision guidance, worked example with real numbers, code
snippet, limitations/mistakes) and `relatedPostSlugs` to its entry in
`lib/tools.ts`, following the pattern of any of the 20 already-expanded
tools. Once `longContent` is present, `generateToolMetadata()` in
`lib/metadata.ts` automatically drops the `noindex` directive and
`app/sitemap.ts` automatically includes the page — no other code changes
needed. Expand FAQs from 4–5 to 6–8 real questions at the same time.

Tools are grouped by category below. Suggested order reflects rough
independent judgment of search intent/volume, not measured data — re-prioritize
freely.

---

## PDF Tools (18 remaining)

High suggested priority (common standalone searches):
- [ ] `pdf-tools/pdf-to-word` — PDF to Word
- [ ] `pdf-tools/word-to-pdf` — Word to PDF
- [ ] `pdf-tools/rotate-pdf` — Rotate PDF
- [ ] `pdf-tools/sign-pdf` — Sign PDF
- [ ] `pdf-tools/protect-pdf` — Protect PDF
- [ ] `pdf-tools/unlock-pdf` — Unlock PDF

Medium:
- [ ] `pdf-tools/watermark-pdf` — Watermark PDF
- [ ] `pdf-tools/add-page-numbers` — Add Page Numbers to PDF
- [ ] `pdf-tools/delete-pdf-pages` — Delete PDF Pages
- [ ] `pdf-tools/organize-pdf` — Organize PDF
- [ ] `pdf-tools/reorder-pdf-pages` — Reorder PDF Pages
- [ ] `pdf-tools/pdf-metadata-editor` — PDF Metadata Editor
- [ ] `pdf-tools/ocr-pdf` — OCR PDF
- [ ] `pdf-tools/image-to-pdf` — Image to PDF

Lower (office-conversion long tail):
- [ ] `pdf-tools/pdf-to-excel` — PDF to Excel
- [ ] `pdf-tools/excel-to-pdf` — Excel to PDF
- [ ] `pdf-tools/pdf-to-powerpoint` — PDF to PowerPoint
- [ ] `pdf-tools/powerpoint-to-pdf` — PowerPoint to PDF

## Image Tools (15 remaining)

High:
- [ ] `image-tools/jpg-to-png` — JPG to PNG
- [ ] `image-tools/png-to-jpg` — PNG to JPG
- [ ] `image-tools/image-cropper` — Image Cropper
- [ ] `image-tools/image-rotator` — Image Rotator

Medium:
- [ ] `image-tools/image-color-picker` — Image Color Picker
- [ ] `image-tools/brightness-contrast` — Brightness & Contrast
- [ ] `image-tools/image-filters` — Image Filters
- [ ] `image-tools/image-sharpen` — Image Sharpen
- [ ] `image-tools/image-blur` — Image Blur
- [ ] `image-tools/grayscale-converter` — Grayscale Converter
- [ ] `image-tools/image-watermark` — Image Watermark

Lower (developer/niche):
- [ ] `image-tools/image-metadata-viewer` — Image Metadata Viewer
- [ ] `image-tools/remove-image-metadata` — Remove Image Metadata
- [ ] `image-tools/image-to-base64` — Image to Base64
- [ ] `image-tools/base64-to-image` — Base64 to Image

## SEO Tools (23 remaining — entire category still thin)

High (most commonly searched SEO utilities):
- [ ] `seo-tools/meta-tag-generator` — Meta Tag Generator
- [ ] `seo-tools/robots-txt-generator` — Robots.txt Generator
- [ ] `seo-tools/sitemap-generator` — XML Sitemap Generator
- [ ] `seo-tools/serp-preview` — SERP Preview Tool
- [ ] `seo-tools/open-graph-generator` — Open Graph Generator
- [ ] `seo-tools/schema-validator` — Schema Validator
- [ ] `seo-tools/keyword-density-checker` — Keyword Density Checker

Medium:
- [ ] `seo-tools/broken-link-checker` — Broken Link Checker
- [ ] `seo-tools/redirect-checker` — Redirect Checker
- [ ] `seo-tools/meta-tags-analyzer` — Meta Tags Analyzer
- [ ] `seo-tools/meta-tags-extractor` — Meta Tags Extractor
- [ ] `seo-tools/twitter-card-generator` — Twitter Card Generator
- [ ] `seo-tools/json-ld-schema-generator` — JSON-LD Schema Generator
- [ ] `seo-tools/canonical-url-generator` — Canonical URL Generator
- [ ] `seo-tools/heading-checker` — Heading Checker

Lower (more technical/niche):
- [ ] `seo-tools/sitemap-validator` — Sitemap Validator
- [ ] `seo-tools/robots-txt-tester` — Robots.txt Tester
- [ ] `seo-tools/hreflang-generator` — Hreflang Generator
- [ ] `seo-tools/http-header-checker` — HTTP Header Checker
- [ ] `seo-tools/internal-link-analyzer` — Internal Link Analyzer
- [ ] `seo-tools/external-link-checker` — External Link Checker
- [ ] `seo-tools/og-image-preview` — OG Image Preview
- [ ] `seo-tools/schema-extractor` — Schema Extractor

## AI Tools (14 remaining)

High:
- [ ] `ai-tools/ai-chat` — AI Chat
- [ ] `ai-tools/ai-grammar-checker` — AI Grammar Checker
- [ ] `ai-tools/ai-text-summarizer` — AI Text Summarizer
- [ ] `ai-tools/ai-translator` — AI Translator

Medium:
- [ ] `ai-tools/ai-paraphraser` — AI Paraphraser
- [ ] `ai-tools/ai-humanizer` — AI Humanizer
- [ ] `ai-tools/ai-email-writer` — AI Email Writer
- [ ] `ai-tools/ai-resume-builder` — AI Resume Builder
- [ ] `ai-tools/ai-cover-letter-generator` — AI Cover Letter Generator

Lower (generator/novelty tools):
- [ ] `ai-tools/ai-prompt-generator` — AI Prompt Generator
- [ ] `ai-tools/ai-business-name-generator` — AI Business Name Generator
- [ ] `ai-tools/ai-slogan-generator` — AI Slogan Generator
- [ ] `ai-tools/ai-username-generator` — AI Username Generator
- [ ] `ai-tools/ai-product-description-generator` — AI Product Description Generator

## Developer Tools (7 remaining)

- [ ] `developer-tools/url-encoder` — URL Encoder / Decoder
- [ ] `developer-tools/xml-formatter` — XML Formatter
- [ ] `developer-tools/xml-validator` — XML Validator
- [ ] `developer-tools/sql-formatter` — SQL Formatter
- [ ] `developer-tools/json-yaml-converter` — JSON ↔ YAML Converter
- [ ] `developer-tools/css-minifier` — CSS Minifier
- [ ] `developer-tools/html-minifier` — HTML Minifier

## Text Tools (9 remaining)

- [ ] `text-tools/text-statistics` — Text Statistics
- [ ] `text-tools/slug-generator` — Slug Generator
- [ ] `text-tools/find-and-replace` — Find & Replace
- [ ] `text-tools/remove-duplicate-lines` — Remove Duplicate Lines
- [ ] `text-tools/remove-empty-lines` — Remove Empty Lines
- [ ] `text-tools/remove-extra-spaces` — Remove Extra Spaces
- [ ] `text-tools/text-reverser` — Text Reverser
- [ ] `text-tools/text-sorter` — Text Sorter
- [ ] `text-tools/lorem-ipsum-generator` — Lorem Ipsum Generator

## Calculators (2 remaining)

- [ ] `calculators/bmi-calculator` — BMI Calculator
- [ ] `calculators/age-calculator` — Age Calculator

---

**Total: 88 tools noindexed, tracked here for future expansion.**
**Already expanded and indexable (20):** merge-pdf, split-pdf, compress-pdf,
pdf-to-images, image-converter, remove-background, image-resizer,
image-compressor, webp-converter, json-formatter, base64-encoder,
jwt-decoder, regex-tester, hash-generator, uuid-generator,
qr-code-generator, password-generator, word-counter, case-converter,
timestamp-converter.
