<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# ToolNest AI AGENTS.md (Ultimate v3 - Part 1)

## Project Mission

Build ToolNest AI into the highest-quality free online tools platform.

Primary goals (in order):

1. Excellent user experience
2. Production-ready code
3. Outstanding SEO
4. High performance
5. Accessibility
6. Maintainability
7. Reusable architecture

---

## General Rules

- Always reuse existing components.
- Never duplicate code.
- Never create duplicate tools.
- Before adding a tool, check whether it already exists.
- Improve existing implementations instead of replacing them.
- Keep TypeScript strict.
- Never leave TODOs or placeholder implementations.

---

## Architecture

Always reuse existing:

- Components
- Hooks
- Utilities
- Layouts
- API routes
- Search system
- Category system
- Tool registry

Never introduce a second implementation when one already exists.

---

## Tool Development Standard

Every tool should include:

- Hero section
- Tool interface
- Feature list
- FAQ
- Related tools
- Call to action
- SEO metadata

Whenever a new tool is added, automatically update:

- Tool Registry
- Search
- Search Suggestions
- Homepage
- Browse by Category
- Related Tools
- Navigation
- Sitemap
- Metadata
- Category counts

---

## SEO Standard

Every page must include:

- Unique title
- Meta description
- Canonical URL
- Open Graph
- Twitter Cards
- JSON-LD
- Breadcrumb Schema

When appropriate also include:

- FAQ Schema
- WebApplication Schema

---

## Code Quality

Before marking a task complete always run:

npm run lint

npm run type-check

npm run build

Fix every error before completion.

---

## Git Workflow

Always:

1. Commit changes.
2. Push to GitHub.
3. Verify push succeeded.
4. Verify a Vercel deployment started.

Never claim success if deployment failed.

---

## Long-Term Goal

Every implementation should make ToolNest AI more scalable, more maintainable and more useful than competing free tools websites.
# ============================================================================
# UI / UX DESIGN SYSTEM
# ============================================================================

## General Design Philosophy

Every page should look like it belongs to ToolNest AI.

Never create a page that looks visually different from the rest of the website.

Maintain a premium modern SaaS appearance.

The UI should feel similar to:

- Vercel
- Stripe
- Notion
- Linear
- Clerk

but preserve ToolNest AI branding.

---

## Layout Rules

Always reuse existing layouts.

Never create duplicate layouts.

Keep spacing consistent.

Maximum content width should follow the existing project.

All sections should have consistent vertical spacing.

---

## Cards

Prefer cards instead of plain containers.

Cards should use:

- rounded corners
- subtle shadows
- soft borders
- hover effects
- smooth transitions

Avoid heavy shadows.

---

## Buttons

Reuse existing button components.

Primary buttons should always be visually dominant.

Danger buttons only for destructive actions.

Avoid creating new button styles.

---

## Forms

Forms must:

- validate immediately
- show helpful messages
- prevent invalid submission
- support keyboard navigation

Inputs should include:

- placeholder
- label
- helper text (when useful)

---

## Icons

Use the existing icon library.

Do not mix icon libraries.

Icons should improve usability.

Never use icons only for decoration.

---

## Colors

Reuse the existing color palette.

Never hardcode random colors.

Support:

- Light mode
- Dark mode

Maintain sufficient contrast.

---

## Typography

Reuse existing typography scale.

Prefer:

- large headings
- readable paragraphs
- concise labels

Avoid large blocks of text.

---

## Responsive Design

Every page must support:

Desktop

Tablet

Mobile

No horizontal scrolling.

No overflowing content.

No broken layouts.

---

## Animations

Animations should be subtle.

Prefer:

- fade
- scale
- slide

Avoid distracting animations.

Respect reduced motion preferences.

---

## Loading States

Every async operation should include:

- loading spinner
- skeleton
- disabled buttons
- progress indicator when appropriate

Never leave the user wondering.

---

## Empty States

When no data exists:

Explain why.

Provide next action.

Never show empty blank screens.

---

## Error States

Always explain:

- what happened
- why
- how to fix it

Never display raw errors to users.

---

## Success States

Always confirm successful actions.

Examples:

- Tool completed.
- File exported.
- Content copied.
- Analysis finished.

---

## Copy Actions

Whenever output exists,

provide:

- Copy button

Whenever appropriate,

also provide:

- Download
- Export

---

## Tables

Tables should support:

- sorting
- searching
- responsive scrolling
- copy values

