"use client";

/**
 * JSON-LD Schema Generator — flagship SEO tool
 *
 * Supports 19 Schema.org types. Dynamic forms show only fields relevant to
 * the selected type. Array editors handle sameAs URLs, FAQ items, breadcrumbs,
 * recipe ingredients and instructions. A rich-results readiness score (0–100)
 * validates required fields and URL formats.
 *
 * Output: JSON-LD (raw JSON) or HTML (wrapped in <script type="application/ld+json">).
 * JSON syntax highlighting uses a single-pass regex tokeniser.
 */

import { useState, useMemo, useCallback } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────
type SchemaType =
  | "Organization" | "LocalBusiness" | "Person"
  | "WebSite" | "WebPage" | "BreadcrumbList"
  | "Article" | "BlogPosting" | "VideoObject" | "Course" | "Book"
  | "FAQPage" | "Event" | "Recipe"
  | "Product" | "Service" | "Review"
  | "JobPosting" | "SoftwareApplication";

type FType = "text" | "url" | "email" | "tel" | "date" | "datetime-local" | "number" | "textarea" | "select";
type OutputTab = "json" | "html";

interface FC { key: string; label: string; type: FType; required?: boolean; placeholder?: string; hint?: string; options?: string[]; }
interface SchemaDef { type: SchemaType; label: string; icon: string; color: string; category: string; description: string; fields: FC[]; hasSameAs?: boolean; hasFaq?: boolean; hasBc?: boolean; hasIngr?: boolean; hasInstr?: boolean; }
interface AppState { type: SchemaType; d: Record<string, string>; sameAs: string[]; faqItems: { id: string; q: string; a: string }[]; bcItems: { id: string; name: string; url: string }[]; ingredients: string[]; instructions: string[]; }
interface Issue { level: "error" | "warning" | "info"; text: string; }
type JsonObj = Record<string, unknown>;

// ── Field helper ──────────────────────────────────────────────────────────────
const f = (key: string, label: string, type: FType, opts?: { req?: boolean; ph?: string; hint?: string; opts?: string[] }): FC => ({
  key, label, type, required: opts?.req, placeholder: opts?.ph, hint: opts?.hint, options: opts?.opts,
});

