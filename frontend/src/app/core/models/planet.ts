/** A planet as served by POST/GET /api/planet and PATCH /api/planet/name. */
export interface PlanetDto {
  id: string;
  /** 8 characters from A-Z and 2-9; typed on another device to open this planet (ACC-04). */
  code: string;
  name: string;
  version: number;
  /** ISO timestamp. */
  createdAt: string;
}