---

## Dashboard Components

Prefer reusable:

- Stat Cards
- Progress Bars
- Status Badges
- Charts
- Accordions
- Tabs
- Tooltips

---

## Accessibility

Every component must support:

- keyboard navigation
- ARIA labels
- semantic HTML
- visible focus

Never sacrifice accessibility for design.

---

## Component Reuse

Before creating any component,

check whether one already exists.

If an existing component can be extended,

extend it.

Never duplicate components.

---

## Final UI Rule

Every new page should feel like it was designed by the same design team that built the entire ToolNest AI platform.
# ============================================================================
# TOOL DEVELOPMENT STANDARD
# ============================================================================

## Philosophy

Every tool should feel premium.

Never build "just enough".

Every tool should be better than competing free tools.

Always think:

"If I searched Google, would I choose ToolNest AI instead?"

---

# Before Creating a Tool

Always check:

- Tool Registry
- Existing Categories
- Existing Routes
- Existing Components
- Existing Utilities

If a similar tool already exists,

improve it instead of creating another.

Never create duplicate tools.

---

# Tool Naming

Names should be:

- Short
- Clear
- SEO friendly

Good:

PDF to Word

Word Counter

Meta Tag Generator

Bad:

Amazing Meta Tool

Super Fast PDF Converter

---

# Slugs

Always use lowercase.

Use hyphens.

Example

/pdf-tools/pdf-to-word

Never use

underscores

spaces

uppercase

---

# Tool Structure

Every tool should contain

1 Hero

2 Description

3 Tool Interface

4 Features

5 FAQ

6 Related Tools

7 Call To Action

---

# Hero

Always include

Title

Description

Primary CTA

Secondary CTA (if useful)

---

# Description

Explain

What the tool does

Why users need it

Benefits

Avoid fluff.

---

# Tool Interface

The interface should always be the most important element.

Avoid unnecessary text above the tool.

---

# Features

Explain

Main capabilities

Benefits

Limitations

Supported formats

---

# FAQ

Generate useful FAQs.

Avoid generic answers.

Answer real user questions.

---

# Related Tools

Always suggest 4–8 relevant tools.

Reuse the Related Tools component.

Never hardcode duplicate cards.

---

# Validation

Validate everything before processing.

Examples

URLs

Emails

JSON

Images

PDFs

Numbers

Dates

Text

Files

Never trust user input.

---

# Errors

Always explain

What happened

How to fix it

Avoid technical jargon.

---

# Loading

Every async task should show

Loading

Progress

Status

Estimated completion (when possible)

---

# Results

Whenever a tool generates output,

always provide

Copy

Download

Reset

Clear

Share (when useful)

---

# Export Formats

Whenever possible support

TXT

CSV

JSON

PDF

PNG

HTML

---

# History

If appropriate,

allow users to view recent results.

Never store sensitive information permanently.

---

# Privacy

Process data securely.

Never log sensitive user input.

Never expose API keys.

---

# Performance

Avoid unnecessary API calls.

Cache when appropriate.

Optimize rendering.

Lazy load heavy components.

---

# Accessibility

Every tool must support

Keyboard

Screen readers

Focus states

ARIA labels

---

# Mobile

Every tool must work perfectly on mobile.

No horizontal scrolling.

Large tap targets.

Responsive layout.

---

# Analytics

When appropriate,

track

Tool usage

Errors

Performance

without collecting sensitive user data.

---

# SEO Requirements

Every tool must have

Unique Title

Meta Description

Canonical

Open Graph

Twitter Cards

JSON-LD

Breadcrumb

FAQ Schema

---

# Automatic Project Updates

Whenever a new tool is added,

automatically update

Tool Registry

Homepage

Browse by Category

Search

Search Suggestions

Related Tools

Navigation

Metadata

XML Sitemap

Category Counts

Structured Data

Footer (if required)

---

# Final Rule

Every new tool should feel like a premium SaaS product,

not a simple online utility.
# ============================================================================
# SEO & CONTENT STANDARDS
# ============================================================================

## Philosophy

Every page should be able to rank on Google.

Never build pages only for functionality.

Every page should be useful enough to deserve ranking.

---

# Metadata

Every page MUST include

- Unique Title
- Unique Meta Description
- Canonical URL
- Open Graph
- Twitter Cards

Never reuse metadata.

Never duplicate titles.

Never duplicate descriptions.

---

# Page Titles

Target:

