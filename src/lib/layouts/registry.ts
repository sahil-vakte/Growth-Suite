/** Built-in section layouts. Content follows the layout rules: every button is a CTA object, every image is {url, alt},
 * lists ship with at least two complete items, and no visitor-facing text is hard-coded in the renderer. */
const cta = (label = "") => ({ label, type: "url", value: "", target: "_self", wa_message: "" });
const img = () => ({ url: "", alt: "" });

export interface LayoutDef {
  key: string;
  name: string;
  category: string;
  defaultContent: Record<string, unknown>;
}

export const builtinLayouts: LayoutDef[] = [
  {
    key: "hero_split",
    name: "Hero — text and image",
    category: "hero",
    defaultContent: {
      eyebrow: "",
      heading: "A clear promise to your visitor",
      subheading: "One or two sentences that explain the offer and who it is for.",
      bullets: ["First benefit", "Second benefit"],
      primaryCta: cta("Get a quote"),
      secondaryCta: cta(),
      image: img(),
      background: "surface",
    },
  },
  {
    key: "hero_centered",
    name: "Hero — centred",
    category: "hero",
    defaultContent: {
      eyebrow: "",
      heading: "Headline that states the outcome",
      subheading: "Supporting line.",
      primaryCta: cta("Start now"),
      secondaryCta: cta(),
      backgroundImage: img(),
    },
  },
  {
    key: "rich_text",
    name: "Text block",
    category: "content",
    defaultContent: {
      heading: "Section heading",
      body: "Write your paragraph here. Line breaks are kept.",
      align: "left",
    },
  },
  {
    key: "features_grid",
    name: "Feature cards",
    category: "content",
    defaultContent: {
      heading: "Why choose us",
      subheading: "",
      items: [
        { icon: "★", title: "Benefit one", text: "Short explanation.", image: img() },
        { icon: "✓", title: "Benefit two", text: "Short explanation.", image: img() },
        { icon: "⚡", title: "Benefit three", text: "Short explanation.", image: img() },
      ],
      primaryCta: cta(),
    },
  },
  {
    key: "steps",
    name: "Process steps",
    category: "content",
    defaultContent: {
      heading: "How it works",
      items: [
        { title: "Tell us what you need", text: "A short form or a call." },
        { title: "Get your plan", text: "We send options within a day." },
        { title: "Start", text: "We handle the rest." },
      ],
      primaryCta: cta(),
    },
  },
  {
    key: "stats",
    name: "Numbers strip",
    category: "trust",
    defaultContent: {
      items: [
        { value: "1,200+", label: "Happy customers" },
        { value: "4.9/5", label: "Average rating" },
        { value: "24h", label: "Response time" },
      ],
    },
  },
  {
    key: "testimonials",
    name: "Testimonials",
    category: "trust",
    defaultContent: {
      heading: "What customers say",
      items: [
        {
          quote: "Add a real customer quote.",
          name: "Customer name",
          role: "City or company",
          image: img(),
          rating: 5,
        },
        { quote: "Add a second quote.", name: "Customer name", role: "", image: img(), rating: 5 },
      ],
    },
  },
  {
    key: "reviews_live",
    name: "Approved reviews (live)",
    category: "trust",
    defaultContent: { heading: "Reviews", max: 6 },
  },
  {
    key: "faq",
    name: "FAQ accordion",
    category: "content",
    defaultContent: {
      heading: "Frequently asked questions",
      items: [
        { q: "First question?", a: "Answer." },
        { q: "Second question?", a: "Answer." },
      ],
      addSchema: true,
    },
  },
  {
    key: "pricing",
    name: "Pricing table",
    category: "sales",
    defaultContent: {
      heading: "Plans",
      items: [
        {
          name: "Starter",
          price: "£49",
          period: "/month",
          features: ["Feature A", "Feature B"],
          highlight: false,
          primaryCta: cta("Choose Starter"),
        },
        {
          name: "Growth",
          price: "£99",
          period: "/month",
          features: ["Everything in Starter", "Feature C"],
          highlight: true,
          primaryCta: cta("Choose Growth"),
        },
      ],
    },
  },
  {
    key: "cta_banner",
    name: "Call-to-action banner",
    category: "sales",
    defaultContent: {
      heading: "Ready to talk?",
      text: "We usually reply within the hour.",
      primaryCta: cta("Chat on WhatsApp"),
      secondaryCta: cta("Call us"),
    },
  },
  {
    key: "form_embed",
    name: "Form with text",
    category: "lead",
    defaultContent: {
      heading: "Get your free quote",
      text: "Tell us a little about what you need.",
      formId: "",
      bullets: ["No obligation", "Reply within 24 hours"],
      image: img(),
    },
  },
  {
    key: "gallery",
    name: "Image gallery",
    category: "media",
    defaultContent: {
      heading: "",
      items: [
        { image: img(), caption: "" },
        { image: img(), caption: "" },
        { image: img(), caption: "" },
      ],
    },
  },
  {
    key: "video",
    name: "Video",
    category: "media",
    defaultContent: { heading: "", videoType: "youtube", videoUrl: "", caption: "" },
  },
  {
    key: "logo_strip",
    name: "Logo strip",
    category: "trust",
    defaultContent: {
      heading: "Trusted by",
      items: [
        { image: img(), name: "Partner" },
        { image: img(), name: "Partner" },
      ],
    },
  },
  {
    key: "contact_split",
    name: "Contact details",
    category: "lead",
    defaultContent: {
      heading: "Get in touch",
      address: "",
      phone: "",
      email: "",
      hours: "",
      primaryCta: cta("WhatsApp us"),
      formId: "",
    },
  },
  {
    key: "latest_blogs",
    name: "Latest blog posts",
    category: "content",
    defaultContent: { heading: "From the blog", max: 3 },
  },
  {
    key: "products_grid",
    name: "Products",
    category: "sales",
    defaultContent: { heading: "Shop", max: 6 },
  },
];

export const layoutByKey = (k: string) => builtinLayouts.find((l) => l.key === k);
