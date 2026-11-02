import { defineSite } from "@silicon/website-seo-engine";

export const site = defineSite({
  id: "example-site",
  name: "Example Site",
  pages: [{
    id: "about",
    path: "/about",
    label: "About",
    fields: {
      title: { type: "text", required: true, maxLength: 120 },
      introduction: { type: "richText", required: true },
      heroImage: { type: "image" }
    }
  }]
});