45–60 characters.

Include the primary keyword.

Include ToolNest AI.

Example

Meta Tag Generator – Free Online SEO Tool | ToolNest AI

---

# Meta Description

Target:

140–160 characters.

Explain:

What

Why

Benefit

Call to action

---

# H1 Rules

Exactly one H1.

Use primary keyword.

Never duplicate H1.

---

# Heading Structure

H1

↓

H2

↓

H3

↓

H4

Never skip heading levels.

---

# URL Structure

Always

lowercase

hyphen-separated

SEO friendly

Examples

/pdf-tools/pdf-to-word

/seo-tools/meta-tag-generator

---

# Internal Linking

Every page should link to

4–8 relevant tools.

Whenever useful

link to

blogs

categories

guides

Never orphan pages.

---

# Related Tools

Related tools should be selected by

category

intent

workflow

Never random.

---

# FAQ

Every tool should contain

4–8 useful FAQs.

Answer real questions.

Avoid filler.

---

# Structured Data

Always include

WebApplication

Breadcrumb

When appropriate

FAQ

Article

SoftwareApplication

Organization

---

# Open Graph

Always generate

og:title

og:description

og:image

og:url

og:type

---

# Twitter Cards

Always include

summary_large_image

title

description

image

---

# Images

Every image should have

ALT text

Lazy loading

Responsive sizing

---

# Categories

Whenever adding a tool

update

Category page

Category counts

Browse by Category

Homepage

---

# Homepage

Whenever appropriate

show new tools

latest tools

featured tools

Never leave homepage outdated.

---

# Search

Whenever a tool is added

update

Search Index

Suggestions

Autocomplete

Aliases

---

# Sitemap

Automatically update XML Sitemap.

Never forget new pages.

---

# Robots

Ensure indexable pages are crawlable.

Avoid blocking useful pages.

---

# Canonical

Every indexable page must have a canonical URL.

---

# Duplicate Content

Avoid duplicate:

Titles

Descriptions

Headings

FAQs

Articles

Tool descriptions

---

# Blog Articles

Whenever writing blogs

Include

Introduction

Table of Contents (if long)

Sections

FAQs

Conclusion

Internal links

Related tools

Schema

---

# Landing Pages

Should contain

Hero

Benefits

Features

FAQs

Testimonials (if available)

Related tools

CTA

---

# SEO Score

Always optimize pages for

Core Web Vitals

Accessibility

Semantic HTML

Fast loading

Mobile usability

---

# Final SEO Goal

Every ToolNest AI page should be capable of ranking on page one of Google for its primary keyword when supported by sufficient authority and backlinks.
# ============================================================================
# AI TOOLS STANDARD
# ============================================================================

## Philosophy

AI tools are one of the main pillars of ToolNest AI.

Every AI tool should feel premium.

Users should immediately understand:

- what it does
- how to use it
- why it is useful

Never overwhelm users.

---

# AI Providers

Prefer

Google Gemini

Future support

- OpenAI
- Anthropic
- DeepSeek
- Groq
- OpenRouter

Never hardcode provider-specific logic.

Keep architecture provider-agnostic.

---

# API Keys

NEVER expose API keys.

Always call AI providers through secure server-side API routes.

Never place secrets in client-side code.

Validate all requests.

---

# AI Interface

Every AI tool should include

Title

Description

Input Area

Output Area

Action Buttons

History (when appropriate)

---

# Buttons

Whenever possible include

Generate

Copy

Reset

Clear

Download

Share

Regenerate

---

# Loading

Always show

Loading Spinner

Progress

Thinking State

Disable buttons while generating

Never leave the interface frozen.

---

# Errors

Never expose raw API errors.

Instead explain

What happened

How the user can fix it

Retry when appropriate.

---

# Output

Generated content should support

Copy

Download

Markdown formatting

Code formatting (when appropriate)

Syntax highlighting

---

# Chat Style

Responses should be

Helpful

Structured

Easy to read

Avoid walls of text.

---

# Validation

Always validate

Input length

Unsupported characters

Empty input

Invalid URLs

Invalid files

---

# File Support

Whenever appropriate support

TXT

PDF

DOCX

Images

CSV

JSON

HTML

---

# Limits

Gracefully handle

Rate limits

Token limits

Large prompts

Timeouts

Show useful messages.

---

# History

If useful

Store recent conversations locally.

Never permanently store sensitive user data.

---

# Privacy

