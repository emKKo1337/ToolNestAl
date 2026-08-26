// Single canonical author record for the site's editorial content.
// ToolNest AI currently has one named author; when a second author joins,
// convert this to a small registry keyed by slug.

export interface Author {
  slug: string;
  name: string;
  bio: string;
  role: string;
  location: string;
  github: string;
  twitter: string;
}

export const AUTHOR: Author = {
  slug: "emir-locic",
  name: "Emir Ločić",
  bio: "I'm a developer focused on building practical online tools, with several years of experience in web development. I created ToolNest AI to make useful AI-powered tools simple, accessible, and free to use in one place.",
  role: "Founder & Developer, ToolNest AI",
  location: "Slovenia",
  github: "https://github.com/emKKo1337",
  twitter: "emKKo1337",
};
