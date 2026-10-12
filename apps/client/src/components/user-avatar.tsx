import { userPhoto } from "@/lib/user-photo";
import { cn } from "@/lib/utils";

type AvatarUser = { name: string; email: string; image?: string | null; imageKey?: unknown };

/** The signed-in user's photo (uploaded, else the sign-in provider's), or their initial. */
export function UserAvatar({ user, className }: { user: AvatarUser; className?: string }) {
  const photo = userPhoto(user);
  return photo ? (
    <img
      src={photo}
      alt=""
      referrerPolicy="no-referrer"
      className={cn("size-8 shrink-0 rounded-full object-cover", className)}
    />
  ) : (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-full bg-brand font-mono text-[13px] font-bold text-slate uppercase",
        className,
      )}
    >
      {(user.name || user.email).charAt(0)}
    </span>
  );
}
