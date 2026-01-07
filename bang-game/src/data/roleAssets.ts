// src/data/roleAssets.ts

import type { Role } from "../models/player";

export const ROLE_IMAGES: Record<Role, any> = {
  sheriff: require("../../assets/roles/sheriff.png"),
  deputy: require("../../assets/roles/deputy.png"),
  outlaw: require("../../assets/roles/outlaw.png"),
  renegade: require("../../assets/roles/renegade.png"),
};

export function getRoleImage(role: Role) {
  return ROLE_IMAGES[role];
}
