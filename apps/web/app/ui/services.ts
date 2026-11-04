// The five services, always all five, in this order, with the full wording
// (PLAN D-001; ServiceKey README). The objects are the exported Studio
// artwork, bundled by Vite as files of this app.
import fines from "../../../../planning/design/brand/exports/studio/objects/carworx-object-fines-admin.svg?url";
import glass from "../../../../planning/design/brand/exports/studio/objects/carworx-object-glass-repair.svg?url";
import repairs from "../../../../planning/design/brand/exports/studio/objects/carworx-object-repairs-maintenance.svg?url";
import tyres from "../../../../planning/design/brand/exports/studio/objects/carworx-object-tyres-alignment.svg?url";
import wash from "../../../../planning/design/brand/exports/studio/objects/carworx-object-wash-detailing.svg?url";

export interface Service {
  key: "wash" | "repairs" | "glass" | "tyres" | "fines";
  label: string;
  object: string;
}

export const SERVICES: readonly Service[] = [
  { key: "wash", label: "Wash & Detailing", object: wash },
  { key: "repairs", label: "Repairs & Maintenance", object: repairs },
  { key: "glass", label: "Glass Repair & Replacement", object: glass },
  { key: "tyres", label: "Tyres & Wheel Alignment", object: tyres },
  { key: "fines", label: "Fines & Vehicle Admin", object: fines },
];

/** Keeps "&" with the word before it, so a line never starts with "&". */
export const keepAmp = (label: string) => label.replace(" & ", " & ");
