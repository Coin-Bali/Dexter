export type CompositionDraft = {
  name: string;
  description: string;
  sourceApis: {
    url: string;
    method: string;
    name: string;
    description: string;
  }[];
  aiPrompt: string;
  price: string;
};
