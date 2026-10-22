// The exact request "Send to blog as draft" would make to the Webflow CMS API (v2). This is a mock
// in this version: nothing is sent. A real integration needs a site API token and the blog's
// collection id from the AGI House team, plus an asset upload for the hero image.
import { slugify } from "@/lib/text";

export type WebflowPayload = {
  note: string;
  request: {
    method: "POST";
    url: string;
    headers: Record<string, string>;
    body: {
      isArchived: boolean;
      isDraft: boolean;
      fieldData: Record<string, unknown>;
    };
  };
  followUps: string[];
};

export function webflowPayload(opts: { title: string; summary: string; bodyHtml: string; category: string; author: string; date: string; heroHint: string }): WebflowPayload {
  const collectionId = process.env.WEBFLOW_COLLECTION_ID || "<BLOG_POSTS_COLLECTION_ID>";
  return {
    note: "Mock. This payload is shown, not sent. Webflow CMS API v2: create a collection item as a draft, then the editor publishes from Webflow.",
    request: {
      method: "POST",
      url: `https://api.webflow.com/v2/collections/${collectionId}/items`,
      headers: {
        Authorization: "Bearer <WEBFLOW_API_TOKEN from the AGI House team>",
        "Content-Type": "application/json",
        "accept-version": "2.0.0",
      },
      body: {
        isArchived: false,
        isDraft: true,
        fieldData: {
          name: opts.title,
          slug: slugify(opts.title),
          "post-summary": opts.summary,
          "post-body": opts.bodyHtml,
          category: opts.category,
          author: opts.author,
          "publish-date": opts.date,
          "main-image": `<asset id after POST /v2/sites/{site_id}/assets for: ${opts.heroHint}>`,
        },
      },
    },
    followUps: [
      "Upload the hero image through POST /v2/sites/{site_id}/assets and put the returned asset id in fieldData.main-image.",
      "Field slugs (post-body, post-summary, category, author, publish-date) must match the blog collection's schema; confirm them in Webflow's CMS settings.",
      "Category and author are reference fields in Webflow; send item ids instead of names once the ids are known.",
      "Keep isDraft: true so nothing goes live without an editor publishing it in Webflow.",
    ],
  };
}