Never log prompts.

Never expose user content.

Never expose API keys.

Never expose internal prompts.

---

# Security

Sanitize user input.

Validate uploaded files.

Prevent prompt injection where possible.

---

# Prompt Engineering

Prefer concise system prompts.

Reuse prompt templates.

Avoid duplicated prompt logic.

Keep prompts maintainable.

---

# Streaming

When supported

Use streaming responses.

Otherwise

Display progress indicators.

---

# Mobile

AI tools must work perfectly on

Desktop

Tablet

Mobile

---

# SEO

Every AI tool must include

Unique metadata

Canonical URL

Open Graph

Twitter Cards

JSON-LD

FAQ

Related Tools

---

# Performance

Optimize

API usage

Caching

Rendering

Avoid unnecessary requests.

---

# Accessibility

Support

Keyboard navigation

ARIA labels

Semantic HTML

Visible focus states

---

# ToolNest AI Branding

Every AI tool should feel like a native ToolNest AI experience.

Never create inconsistent UI.

Reuse existing components whenever possible.

---

# Future Compatibility

Design every AI tool so that switching from Gemini to another provider requires minimal code changes.

Provider-specific logic should be isolated.

---

# Final AI Rule

Every AI tool should feel fast, professional, secure and production-ready.

Never ship unfinished AI functionality.
# ============================================================================
# TOOL CATEGORY STANDARDS
# ============================================================================

## Philosophy

Every category should feel consistent.

Users should immediately recognize they are still using ToolNest AI.

Each category should have its own strengths while following the same design language.

---

# PDF TOOLS

PDF tools should prioritize

- Speed
- Privacy
- Accuracy

Whenever possible support

- Drag & Drop
- Click to Upload
- Multiple files
- Batch processing
- Progress indicator

Preferred export

- PDF
- DOCX
- XLSX
- PPTX
- JPG
- PNG
- TXT

Always include

- File size
- Page count
- Processing status
- Download button

Delete uploaded files after processing.

Never permanently store user documents.

---

# IMAGE TOOLS

Image tools should support

PNG

JPG

JPEG

WEBP

GIF

SVG (when applicable)

Whenever appropriate include

Image Preview

Before / After comparison

Zoom

Drag & Drop

Image compression statistics

Show

Original Size

New Size

Compression Ratio

Dimensions

Support responsive preview.

---

# SEO TOOLS

SEO tools should generate professional reports.

Whenever possible display

SEO Score

Warnings

Errors

Recommendations

Status Badges

Progress Bars

Charts

Prefer

Green

Yellow

Red

status indicators.

Always explain detected issues.

Never show raw technical output without explanation.

---

# AI TOOLS

Reuse the global AI standards.

Always include

Input

Output

Copy

Reset

Loading

Error handling

Responsive layout

Secure API communication

---

# DEVELOPER TOOLS

Support

Copy

Download

Syntax Highlighting

Line Numbers (when appropriate)

Validation

Formatting

Whenever possible include

Examples

Quick Actions

Auto Detect

Real-time Validation

---

# TEXT TOOLS

Support

Large input

Live character counting

Word counting

Reading time

Copy

Download

Clear

Reset

Preserve formatting whenever possible.

---

# CALCULATORS

Every calculator should

Validate input

Display formulas when useful

Show calculation steps when appropriate

Allow resetting

Support mobile keyboards

Never silently ignore invalid values.

---

# COLOR TOOLS

Whenever appropriate support

HEX

RGB

HSL

HSV

CMYK

Conversions should update instantly.

Display copy buttons for every format.

---

# FILE TOOLS

Support

Drag & Drop

Multiple Uploads

Batch Processing

Progress

Cancel

Retry

Always validate file types before processing.

---

# EXPORT RULES

Whenever meaningful provide

Copy

Download

PDF

CSV

JSON

TXT

PNG

Do not offer export formats that do not make sense for the tool.

---

# SHARING

Whenever useful provide

Copy Link

Share

Copy Results

Never require login for basic functionality.

---

# RESPONSIVENESS

Every category must work perfectly on

Desktop

Tablet

Mobile

No broken layouts.

No horizontal scrolling.

---

# FINAL CATEGORY RULE

Regardless of category, every ToolNest AI tool should feel fast, professional, secure, and consistent with the rest of the platform.
# ============================================================================
# AUTOMATION WORKFLOW
# ============================================================================

## Philosophy

Claude should think proactively.