// ── Schema definitions ────────────────────────────────────────────────────────
const SCHEMA_DEFS: SchemaDef[] = [
  { type: "Organization", label: "Organization", icon: "business", color: "#60a5fa", category: "Business",
    description: "Identify your brand to search engines", hasSameAs: true,
    fields: [ f("name","Name","text",{req:true}), f("url","URL","url"), f("logo","Logo URL","url"), f("description","Description","textarea"), f("telephone","Telephone","tel"), f("email","Email","email"), f("contactType","Contact Type","text",{ph:"customer service"}), f("foundingDate","Founding Date","date") ] },

  { type: "LocalBusiness", label: "Local Business", icon: "store", color: "#f59e0b", category: "Business",
    description: "Physical business with address and hours",
    fields: [ f("name","Business Name","text",{req:true}), f("url","Website URL","url"), f("image","Image URL","url"), f("description","Description","textarea"), f("telephone","Telephone","tel",{req:true}), f("email","Email","email"), f("priceRange","Price Range","text",{ph:"$$"}), f("streetAddr","Street Address","text",{ph:"123 Main St"}), f("city","City","text",{ph:"New York"}), f("state","State","text",{ph:"NY"}), f("postalCode","Postal Code","text",{ph:"10001"}), f("country","Country","text",{ph:"US"}), f("openingHours","Opening Hours","text",{ph:"Mo-Fr 09:00-17:00",hint:"Space-separated e.g. Mo-Fr 09:00-17:00"}), f("ratingValue","Rating","number",{ph:"4.5"}), f("reviewCount","Review Count","number",{ph:"128"}) ] },

  { type: "Person", label: "Person", icon: "person", color: "#a78bfa", category: "Business",
    description: "Individual — author, founder, public figure", hasSameAs: true,
    fields: [ f("name","Full Name","text",{req:true}), f("url","Profile URL","url"), f("image","Photo URL","url"), f("description","Bio","textarea"), f("email","Email","email"), f("telephone","Telephone","tel"), f("jobTitle","Job Title","text",{ph:"Software Engineer"}), f("birthDate","Birth Date","date"), f("nationality","Nationality","text",{ph:"American"}) ] },

  { type: "WebSite", label: "Website", icon: "language", color: "#34d399", category: "Web",
    description: "Site-wide schema with sitelinks searchbox",
    fields: [ f("name","Site Name","text",{req:true}), f("url","Site URL","url",{req:true}), f("description","Description","textarea"), f("searchUrl","Search URL Template","url",{ph:"https://example.com/search?q={search_term_string}",hint:"Use {search_term_string} as the query placeholder"}) ] },

  { type: "WebPage", label: "Web Page", icon: "web", color: "#22d3ee", category: "Web",
    description: "Individual page with metadata",
    fields: [ f("name","Page Title","text",{req:true}), f("url","Page URL","url",{req:true}), f("description","Description","textarea"), f("image","Featured Image","url"), f("datePublished","Published Date","date"), f("dateModified","Modified Date","date"), f("authorName","Author","text",{ph:"John Doe"}) ] },

  { type: "BreadcrumbList", label: "Breadcrumb", icon: "chevron_right", color: "#fb923c", category: "Web",
    description: "Navigation breadcrumb trail", hasBc: true, fields: [] },

  { type: "Article", label: "Article", icon: "article", color: "#f472b6", category: "Content",
    description: "News article or editorial content",
    fields: [ f("headline","Headline","text",{req:true,ph:"Article title (max 110 chars)"}), f("url","Article URL","url"), f("image","Featured Image","url",{req:true}), f("datePublished","Published Date","date",{req:true}), f("dateModified","Modified Date","date"), f("description","Description","textarea"), f("authorName","Author Name","text",{ph:"John Doe"}), f("authorUrl","Author URL","url"), f("pubName","Publisher Name","text",{ph:"Publisher Inc."}), f("pubLogo","Publisher Logo URL","url") ] },

  { type: "BlogPosting", label: "Blog Post", icon: "edit_note", color: "#e879f9", category: "Content",
    description: "Blog post eligible for rich results",
    fields: [ f("headline","Headline","text",{req:true}), f("url","Post URL","url"), f("image","Featured Image","url",{req:true}), f("datePublished","Published Date","date",{req:true}), f("dateModified","Modified Date","date"), f("description","Description","textarea"), f("authorName","Author Name","text",{ph:"John Doe"}), f("authorUrl","Author URL","url"), f("pubName","Publisher Name","text"), f("pubLogo","Publisher Logo URL","url") ] },

  { type: "VideoObject", label: "Video", icon: "videocam", color: "#fb7185", category: "Content",
    description: "Video with thumbnail, duration and embed URL",
    fields: [ f("name","Video Title","text",{req:true}), f("description","Description","textarea",{req:true}), f("uploadDate","Upload Date","date",{req:true}), f("image","Thumbnail URL","url",{req:true,ph:"https://example.com/thumb.jpg"}), f("duration","Duration","text",{ph:"PT5M30S",hint:"ISO 8601 e.g. PT5M30S"}), f("embedUrl","Embed URL","url",{ph:"https://youtube.com/embed/..."}), f("contentUrl","Content URL","url",{ph:"https://example.com/video.mp4"}) ] },

  { type: "Course", label: "Course", icon: "school", color: "#a78bfa", category: "Content",
    description: "Online or in-person educational course",
    fields: [ f("name","Course Name","text",{req:true}), f("description","Description","textarea",{req:true}), f("url","Course URL","url"), f("image","Course Image","url"), f("provider","Provider","text",{ph:"University of Example"}), f("courseCode","Course Code","text",{ph:"CS101"}), f("ratingValue","Rating","number",{ph:"4.5"}), f("reviewCount","Review Count","number",{ph:"50"}) ] },

  { type: "Book", label: "Book", icon: "menu_book", color: "#4ade80", category: "Content",
    description: "Physical or digital book with metadata",
    fields: [ f("name","Book Title","text",{req:true}), f("authorName","Author","text",{ph:"Author Name"}), f("publisher","Publisher","text",{ph:"Publisher Inc."}), f("isbn","ISBN","text",{ph:"978-0-306-40615-7"}), f("numPages","Pages","number",{ph:"320"}), f("bookFormat","Format","select",{opts:["Hardcover","Paperback","EBook","AudioBook"]}), f("datePublished","Publish Date","date"), f("description","Description","textarea"), f("url","Book URL","url"), f("image","Cover Image","url"), f("price","Price","text",{ph:"29.99"}), f("currency","Currency","text",{ph:"USD"}) ] },

  { type: "FAQPage", label: "FAQ", icon: "quiz", color: "#facc15", category: "Interactive",
    description: "Expandable FAQ eligible for rich snippets", hasFaq: true, fields: [] },

  { type: "Event", label: "Event", icon: "event", color: "#f97316", category: "Interactive",
    description: "Concert, conference, webinar or any event",
    fields: [ f("name","Event Name","text",{req:true}), f("description","Description","textarea"), f("url","Event URL","url"), f("image","Event Image","url"), f("startDate","Start Date","datetime-local",{req:true}), f("endDate","End Date","datetime-local"), f("locationName","Location Name","text",{ph:"Convention Center"}), f("locationUrl","Location URL","url"), f("organizer","Organizer","text",{ph:"Events Inc."}), f("eventStatus","Event Status","select",{opts:["EventScheduled","EventCancelled","EventMoved","EventPostponed"]}), f("eventMode","Attendance Mode","select",{opts:["OfflineEventAttendanceMode","OnlineEventAttendanceMode","MixedEventAttendanceMode"]}) ] },

  { type: "Recipe", label: "Recipe", icon: "restaurant", color: "#fb923c", category: "Food",
    description: "Recipe with rich snippet eligibility", hasIngr: true, hasInstr: true,
    fields: [ f("name","Recipe Name","text",{req:true}), f("description","Description","textarea"), f("image","Recipe Image","url",{req:true}), f("authorName","Author","text",{ph:"Chef Name"}), f("datePublished","Publish Date","date"), f("prepTime","Prep Time","text",{ph:"PT15M",hint:"ISO 8601 e.g. PT15M"}), f("cookTime","Cook Time","text",{ph:"PT30M"}), f("totalTime","Total Time","text",{ph:"PT45M"}), f("recipeYield","Yield","text",{ph:"4 servings"}), f("recipeCuisine","Cuisine","text",{ph:"Italian"}), f("recipeCategory","Category","text",{ph:"Dessert"}), f("ratingValue","Rating","number",{ph:"4.8"}), f("reviewCount","Review Count","number",{ph:"42"}) ] },

  { type: "Product", label: "Product", icon: "shopping_bag", color: "#2dd4bf", category: "Commerce",
    description: "Product with price, availability and reviews",
    fields: [ f("name","Product Name","text",{req:true}), f("description","Description","textarea"), f("image","Product Image","url"), f("url","Product URL","url"), f("brand","Brand","text",{ph:"Brand name"}), f("sku","SKU","text",{ph:"ABC-123"}), f("price","Price","text",{req:true,ph:"29.99"}), f("currency","Currency","text",{ph:"USD"}), f("availability","Availability","select",{opts:["InStock","OutOfStock","PreOrder","SoldOut","Discontinued","LimitedAvailability"]}), f("ratingValue","Rating","number",{ph:"4.5"}), f("reviewCount","Review Count","number",{ph:"128"}) ] },

  { type: "Service", label: "Service", icon: "build", color: "#94a3b8", category: "Commerce",
    description: "Service offering with provider and area",
    fields: [ f("name","Service Name","text",{req:true}), f("description","Description","textarea"), f("url","Service URL","url"), f("image","Service Image","url"), f("provider","Provider","text",{ph:"Company name"}), f("serviceType","Service Type","text",{ph:"Consulting"}), f("areaServed","Area Served","text",{ph:"United States"}), f("price","Price","text",{ph:"99.00"}), f("currency","Currency","text",{ph:"USD"}) ] },

  { type: "Review", label: "Review", icon: "rate_review", color: "#f59e0b", category: "Commerce",
    description: "Review of a product, service or entity",
    fields: [ f("itemReviewed","Item Reviewed","text",{req:true,ph:"Product or service name"}), f("itemRevUrl","Item URL","url"), f("reviewBody","Review Text","textarea",{req:true}), f("authorName","Author","text",{ph:"Reviewer name"}), f("datePublished","Review Date","date"), f("ratingValue","Rating","number",{req:true,ph:"4.5"}), f("bestRating","Best Rating","number",{ph:"5"}), f("worstRating","Worst Rating","number",{ph:"1"}) ] },

  { type: "JobPosting", label: "Job Posting", icon: "work", color: "#818cf8", category: "Jobs",
    description: "Job listing eligible for Google Jobs",
    fields: [ f("jobTitle","Job Title","text",{req:true,ph:"Software Engineer"}), f("description","Job Description","textarea",{req:true}), f("datePosted","Date Posted","date",{req:true}), f("hiringOrg","Hiring Organization","text",{req:true,ph:"Company Inc."}), f("url","Job URL","url"), f("jobLocation","Location","text",{ph:"New York, NY"}), f("jobLocType","Location Type","select",{opts:["","TELECOMMUTE"]}), f("salary","Base Salary","text",{ph:"80000"}), f("currency","Currency","text",{ph:"USD"}), f("salaryUnit","Salary Period","select",{opts:["YEAR","MONTH","WEEK","DAY","HOUR"]}), f("empType","Employment Type","select",{opts:["FULL_TIME","PART_TIME","CONTRACTOR","TEMPORARY","INTERN","VOLUNTEER","PER_DIEM","OTHER"]}), f("validThrough","Valid Through","date") ] },

  { type: "SoftwareApplication", label: "Software App", icon: "apps", color: "#67e8f9", category: "Jobs",
    description: "Web, mobile or desktop app with ratings",
    fields: [ f("name","App Name","text",{req:true}), f("description","Description","textarea"), f("url","App URL","url"), f("image","Screenshot URL","url"), f("appCategory","Category","text",{ph:"GameApplication"}), f("operatingSystem","Operating System","text",{ph:"Windows 10, iOS 15"}), f("softwareVersion","Version","text",{ph:"1.0.0"}), f("downloadUrl","Download URL","url"), f("price","Price","text",{ph:"0"}), f("currency","Currency","text",{ph:"USD"}), f("ratingValue","Rating","number",{ph:"4.2"}), f("reviewCount","Review Count","number",{ph:"50"}) ] },
];

