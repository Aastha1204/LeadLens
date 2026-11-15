export type Plan = "care_basic" | "care_growth" | "leadlens";

export interface ClientMeta {
  id: string;
  slug: string;
  name: string;
  city: string;
  industry: string;
  plan: Plan;
}

export const PLAN_PRICE: Record<Plan, number> = {
  care_basic: 2999,
  care_growth: 5999,
  leadlens: 1499,
};

export const PLAN_LABEL: Record<Plan, string> = {
  care_basic: "Care Basic",
  care_growth: "Care Growth",
  leadlens: "LeadLens standalone",
};

export const OWNER_CLIENT_SLUG = "urban-nest";

export const CLIENTS: ClientMeta[] = [
  { id: "c1", slug: "urban-nest", name: "Urban Nest Interiors", city: "Thane", industry: "Interiors", plan: "care_growth" },
  { id: "c2", slug: "brightsmile", name: "BrightSmile Dental Studio", city: "Kalyan", industry: "Dental", plan: "care_basic" },
  { id: "c3", slug: "apex-coaching", name: "Apex Coaching Classes", city: "Dombivli", industry: "Coaching", plan: "care_growth" },
  { id: "c4", slug: "fitforge", name: "FitForge Gym", city: "Mulund", industry: "Fitness", plan: "care_basic" },
  { id: "c5", slug: "shree-realty", name: "Shree Realty", city: "Navi Mumbai", industry: "Real estate", plan: "leadlens" },
];

export const clientBySlug = (slug: string) => CLIENTS.find((c) => c.slug === slug);