Do not wait for the user to remind you about obvious project updates.

Whenever implementing a feature,

complete every required project update automatically.

---

# Before Starting Any Task

Always understand

- existing implementation
- existing architecture
- existing reusable components
- related utilities

Never start coding immediately.

Inspect the existing project first.

---

# Before Creating A Tool

Always verify

✓ Tool does not already exist

✓ Slug is unique

✓ Similar functionality does not already exist

If similar functionality exists,

extend it instead of duplicating it.

---

# During Development

Always

Reuse components

Reuse hooks

Reuse utilities

Reuse layouts

Avoid duplicated logic

Keep TypeScript strict

Keep code modular

---

# Automatic Project Updates

Whenever a new tool is created,

automatically update

✓ Tool Registry

✓ Homepage

✓ Browse by Category

✓ Search Index

✓ Search Suggestions

✓ Navigation

✓ Related Tools

✓ Category Counts

✓ XML Sitemap

✓ Metadata

✓ Structured Data

Never require the user to remind you.

---

# Before Completion

Always verify

✓ Tool works

✓ Responsive

✓ Dark Mode

✓ Mobile

✓ Accessibility

✓ SEO

✓ Metadata

✓ Related Tools

✓ Search

---

# Code Quality

Always check

No duplicated code

No unused imports

No unused variables

No unnecessary dependencies

No console logs

No commented code

No TODOs

---

# Build Verification

Always execute

npm run lint

npm run type-check

npm run build

If any command fails,

fix the issue before continuing.

Never ignore warnings that may affect production.

---

# Git Workflow

Before marking a task complete

Always

git add .

git commit

git push

Verify

Push completed successfully.

Never assume success.

---

# Deployment Verification

After push

Verify

A new Vercel deployment started.

If deployment failed

Explain

Why

What failed

How to fix it

Never falsely claim deployment succeeded.

---

# User Communication

Never say

"Done"

unless

Build passed

Push succeeded

Deployment started

Otherwise

Explain exactly what is incomplete.

---

# Bug Fixes

When fixing bugs

Fix root causes.

Do not create temporary workarounds unless requested.

---

# Refactoring

Whenever touching existing code

Improve

Readability

Maintainability

Performance

without breaking functionality.

---

# Documentation

Whenever architecture changes

Update documentation if needed.

---

# Long-Term Thinking

Always make decisions that improve

Scalability

Maintainability

Performance

Developer Experience

SEO

User Experience

---

# Final Rule

Think like the technical lead of ToolNest AI.

Never think only about the current task.

Always think about the entire platform.
# ============================================================================
# PERFORMANCE • SECURITY • API STANDARDS
# ============================================================================

## Performance Philosophy

Performance is a feature.

Never sacrifice speed unnecessarily.

Every page should load as fast as possible.

Always optimize before shipping.

---

# Rendering

Prefer

Server Components

Server Actions

Streaming

Dynamic Imports

Lazy Loading

Code Splitting

Avoid unnecessary Client Components.

---

# Bundle Size

Minimize JavaScript.

Do not import entire libraries when only one function is required.

Remove unused dependencies.

Avoid duplicate packages.

---

# Images

Always

Optimize images

Lazy load images

Use responsive images

Use modern formats whenever appropriate.

Avoid oversized assets.

---

# Fonts

Prefer existing fonts.

Avoid loading unnecessary font families.

Use font optimization.

---

# Data Fetching

Always

Cache when appropriate.

Avoid duplicate requests.

Avoid waterfall requests.

Batch requests whenever possible.

---

# API Calls

Never make unnecessary requests.

Debounce user input where appropriate.

Retry only when appropriate.

Handle failures gracefully.

---

# Error Handling

Never expose stack traces.

Never expose internal server errors.

Display friendly messages.

Log useful debugging information only on the server.

---

# Security Philosophy

Security comes first.

Never trade security for convenience.

Assume all user input is malicious until validated.

---

# Input Validation

Validate

Text

Files

URLs

Emails

Numbers

Dates

JSON

Images

PDFs

Before processing.

Never trust client-side validation alone.

---

# API Keys

Never expose

API Keys

Secrets

Tokens

Credentials

Private URLs

All sensitive values must remain server-side.

---

# File Uploads

Always validate

File Type

File Size

Extension

Content Type

Reject unsupported files.

Delete temporary uploads after processing.

---

# Authentication

If authentication is added in the future

Never trust client-side roles.

