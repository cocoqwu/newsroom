// Quote permission per speaker. "approved" may be quoted directly; "paraphrase" means ideas
// only, never a direct quote; "off" means off the record: nothing from that speaker reaches a draft.
export type Permission = "approved" | "paraphrase" | "off";

export const permissionLabel: Record<Permission, string> = { approved: "Quotes approved", paraphrase: "Paraphrase only", off: "Off the record" };

export function canQuote(p: string | null | undefined): boolean { return p === "approved"; }
export function canUse(p: string | null | undefined): boolean { return p !== "off"; }