// ── Utilities ─────────────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2, 9);
const isValidUrl = (s: string) => { try { new URL(s); return true; } catch { return false; } };
const addIf = (o: JsonObj, key: string, val: string | number | unknown) => { if (val !== undefined && val !== null && val !== "") o[key] = val; };
const makeAuthor = (name: string, url?: string): JsonObj | undefined => name ? { "@type": "Person", name, ...(url ? { url } : {}) } : undefined;
const makePublisher = (name: string, logo?: string): JsonObj | undefined => name ? { "@type": "Organization", name, ...(logo ? { logo: { "@type": "ImageObject", url: logo } } : {}) } : undefined;
const makeOffer = (price: string, currency: string, avail?: string): JsonObj | undefined => price ? { "@type": "Offer", price, ...(currency ? { priceCurrency: currency } : {}), ...(avail ? { availability: `https://schema.org/${avail}` } : {}) } : undefined;
const makeRating = (val: string, count?: string, best?: string, worst?: string): JsonObj | undefined => val ? { "@type": "AggregateRating", ratingValue: parseFloat(val), ...(count ? { reviewCount: parseInt(count) } : {}), ...(best ? { bestRating: parseFloat(best) } : {}), ...(worst ? { worstRating: parseFloat(worst) } : {}) } : undefined;