Always validate permissions server-side.

---

# Rate Limiting

Protect expensive endpoints.

Prevent abuse.

Return meaningful rate limit messages.

---

# Privacy

Never permanently store user uploads unless explicitly required.

Never log private user content.

Never share user data.

---

# Cookies

Use only when necessary.

Prefer secure defaults.

Never store sensitive information in cookies.

---

# External APIs

Whenever using external APIs

Handle

Timeouts

Retries

Rate limits

Invalid responses

Unexpected data

Gracefully.

---

# Logging

Log

Server errors

Unexpected failures

Critical events

Never log

Passwords

API Keys

Sensitive prompts

Private files

---

# Monitoring

Whenever possible monitor

Errors

Response times

API failures

Performance regressions

---

# Accessibility

Every feature must support

Keyboard navigation

Screen readers

ARIA labels

Visible focus

Semantic HTML

Proper color contrast

Never break accessibility.

---

# Browser Support

Support all modern browsers.

Avoid browser-specific code whenever possible.

Gracefully handle unsupported features.

---

# Mobile Performance

Optimize

Touch interactions

Scrolling

Input focus

Viewport changes

Avoid layout shifts.

---

# Final Performance Rule

Every new feature should make ToolNest AI

Faster

Safer

More reliable

More scalable

Never slower.
# ============================================================================
# CONTENT • BLOG • LANDING PAGE STANDARDS
# ============================================================================

## Philosophy

Content exists to help users first.

SEO is a consequence of creating genuinely useful content.

Never create content only for search engines.

Every article should solve a real problem.

---

# Blog Strategy

Every article should target

ONE primary keyword.

Support it with

multiple secondary keywords.

Never target too many topics in one article.

---

# Before Writing

Always check

Existing blog articles

Planned blog articles

Tool Registry

Never create duplicate articles.

If a similar article already exists,

improve it instead.

---

# Article Structure

Every article should contain

Hero

Introduction

Table of Contents (when long)

Main Sections

Examples

Tips

FAQs

Related Tools

Related Articles

Conclusion

Call To Action

---

# Writing Style

Write naturally.

Be concise.

Avoid fluff.

Avoid AI sounding phrases.

Explain difficult topics clearly.

Use examples.

---

# Internal Linking

Every article should link to

Relevant Tools

Relevant Categories

Relevant Blog Articles

Homepage (when appropriate)

Never leave isolated content.

---

# External Linking

Only link to trusted authoritative sources.

Avoid unnecessary external links.

---

# FAQ

Every article should contain

4–8 useful FAQs.

Questions should match real search intent.

---

# Landing Pages

Every landing page should include

Hero

Benefits

Features

Use Cases

FAQ

Related Tools

CTA

Structured Data

---

# Tool Promotion

Whenever an article discusses a feature that ToolNest AI offers,

recommend the relevant tool naturally.

Never force tool promotion.

---

# Content Updates

If an article becomes outdated,

update it instead of creating a duplicate.

---

# Images

Use meaningful images.

Every image requires

ALT text

Responsive sizing

Lazy loading

---

# SEO Rules

Every article requires

Unique Title

Meta Description

Canonical

Open Graph

Twitter Cards

Breadcrumb

Article Schema

FAQ Schema (when appropriate)

---

# Programmatic SEO

When possible,

reuse structured templates.

Generate pages consistently.

Never create thin content.

---

# Topical Authority

Group articles into topic clusters.

Connect related content.

Build authority around each category.

---

# Readability

Prefer

Short paragraphs

Bullet lists

Tables

Examples

Code blocks (when useful)

Avoid large walls of text.

---

# Calls To Action

Use subtle CTAs.

Never interrupt the reading experience.

Recommend relevant tools naturally.

---

# Duplicate Prevention

Never create

Duplicate articles

Duplicate slugs

Duplicate landing pages

Duplicate FAQs

Duplicate titles

---

# Future Growth

Always think

"What related article should exist next?"

Strengthen topic clusters over time.

---

# Final Content Rule

Every article and landing page should be good enough that a user would bookmark it, share it, and return to ToolNest AI again.
# ============================================================================
# FINAL QUALITY STANDARDS & DEFINITION OF DONE
# ============================================================================

## ToolNest AI Vision

ToolNest AI is not simply a collection of free online tools.

The goal is to become the world's best platform for:

- AI Tools
- PDF Tools
- SEO Tools
- Developer Tools
- Image Tools
- Text Tools
- File Tools
- Calculators
- Productivity Tools

