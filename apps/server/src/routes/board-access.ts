import { z } from "zod";

export const BOARD_NOT_FOUND = "Board not found.";

/** A route param that must be a UUID; anything else can't match a row, so it reads as "not found". */
export function uuidParam(value: string | string[] | undefined) {
  const result = z.uuid().safeParse(value);
  return result.success ? result.data : undefined;
}

/** The user's live boards. A board in an archived project is hidden along with it. */
export const liveBoardWhere = (ownerId: string) => ({
  ownerId,
  archivedAt: null,
  OR: [{ projectId: null }, { project: { archivedAt: null } }],
});