// ── JSON-LD builder ───────────────────────────────────────────────────────────
function buildSchemaObj(s: AppState): JsonObj {
  const { d, sameAs, faqItems, bcItems, ingredients, instructions } = s;
  const o: JsonObj = { "@context": "https://schema.org", "@type": s.type };

  switch (s.type) {
    case "Organization": {
      addIf(o, "name", d.name); addIf(o, "url", d.url); addIf(o, "logo", d.logo);
      addIf(o, "description", d.description); addIf(o, "foundingDate", d.foundingDate);
      const sa = sameAs.filter(Boolean); if (sa.length) o.sameAs = sa;
      if (d.telephone || d.email) {
        const cp: JsonObj = { "@type": "ContactPoint" };
        addIf(cp, "telephone", d.telephone); addIf(cp, "email", d.email); addIf(cp, "contactType", d.contactType);
        o.contactPoint = cp;
      }
      break;
    }
    case "LocalBusiness": {
      addIf(o, "name", d.name); addIf(o, "url", d.url); addIf(o, "image", d.image);
      addIf(o, "description", d.description); addIf(o, "telephone", d.telephone);
      addIf(o, "email", d.email); addIf(o, "priceRange", d.priceRange);
      if (d.streetAddr || d.city || d.country) {
        const a: JsonObj = { "@type": "PostalAddress" };
        addIf(a, "streetAddress", d.streetAddr); addIf(a, "addressLocality", d.city);
        addIf(a, "addressRegion", d.state); addIf(a, "postalCode", d.postalCode);
        addIf(a, "addressCountry", d.country);
        o.address = a;
      }
      const oh = (d.openingHours || "").split(/[\n,]/).map(x => x.trim()).filter(Boolean);
      if (oh.length) o.openingHours = oh.length === 1 ? oh[0] : oh;
      const r = makeRating(d.ratingValue, d.reviewCount); if (r) o.aggregateRating = r;
      break;
    }
    case "Person": {
      addIf(o, "name", d.name); addIf(o, "url", d.url); addIf(o, "image", d.image);
      addIf(o, "description", d.description); addIf(o, "email", d.email);
      addIf(o, "telephone", d.telephone); addIf(o, "jobTitle", d.jobTitle);
      addIf(o, "birthDate", d.birthDate); addIf(o, "nationality", d.nationality);
      const sa = sameAs.filter(Boolean); if (sa.length) o.sameAs = sa;
      break;
    }
    case "WebSite": {
      addIf(o, "name", d.name); addIf(o, "url", d.url); addIf(o, "description", d.description);
      if (d.searchUrl) {
        o.potentialAction = { "@type": "SearchAction", target: { "@type": "EntryPoint", urlTemplate: d.searchUrl }, "query-input": "required name=search_term_string" };
      }
      break;
    }
    case "WebPage": {
      addIf(o, "name", d.name); addIf(o, "url", d.url); addIf(o, "description", d.description);
      addIf(o, "image", d.image); addIf(o, "datePublished", d.datePublished);
      addIf(o, "dateModified", d.dateModified);
      const au = makeAuthor(d.authorName); if (au) o.author = au;
      break;
    }
    case "BreadcrumbList": {
      o.itemListElement = bcItems.map((item, i) => ({
        "@type": "ListItem", position: i + 1, name: item.name,
        ...(item.url ? { item: item.url } : {}),
      }));
      break;
    }
    case "Article":
    case "BlogPosting": {
      addIf(o, "headline", d.headline); addIf(o, "url", d.url); addIf(o, "image", d.image);
      addIf(o, "datePublished", d.datePublished); addIf(o, "dateModified", d.dateModified);
      addIf(o, "description", d.description);
      const au = makeAuthor(d.authorName, d.authorUrl); if (au) o.author = au;
      const pu = makePublisher(d.pubName, d.pubLogo); if (pu) o.publisher = pu;
      break;
    }
    case "FAQPage": {
      o.mainEntity = faqItems.filter(i => i.q || i.a).map(item => ({
        "@type": "Question", name: item.q,
        acceptedAnswer: { "@type": "Answer", text: item.a },
      }));
      break;
    }
    case "Event": {
      addIf(o, "name", d.name); addIf(o, "description", d.description);
      addIf(o, "url", d.url); addIf(o, "image", d.image);
      addIf(o, "startDate", d.startDate); addIf(o, "endDate", d.endDate);
      if (d.eventStatus) o.eventStatus = `https://schema.org/${d.eventStatus}`;
      if (d.eventMode) o.eventAttendanceMode = `https://schema.org/${d.eventMode}`;
      if (d.locationName || d.locationUrl) {
        const loc: JsonObj = { "@type": "Place" };
        addIf(loc, "name", d.locationName);
        if (d.locationUrl) loc.sameAs = d.locationUrl;
        o.location = loc;
      }
      if (d.organizer) o.organizer = { "@type": "Organization", name: d.organizer };
      break;
    }
    case "Recipe": {
      addIf(o, "name", d.name); addIf(o, "description", d.description);
      addIf(o, "image", d.image); addIf(o, "datePublished", d.datePublished);
      addIf(o, "prepTime", d.prepTime); addIf(o, "cookTime", d.cookTime);
      addIf(o, "totalTime", d.totalTime); addIf(o, "recipeYield", d.recipeYield);
      addIf(o, "recipeCuisine", d.recipeCuisine); addIf(o, "recipeCategory", d.recipeCategory);
      const au = makeAuthor(d.authorName); if (au) o.author = au;
      const igr = ingredients.filter(Boolean);
      if (igr.length) o.recipeIngredient = igr;
      const ins = instructions.filter(Boolean);
      if (ins.length) o.recipeInstructions = ins.map((text, i) => ({ "@type": "HowToStep", position: i + 1, text }));
      const r = makeRating(d.ratingValue, d.reviewCount); if (r) o.aggregateRating = r;
      break;
    }
    case "Product": {
      addIf(o, "name", d.name); addIf(o, "description", d.description);
      addIf(o, "image", d.image); addIf(o, "url", d.url); addIf(o, "sku", d.sku);
      if (d.brand) o.brand = { "@type": "Brand", name: d.brand };
      const of2 = makeOffer(d.price, d.currency, d.availability); if (of2) o.offers = of2;
      const r = makeRating(d.ratingValue, d.reviewCount); if (r) o.aggregateRating = r;
      break;
    }
    case "Service": {
      addIf(o, "name", d.name); addIf(o, "description", d.description);
      addIf(o, "url", d.url); addIf(o, "image", d.image);
      addIf(o, "serviceType", d.serviceType); addIf(o, "areaServed", d.areaServed);
      if (d.provider) o.provider = { "@type": "Organization", name: d.provider };
      const of2 = makeOffer(d.price, d.currency); if (of2) o.offers = of2;
      break;
    }
    case "Review": {
      addIf(o, "reviewBody", d.reviewBody); addIf(o, "datePublished", d.datePublished);
      if (d.itemReviewed) { const it: JsonObj = { "@type": "Thing", name: d.itemReviewed }; addIf(it, "url", d.itemRevUrl); o.itemReviewed = it; }
      if (d.authorName) o.author = { "@type": "Person", name: d.authorName };
      if (d.ratingValue) {
        const rv: JsonObj = { "@type": "Rating", ratingValue: parseFloat(d.ratingValue) };
        if (d.bestRating) rv.bestRating = parseFloat(d.bestRating);
        if (d.worstRating) rv.worstRating = parseFloat(d.worstRating);
        o.reviewRating = rv;
      }
      break;
    }
    case "JobPosting": {
      addIf(o, "title", d.jobTitle); addIf(o, "description", d.description);
      addIf(o, "datePosted", d.datePosted); addIf(o, "validThrough", d.validThrough);
      addIf(o, "url", d.url);
      if (d.hiringOrg) o.hiringOrganization = { "@type": "Organization", name: d.hiringOrg };
      if (d.jobLocation) o.jobLocation = { "@type": "Place", address: { "@type": "PostalAddress", addressLocality: d.jobLocation } };
      if (d.jobLocType === "TELECOMMUTE") o.jobLocationType = "TELECOMMUTE";
      if (d.salary) o.baseSalary = { "@type": "MonetaryAmount", currency: d.currency || "USD", value: { "@type": "QuantitativeValue", value: parseFloat(d.salary), unitText: d.salaryUnit || "YEAR" } };
      if (d.empType) o.employmentType = d.empType;
      break;
    }
    case "SoftwareApplication": {
      addIf(o, "name", d.name); addIf(o, "description", d.description);
      addIf(o, "url", d.url); addIf(o, "image", d.image);
      addIf(o, "applicationCategory", d.appCategory);
      addIf(o, "operatingSystem", d.operatingSystem);
      addIf(o, "softwareVersion", d.softwareVersion);
      addIf(o, "downloadUrl", d.downloadUrl);
      const of2 = makeOffer(d.price ?? "0", d.currency || "USD"); if (of2) o.offers = of2;
      const r = makeRating(d.ratingValue, d.reviewCount); if (r) o.aggregateRating = r;
      break;
    }
    case "VideoObject": {
      addIf(o, "name", d.name); addIf(o, "description", d.description);
      addIf(o, "uploadDate", d.uploadDate); addIf(o, "thumbnailUrl", d.image);
      addIf(o, "duration", d.duration); addIf(o, "embedUrl", d.embedUrl);
      addIf(o, "contentUrl", d.contentUrl);
      break;
    }
    case "Course": {
      addIf(o, "name", d.name); addIf(o, "description", d.description);
      addIf(o, "url", d.url); addIf(o, "image", d.image); addIf(o, "courseCode", d.courseCode);
      if (d.provider) o.provider = { "@type": "Organization", name: d.provider };
      const r = makeRating(d.ratingValue, d.reviewCount); if (r) o.aggregateRating = r;
      break;
    }
    case "Book": {
      addIf(o, "name", d.name); addIf(o, "description", d.description);
      addIf(o, "url", d.url); addIf(o, "image", d.image);
      addIf(o, "isbn", d.isbn); addIf(o, "datePublished", d.datePublished);
      if (d.numPages) o.numberOfPages = parseInt(d.numPages);
      if (d.bookFormat) o.bookFormat = `https://schema.org/${d.bookFormat}`;
      if (d.authorName) o.author = { "@type": "Person", name: d.authorName };
      if (d.publisher) o.publisher = { "@type": "Organization", name: d.publisher };
      const of2 = makeOffer(d.price, d.currency); if (of2) o.offers = of2;
      break;
    }
  }
  return o;
}

