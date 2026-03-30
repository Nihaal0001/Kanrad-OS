// Client-specific configuration
// Change this file to rebrand the ERP for a different client/industry.
// This is the ONLY file that needs editing for branding — all other files import from here.

export const clientConfig = {
  // Brand
  brandName: "KANRAD ERP",
  shortName: "KH",
  industry: "Houseware Manufacturing",
  tagline: "Houseware Manufacturing ERP",
  emailDomain: "kanrad.in",

  // Document prefixes (display only — actual generation is in DB triggers)
  orderPrefix: "KH-ORD",
  invoicePrefix: "KH-INV",
  challanPrefix: "KH-DC",
  purchaseOrderPrefix: "KH-PO",
  bomPrefix: "KH-BOM",

  // Colors — primary hex used in PDFs and email HTML
  primaryHex: "#1a3aaa", // Navy blue (from Kanrad logo)

  // Industry-specific defect types for QC
  defectTypes: [
    "Dent / Deformation",
    "Surface Scratch",
    "Coating Defect",
    "Dimensional Non-conformance",
    "Welding / Joint Defect",
    "Color Variation",
    "Finishing Defect",
    "Label / Packaging Issue",
    "Other",
  ],

  // Product category presets
  productCategories: [
    { id: "cookware", name: "Cookware", hsn_code: "7323" },
    { id: "kitchenware", name: "Kitchenware", hsn_code: "7323" },
    { id: "storage", name: "Storage & Containers", hsn_code: "3923" },
    { id: "cleaning", name: "Cleaning Tools", hsn_code: "9603" },
    { id: "home-decor", name: "Home Décor", hsn_code: "6304" },
    { id: "other", name: "Other", hsn_code: "9999" },
  ],

  // AI context
  aiIndustryContext:
    "a houseware manufacturing unit producing cookware, kitchenware, and home products",
  aiStagesDescription:
    "Production stages: Raw Material Receipt → Cutting/Pressing → Forming/Shaping → Assembly/Welding → Surface Treatment → Quality Check → Packing → Dispatch.",

  // Terminology overrides (vs Kanrad ERP defaults)
  terminology: {
    order: "Work Order",
    orderPlural: "Work Orders",
    sales: "Orders",
    outward: "Dispatch",
    material: "Raw Material",
    materialPlural: "Raw Materials",
    production: "Production",
    qualityCheck: "QC Inspection",
  },
}
