// The photo shown for the signed-in user. An uploaded photo (imageKey, set by the server's
// /api/account/photo route) wins over the sign-in provider's, which Better Auth may refresh.

type PhotoUser = { image?: string | null; imageKey?: unknown };

export function userPhoto(user: PhotoUser) {
  const key = typeof user.imageKey === "string" ? user.imageKey : null;
  return key
    ? new URL(`/${key}`, import.meta.env.VITE_SERVER_URL).toString()
    : (user.image ?? null);
}