// ── Validation ────────────────────────────────────────────────────────────────
function scoreSchema(s: AppState): { score: number; issues: Issue[] } {
  const issues: Issue[] = [];
  let score = 0;
  const def = SCHEMA_DEFS.find(x => x.type === s.type)!;
  const { d, faqItems, bcItems, ingredients, instructions } = s;

  if (s.type === "FAQPage") {
    const ok = faqItems.filter(i => i.q.trim() && i.a.trim());
    if (ok.length === 0) issues.push({ level: "error", text: "Add at least 1 FAQ item with both a question and an answer." });
    else if (ok.length < 2) { score += 40; issues.push({ level: "warning", text: "Google recommends at least 2 FAQ items for rich snippets." }); }
    else { score += 60; }
    faqItems.filter(i => (i.q.trim() && !i.a.trim()) || (!i.q.trim() && i.a.trim())).forEach(() => {
      if (!issues.some(x => x.text.includes("both"))) issues.push({ level: "error", text: "Each FAQ item must have both a question and an answer." });
    });
    if (ok.length >= 5) score += 20;
    if (ok.length >= 10) score += 20;
    return { score: Math.min(100, score), issues };
  }

  if (s.type === "BreadcrumbList") {
    const ok = bcItems.filter(i => i.name.trim());
    if (ok.length === 0) { issues.push({ level: "error", text: "Add breadcrumb items — start with Home." }); }
    else if (ok.length < 2) { score += 40; issues.push({ level: "warning", text: "Breadcrumbs need at least 2 items (e.g. Home › Current Page)." }); }
    else score += 60;
    if (ok.every(i => i.url.trim())) score += 40;
    else if (ok.some(i => i.url.trim())) { score += 20; issues.push({ level: "info", text: "Add URLs to all breadcrumb items for the best schema quality." }); }
    else issues.push({ level: "info", text: "Add URLs to breadcrumb items so Google can display the full trail." });
    return { score: Math.min(100, score), issues };
  }

  // General scoring
  const required = def.fields.filter(f => f.required);
  const optional = def.fields.filter(f => !f.required);
  const reqFilled = required.filter(f => d[f.key]?.trim());
  score += required.length > 0 ? Math.round(60 * reqFilled.length / required.length) : 60;
  required.filter(f => !d[f.key]?.trim()).forEach(f => {
    issues.push({ level: "error", text: `${f.label} is required — ${s.type} may not qualify for Rich Results without it.` });
  });
  const optFilled = optional.filter(f => d[f.key]?.trim()).length;
  score += optional.length > 0 ? Math.round(30 * optFilled / optional.length) : 20;
  if (s.type === "Recipe") {
    if (ingredients.filter(Boolean).length >= 3) score += 5;
    else issues.push({ level: "warning", text: "Add at least 3 ingredients for Recipe rich results." });
    if (instructions.filter(Boolean).length >= 2) score += 5;
    else issues.push({ level: "warning", text: "Add step-by-step instructions for Recipe rich results." });
  }
  def.fields.filter(f => f.type === "url" && d[f.key]).forEach(f => {
    if (!isValidUrl(d[f.key])) issues.push({ level: "error", text: `${f.label} must be a valid absolute URL (https://…).` });
  });
  const errors = issues.filter(i => i.level === "error").length;
  if (score >= 75 && errors === 0) issues.push({ level: "info", text: `Your ${s.type} schema is eligible for Google Rich Results.` });
  else if (score >= 50 && errors === 0) issues.push({ level: "info", text: "Add more fields to improve Rich Results eligibility." });
  return { score: Math.min(100, score), issues };
}