Every decision should move the platform toward that vision.

---

# Definition of Done

A task is NOT complete until ALL of the following are true.

## Code

✓ Clean

✓ Readable

✓ Reusable

✓ Typed

✓ Production Ready

✓ No TODOs

✓ No Placeholder Code

---

## UI

✓ Responsive

✓ Desktop

✓ Tablet

✓ Mobile

✓ Dark Mode

✓ Accessible

✓ Consistent with ToolNest AI

---

## Functionality

✓ Feature works

✓ Edge cases handled

✓ Validation completed

✓ Errors handled

✓ Loading states

✓ Empty states

✓ Success states

---

## SEO

✓ Title

✓ Meta Description

✓ Canonical

✓ Open Graph

✓ Twitter Cards

✓ JSON-LD

✓ Breadcrumb

✓ FAQ Schema (when appropriate)

---

## Project Updates

Whenever a tool is added, verify that all required project areas are updated.

This includes:

- Tool Registry
- Homepage
- Browse by Category
- Categories
- Search
- Search Suggestions
- Navigation
- Related Tools
- XML Sitemap
- Metadata

---

## Testing

Always complete

npm run lint

npm run type-check

npm run build

Resolve every error before completion.

---

## Git Workflow

Always

git add .

git commit

git push

Verify push succeeded.

Never assume success.

---

## Deployment

Always verify

A new Vercel deployment has started.

If deployment failed

Explain

- Why

- What failed

- How to fix it

Never report success if deployment failed.

---

## Duplicate Prevention

Before creating anything

Always check

Existing Tools

Existing Categories

Existing Blogs

Existing Routes

Existing Components

Existing Utilities

Existing APIs

If something already exists

Improve it

Do not duplicate it.

---

## Blog Rules

Never create duplicate articles.

Always strengthen existing topic clusters.

Prefer updating existing content.

---

## Future Categories

Whenever suggesting new tools

Always check

Current Tool Registry

Current Categories

Roadmap

Avoid duplicate ideas.

---

## AI Directories

When the AI Tools section becomes mature

Remind the user to submit ToolNest AI to:

- Futurepedia
- There's An AI For That
- Toolify
- TopAI.tools
- AI Scout

Only recommend submission when the AI section is polished and contains a substantial number of tools.

---

## Decision Making

When multiple implementations are possible

Prefer the solution that offers:

- Better UX
- Better SEO
- Better Performance
- Better Accessibility
- Better Maintainability
- Better Scalability
- Better Code Quality

Never choose the quickest solution if a significantly better long-term solution exists.

---

## Communication

Be proactive.

Identify missing improvements.

Suggest better implementations.

Warn about technical debt.

Point out duplicate functionality.

Recommend reusable solutions.

Think like a senior technical lead, not a code generator.

---

# Final Principle

Every commit should improve ToolNest AI.

Every tool should be something you would proudly publish.

Every page should have the potential to rank.

Every feature should improve the user experience.

Build ToolNest AI as if millions of people will use it.
<!-- BEGIN: ToolNest AI Rules -->

# ToolNest AI Additional Rules

## Dependencies

- Do NOT introduce new npm packages unless I explicitly request them.
- Always prefer existing project dependencies.
- Prefer native browser APIs and plain TypeScript over external libraries.
- Before importing any package, verify it already exists in package.json.
- Never add a dependency just to implement formatting, parsing or validation if it can reasonably be implemented with native TypeScript.

## Build Safety

- Before committing, always run a production build.
- Never commit code that fails to build.
- Fix every build error before pushing.

## Tool Development

- Reuse existing UI components whenever possible.
- Follow existing ToolNest design patterns.
- Keep implementations lightweight.
- Avoid unnecessary complexity.
- Prioritize performance and bundle size.

## Code Quality

- Never duplicate existing utilities.
- Reuse helper functions when available.
- Prefer maintainable code over clever code.
- Avoid large dependencies for small features.

## If a package is required

If an external package is absolutely necessary:

1. Verify it is actively maintained.
2. Verify it supports production use.
3. Add it correctly to package.json.
4. Ensure the project builds successfully.
5. Never leave unresolved imports.

<!-- END: ToolNest AI Rules -->
## Communication

Do not explain completed work unless requested.

Respond in this format:

Completed:
- ...

If something failed:

Failed:
- ...

Only explain technical details if I ask.