// ── JSON syntax highlighter ───────────────────────────────────────────────────
function hlJson(raw: string): string {
  const safe = raw.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return safe.replace(
    /("(?:[^"\\]|\\.)*")(\s*:)|("(?:[^"\\]|\\.)*")|\b(true|false|null)\b|(-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/g,
    (_m, key, colon, strVal, kw, num) => {
      if (key  !== undefined) return `<span style="color:#9cdcfe">${key}</span>${colon}`;
      if (strVal !== undefined) return `<span style="color:#ce9178">${strVal}</span>`;
      if (kw   !== undefined) return `<span style="color:#569cd6">${kw}</span>`;
      if (num  !== undefined) return `<span style="color:#b5cea8">${num}</span>`;
      return _m;
    },
  );
}

// ── Constants ─────────────────────────────────────────────────────────────────
const ACCENT = "#f97316";
const inputCls = "w-full rounded-xl px-3 py-2.5 text-[13px] outline-none transition-all bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] focus:border-[rgba(249,115,22,0.4)] text-[#e8dff0] placeholder-[#3d3345]";
const selectCls = "w-full rounded-xl px-2.5 py-2 text-[13px] outline-none transition-all cursor-pointer bg-[#1a1525] border border-[rgba(255,255,255,0.08)] focus:border-[rgba(249,115,22,0.4)] text-[#e8dff0]";
const labelCls = "text-[11px] font-semibold text-[#988d9f]";

// ── Sub-components ────────────────────────────────────────────────────────────
function PanelHeader({ icon, title, hint }: { icon: string; title: string; hint?: string }) {
  return (
    <div className="flex items-center gap-2 pb-1" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
      <span className="material-symbols-outlined text-[16px]" style={{ color: ACCENT }}>{icon}</span>
      <p className="text-[13px] font-bold" style={{ color: "#e8dff0" }}>{title}</p>
      {hint && <span className="text-[10px] ml-1" style={{ color: "#3d3345" }}>{hint}</span>}
    </div>
  );
}

function FieldInput({ fc, value, onChange }: { fc: FC; value: string; onChange: (v: string) => void }) {
  const invalid = fc.type === "url" && value && !isValidUrl(value);
  const borderStyle = invalid ? { borderColor: "rgba(239,68,68,0.5)" } : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label className={labelCls}>
        {fc.label}
        {fc.required && <span className="ml-1" style={{ color: ACCENT }}>*</span>}
        {fc.hint && <span className="ml-2 font-normal" style={{ color: "#3d3345" }}>{fc.hint}</span>}
      </label>
      {fc.type === "textarea" ? (
        <textarea rows={3} value={value} onChange={e => onChange(e.target.value)} placeholder={fc.placeholder} className={`${inputCls} resize-none`} style={borderStyle} />
      ) : fc.type === "select" ? (
        <select value={value} onChange={e => onChange(e.target.value)} className={selectCls}>
          <option value="">— not set —</option>
          {(fc.options ?? []).filter(Boolean).map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <input type={fc.type} value={value} onChange={e => onChange(e.target.value)} placeholder={fc.placeholder} className={inputCls} style={borderStyle} />
      )}
    </div>
  );
}

// ── Default state ─────────────────────────────────────────────────────────────
const DEFAULT_STATE: AppState = {
  type: "Organization", d: {},
  sameAs: [""],
  faqItems: [{ id: uid(), q: "", a: "" }, { id: uid(), q: "", a: "" }],
  bcItems:  [{ id: uid(), name: "Home", url: "https://example.com" }, { id: uid(), name: "", url: "" }],
  ingredients: [""],
  instructions: [""],
};

// ── Main component ────────────────────────────────────────────────────────────
export default function JsonLdSchemaGeneratorTool() {
  const [state,     setState]     = useState<AppState>(DEFAULT_STATE);
  const [outputTab, setOutputTab] = useState<OutputTab>("json");
  const [copied,    setCopied]    = useState<"json" | "html" | null>(null);

  // Patch helpers
  const setType = useCallback((type: SchemaType) => setState(p => ({ ...p, type })), []);
  const setD    = useCallback((key: string, val: string) => setState(p => ({ ...p, d: { ...p.d, [key]: val } })), []);

  // Derived
  const def        = useMemo(() => SCHEMA_DEFS.find(x => x.type === state.type)!, [state.type]);
  const schemaObj  = useMemo(() => buildSchemaObj(state), [state]);
  const jsonStr    = useMemo(() => JSON.stringify(schemaObj, null, 2), [schemaObj]);
  const htmlStr    = useMemo(() => `<script type="application/ld+json">\n${jsonStr}\n</script>`, [jsonStr]);
  const { score, issues } = useMemo(() => scoreSchema(state), [state]);
  const scoreColor = score >= 71 ? "#22c55e" : score >= 41 ? "#f59e0b" : "#ef4444";
  const scoreLabel = score >= 71 ? "Rich-results ready" : score >= 41 ? "Needs work" : "Incomplete";
  const circ = 2 * Math.PI * 34;

  // Array helpers
  const setSameAs = useCallback((idx: number, val: string) =>
    setState(p => { const a = [...p.sameAs]; a[idx] = val; return { ...p, sameAs: a }; }), []);
  const addSameAs   = useCallback(() => setState(p => ({ ...p, sameAs: [...p.sameAs, ""] })), []);
  const rmSameAs    = useCallback((idx: number) => setState(p => ({ ...p, sameAs: p.sameAs.filter((_, i) => i !== idx) })), []);

  const setFaqQ = useCallback((id: string, v: string) => setState(p => ({ ...p, faqItems: p.faqItems.map(x => x.id === id ? { ...x, q: v } : x) })), []);
  const setFaqA = useCallback((id: string, v: string) => setState(p => ({ ...p, faqItems: p.faqItems.map(x => x.id === id ? { ...x, a: v } : x) })), []);
  const addFaq  = useCallback(() => setState(p => ({ ...p, faqItems: [...p.faqItems, { id: uid(), q: "", a: "" }] })), []);
  const rmFaq   = useCallback((id: string) => setState(p => ({ ...p, faqItems: p.faqItems.length > 1 ? p.faqItems.filter(x => x.id !== id) : p.faqItems })), []);

  const setBcName = useCallback((id: string, v: string) => setState(p => ({ ...p, bcItems: p.bcItems.map(x => x.id === id ? { ...x, name: v } : x) })), []);
  const setBcUrl  = useCallback((id: string, v: string) => setState(p => ({ ...p, bcItems: p.bcItems.map(x => x.id === id ? { ...x, url: v } : x) })), []);
  const addBc   = useCallback(() => setState(p => ({ ...p, bcItems: [...p.bcItems, { id: uid(), name: "", url: "" }] })), []);
  const rmBc    = useCallback((id: string) => setState(p => ({ ...p, bcItems: p.bcItems.length > 1 ? p.bcItems.filter(x => x.id !== id) : p.bcItems })), []);

  const setIngr   = useCallback((i: number, v: string) => setState(p => { const a = [...p.ingredients]; a[i] = v; return { ...p, ingredients: a }; }), []);
  const addIngr   = useCallback(() => setState(p => ({ ...p, ingredients: [...p.ingredients, ""] })), []);
  const rmIngr    = useCallback((i: number) => setState(p => ({ ...p, ingredients: p.ingredients.filter((_, j) => j !== i) })), []);

  const setInstr  = useCallback((i: number, v: string) => setState(p => { const a = [...p.instructions]; a[i] = v; return { ...p, instructions: a }; }), []);
  const addInstr  = useCallback(() => setState(p => ({ ...p, instructions: [...p.instructions, ""] })), []);
  const rmInstr   = useCallback((i: number) => setState(p => ({ ...p, instructions: p.instructions.filter((_, j) => j !== i) })), []);

  // Copy / download
  const copy = useCallback(async (what: "json" | "html") => {
    try { await navigator.clipboard.writeText(what === "json" ? jsonStr : htmlStr); } catch { /* blocked */ }
    setCopied(what); setTimeout(() => setCopied(null), 2000);
  }, [jsonStr, htmlStr]);

  const dlJson = useCallback(() => {
    const b = new Blob([jsonStr], { type: "application/json" });
    const u = URL.createObjectURL(b);
    Object.assign(document.createElement("a"), { href: u, download: `${state.type.toLowerCase()}-schema.json` }).click();
    URL.revokeObjectURL(u);
  }, [jsonStr, state.type]);

  const reset = useCallback(() => { setState(DEFAULT_STATE); setCopied(null); }, []);

  return (
    <div className="mb-12 flex flex-col gap-6">

      {/* ── Schema type selector ──────────────────────────── */}
      <div className="glass-panel rounded-2xl p-5 flex flex-col gap-4" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
        <PanelHeader icon="schema" title="Schema Type" hint="19 types supported" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
          {SCHEMA_DEFS.map(sd => (
            <button key={sd.type} onClick={() => setType(sd.type)} aria-pressed={state.type === sd.type}
              className="flex items-start gap-2 px-3 py-2.5 rounded-xl text-left transition-all"
              style={state.type === sd.type ? { background: "rgba(249,115,22,0.10)", border: "1px solid rgba(249,115,22,0.32)" } : { background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <span className="material-symbols-outlined text-[18px] mt-0.5 shrink-0" style={{ color: state.type === sd.type ? ACCENT : sd.color }}>{sd.icon}</span>
              <div className="min-w-0">
                <p className="text-[12px] font-bold truncate" style={{ color: state.type === sd.type ? ACCENT : "#e8dff0" }}>{sd.label}</p>
                <p className="text-[10px] mt-0.5" style={{ color: "#988d9f" }}>{sd.category}</p>
              </div>
            </button>
          ))}
        </div>
        {/* Selected type description */}
        <div className="flex items-center gap-2 pt-1" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          <span className="material-symbols-outlined text-[14px]" style={{ color: ACCENT }}>info</span>
          <p className="text-[12px]" style={{ color: "#988d9f" }}>
            <span className="font-bold" style={{ color: ACCENT }}>{def.label}:</span> {def.description}
            {def.fields.filter(f => f.required).length > 0 && (
              <span className="ml-2" style={{ color: "#3d3345" }}>
                Required: {def.fields.filter(f => f.required).map(f => f.label).join(", ")}
              </span>
            )}
          </p>
        </div>
      </div>

      {/* ── Dynamic form ──────────────────────────────────── */}
      {def.fields.length > 0 && (
        <div className="glass-panel rounded-2xl p-5 flex flex-col gap-4" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
          <PanelHeader icon="edit" title={`${def.label} Details`} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {def.fields.map(fc => (
              <div key={fc.key} className={fc.type === "textarea" ? "sm:col-span-2" : ""}>
                <FieldInput fc={fc} value={state.d[fc.key] ?? ""} onChange={v => setD(fc.key, v)} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── SameAs URLs (Organization, Person) ───────────── */}
      {def.hasSameAs && (
        <div className="glass-panel rounded-2xl p-5 flex flex-col gap-3" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
          <PanelHeader icon="link" title="Social Profiles & Same-As URLs" hint="One per line — LinkedIn, Twitter, Facebook…" />
          {state.sameAs.map((url, i) => (
            <div key={i} className="flex items-center gap-2">
              <input type="url" value={url} onChange={e => setSameAs(i, e.target.value)}
                placeholder="https://www.linkedin.com/company/example"
                className={inputCls}
                style={url && !isValidUrl(url) ? { borderColor: "rgba(239,68,68,0.5)" } : undefined} />
              <button onClick={() => rmSameAs(i)} disabled={state.sameAs.length <= 1}
                className="w-7 h-7 flex items-center justify-center rounded-lg transition-all shrink-0 disabled:opacity-20"
                style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)" }}>
                <span className="material-symbols-outlined text-[13px] text-red-400">close</span>
              </button>
            </div>
          ))}
          <button onClick={addSameAs} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-bold self-start transition-all"
            style={{ background: "rgba(249,115,22,0.09)", color: ACCENT, border: "1px solid rgba(249,115,22,0.22)" }}>
            <span className="material-symbols-outlined text-[14px]">add</span>Add URL
          </button>
        </div>
      )}

      {/* ── FAQ items ─────────────────────────────────────── */}
      {def.hasFaq && (
        <div className="glass-panel rounded-2xl p-5 flex flex-col gap-4" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
          <PanelHeader icon="quiz" title="FAQ Items" hint={`${state.faqItems.length} question${state.faqItems.length !== 1 ? "s" : ""}`} />
          {state.faqItems.map((item, i) => (
            <div key={item.id} className="flex flex-col gap-2 p-4 rounded-xl" style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)" }}>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: ACCENT }}>Q{i + 1}</span>
                <button onClick={() => rmFaq(item.id)} disabled={state.faqItems.length <= 1}
                  className="w-6 h-6 flex items-center justify-center rounded-lg disabled:opacity-20 transition-all"
                  style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)" }}>
                  <span className="material-symbols-outlined text-[12px] text-red-400">close</span>
                </button>
              </div>
              <input value={item.q} onChange={e => setFaqQ(item.id, e.target.value)} placeholder="Enter the question…" className={inputCls} />
              <textarea rows={3} value={item.a} onChange={e => setFaqA(item.id, e.target.value)} placeholder="Enter the answer…" className={`${inputCls} resize-none`} />
            </div>
          ))}
          <button onClick={addFaq} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-bold self-start transition-all"
            style={{ background: "rgba(249,115,22,0.09)", color: ACCENT, border: "1px solid rgba(249,115,22,0.22)" }}>
            <span className="material-symbols-outlined text-[14px]">add</span>Add Question
          </button>
        </div>
      )}

      {/* ── Breadcrumb items ──────────────────────────────── */}
      {def.hasBc && (
        <div className="glass-panel rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
          <div className="px-5 py-4"><PanelHeader icon="chevron_right" title="Breadcrumb Items" hint="First item is usually Home" /></div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px]">
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.02)" }}>
                  <th className="text-left px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider" style={{ color: "#988d9f", width: "40px" }}>#</th>
                  <th className="text-left px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider" style={{ color: "#988d9f" }}>Name</th>
                  <th className="text-left px-3 py-2.5 text-[11px] font-bold uppercase tracking-wider" style={{ color: "#988d9f" }}>URL</th>
                  <th className="px-3 py-2.5" style={{ width: "44px" }} />
                </tr>
              </thead>
              <tbody>
                {state.bcItems.map((item, i) => (
                  <tr key={item.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }} className="hover:bg-[rgba(255,255,255,0.015)] transition-colors">
                    <td className="px-4 py-2 text-[12px] font-bold tabular-nums" style={{ color: "#988d9f" }}>{i + 1}</td>
                    <td className="px-3 py-2"><input value={item.name} onChange={e => setBcName(item.id, e.target.value)} placeholder="Home" className={inputCls} /></td>
                    <td className="px-3 py-2"><input type="url" value={item.url} onChange={e => setBcUrl(item.id, e.target.value)} placeholder="https://example.com" className={inputCls} style={item.url && !isValidUrl(item.url) ? { borderColor: "rgba(239,68,68,0.5)" } : undefined} /></td>
                    <td className="px-3 py-2">
                      <button onClick={() => rmBc(item.id)} disabled={state.bcItems.length <= 1}
                        className="w-7 h-7 flex items-center justify-center rounded-lg disabled:opacity-20 transition-all"
                        style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)" }}>
                        <span className="material-symbols-outlined text-[13px] text-red-400">close</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3" style={{ borderTop: "1px solid rgba(255,255,255,0.05)", background: "rgba(255,255,255,0.01)" }}>
            <button onClick={addBc} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-bold transition-all"
              style={{ background: "rgba(249,115,22,0.09)", color: ACCENT, border: "1px solid rgba(249,115,22,0.22)" }}>
              <span className="material-symbols-outlined text-[14px]">add</span>Add Item
            </button>
          </div>
        </div>
      )}

      {/* ── Ingredients ───────────────────────────────────── */}
      {def.hasIngr && (
        <div className="glass-panel rounded-2xl p-5 flex flex-col gap-3" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
          <PanelHeader icon="grocery" title="Ingredients" hint="One per item" />
          {state.ingredients.map((val, i) => (
            <div key={i} className="flex items-center gap-2">
              <input value={val} onChange={e => setIngr(i, e.target.value)} placeholder={`Ingredient ${i + 1}`} className={inputCls} />
              <button onClick={() => rmIngr(i)} disabled={state.ingredients.length <= 1}
                className="w-7 h-7 flex items-center justify-center rounded-lg disabled:opacity-20 transition-all shrink-0"
                style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)" }}>
                <span className="material-symbols-outlined text-[13px] text-red-400">close</span>
              </button>
            </div>
          ))}
          <button onClick={addIngr} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-bold self-start transition-all"
            style={{ background: "rgba(249,115,22,0.09)", color: ACCENT, border: "1px solid rgba(249,115,22,0.22)" }}>
            <span className="material-symbols-outlined text-[14px]">add</span>Add Ingredient
          </button>
        </div>
      )}

      {/* ── Instructions ──────────────────────────────────── */}
      {def.hasInstr && (
        <div className="glass-panel rounded-2xl p-5 flex flex-col gap-3" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
          <PanelHeader icon="list_alt" title="Instructions" hint="One step per item" />
          {state.instructions.map((val, i) => (
            <div key={i} className="flex items-start gap-2">
              <div className="flex items-center justify-center w-6 h-9 shrink-0">
                <span className="text-[11px] font-bold tabular-nums" style={{ color: "#988d9f" }}>{i + 1}</span>
              </div>
              <textarea rows={2} value={val} onChange={e => setInstr(i, e.target.value)} placeholder={`Step ${i + 1}…`} className={`${inputCls} resize-none flex-1`} />
              <button onClick={() => rmInstr(i)} disabled={state.instructions.length <= 1}
                className="w-7 h-7 flex items-center justify-center rounded-lg disabled:opacity-20 transition-all mt-1 shrink-0"
                style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)" }}>
                <span className="material-symbols-outlined text-[13px] text-red-400">close</span>
              </button>
            </div>
          ))}
          <button onClick={addInstr} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[12px] font-bold self-start transition-all"
            style={{ background: "rgba(249,115,22,0.09)", color: ACCENT, border: "1px solid rgba(249,115,22,0.22)" }}>
            <span className="material-symbols-outlined text-[14px]">add</span>Add Step
          </button>
        </div>
      )}

      {/* ── Validation score ──────────────────────────────── */}
      <div className="glass-panel rounded-2xl p-5 flex flex-wrap items-start gap-6" style={{ border: "1px solid rgba(255,255,255,0.07)" }}>
        <div className="flex flex-col items-center gap-1.5 shrink-0">
          <div className="relative w-20 h-20">
            <svg width="80" height="80" viewBox="0 0 80 80" aria-hidden="true">
              <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="6" />
              <circle cx="40" cy="40" r="34" fill="none" stroke={scoreColor} strokeWidth="6"
                strokeDasharray={circ} strokeDashoffset={circ * (1 - score / 100)}
                strokeLinecap="round" transform="rotate(-90 40 40)"
                style={{ transition: "stroke-dashoffset 0.4s ease, stroke 0.4s ease" }} />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[20px] font-black tabular-nums" style={{ color: scoreColor, lineHeight: 1 }}>{score}</span>
              <span className="text-[9px] font-bold" style={{ color: scoreColor, opacity: 0.7 }}>/ 100</span>
            </div>
          </div>
          <span className="text-[10px] font-bold text-center leading-tight" style={{ color: scoreColor }}>{scoreLabel}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[12px] font-bold mb-2" style={{ color: "#e8dff0" }}>Rich Results Readiness</p>
          {issues.length === 0 ? (
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px] text-green-400">check_circle</span>
              <span className="text-[13px]" style={{ color: "#22c55e" }}>Schema looks great!</span>
            </div>
          ) : (
            <ul className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-1">
              {issues.map((iss, i) => {
                const ic = iss.level === "error" ? "#ef4444" : iss.level === "warning" ? "#f59e0b" : "#60a5fa";
                const ig = iss.level === "error" ? "error" : iss.level === "warning" ? "warning" : "info";
                return (
                  <li key={i} className="flex items-start gap-2">
                    <span className="material-symbols-outlined text-[14px] mt-0.5 shrink-0" style={{ color: ic }}>{ig}</span>
                    <span className="text-[12px]" style={{ color: "#c8b89f" }}>{iss.text}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* ── Actions ───────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3">
        <button onClick={() => copy("json")} className="btn-primary flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm">
          <span className="material-symbols-outlined text-[16px]">{copied === "json" ? "check" : "content_copy"}</span>
          {copied === "json" ? "Copied!" : "Copy JSON-LD"}
        </button>
        <button onClick={() => copy("html")} className="flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm transition-all"
          style={{ background: "rgba(249,115,22,0.09)", color: ACCENT, border: "1px solid rgba(249,115,22,0.22)" }}>
          <span className="material-symbols-outlined text-[15px]">{copied === "html" ? "check" : "code"}</span>
          {copied === "html" ? "Copied!" : "Copy Script Tag"}
        </button>
        <button onClick={dlJson} className="flex items-center gap-2 px-4 py-3 rounded-xl font-semibold text-sm transition-all"
          style={{ background: "rgba(255,255,255,0.04)", color: "#c8c0d0", border: "1px solid rgba(255,255,255,0.08)" }}>
          <span className="material-symbols-outlined text-[14px]">download</span>Download .json
        </button>
        <button onClick={reset} className="flex items-center gap-2 px-4 py-3 rounded-xl font-semibold text-sm transition-all ml-auto"
          style={{ background: "rgba(255,255,255,0.03)", color: "#988d9f", border: "1px solid rgba(255,255,255,0.07)" }}>
          <span className="material-symbols-outlined text-[14px]">restart_alt</span>Reset
        </button>
      </div>

      {/* ── JSON output ───────────────────────────────────── */}
      <div className="glass-panel rounded-2xl overflow-hidden" style={{ border: "1px solid rgba(249,115,22,0.18)" }}>
        <div className="px-5 py-3 flex items-center justify-between flex-wrap gap-3"
          style={{ borderBottom: "1px solid rgba(249,115,22,0.1)", background: "rgba(249,115,22,0.03)" }}>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[14px]" style={{ color: ACCENT }}>data_object</span>
            <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: ACCENT }}>Generated Schema</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: "rgba(249,115,22,0.1)", color: ACCENT }}>Live</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-xl overflow-hidden" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
              {(["json", "html"] as OutputTab[]).map(t => (
                <button key={t} onClick={() => setOutputTab(t)} className="px-3 py-1 text-[11px] font-bold transition-all"
                  style={outputTab === t ? { background: "rgba(249,115,22,0.15)", color: ACCENT } : { background: "transparent", color: "#988d9f" }}>
                  {t === "json" ? "JSON-LD" : "Script Tag"}
                </button>
              ))}
            </div>
            <button onClick={() => copy(outputTab)} className="flex items-center gap-1.5 px-3 py-1 rounded-xl text-[11px] font-bold"
              style={{ background: "rgba(249,115,22,0.1)", color: ACCENT }}>
              <span className="material-symbols-outlined text-[12px]">{copied === outputTab ? "check" : "content_copy"}</span>
              {copied === outputTab ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>
        <pre className="p-5 overflow-x-auto text-[12px] leading-relaxed m-0 max-h-[520px] overflow-y-auto"
          style={{ fontFamily: "'Cascadia Code','Fira Code','Courier New',monospace", background: "#0d0d14" }}>
          {outputTab === "json" ? (
            <code dangerouslySetInnerHTML={{ __html: hlJson(jsonStr) }} />
          ) : (
            <code>
              <span style={{ color: "#569cd6" }}>{`<script type="application/ld+json">`}</span>
              {"\n"}
              <span dangerouslySetInnerHTML={{ __html: hlJson(jsonStr) }} />
              {"\n"}
              <span style={{ color: "#569cd6" }}>{`</script>`}</span>
            </code>
          )}
        </pre>
      </div>

    </div>
  );
}
