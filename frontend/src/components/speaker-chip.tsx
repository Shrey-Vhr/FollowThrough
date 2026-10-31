import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { PERSON_CLASSES, resolvePerson } from "@/lib/people";
import { cn } from "@/lib/utils";

/** Colored speaker label. The tone is consistent per person across the whole app. */
export function SpeakerChip({ speaker, className }: { speaker: string; className?: string }) {
  const p = resolvePerson(speaker);
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center gap-1.5 whitespace-nowrap rounded-full border px-2 text-[11px] font-medium leading-none",
        PERSON_CLASSES[p.tone],
        className,
      )}
    >
      {p.name}
      {p.hint && <span className="font-normal opacity-60">{p.hint}</span>}
    </span>
  );
}

export function PersonAvatar({
  name,
  size = "sm",
  className,
}: {
  name: string;
  size?: "sm" | "default";
  className?: string;
}) {
  const p = resolvePerson(name);
  return (
    <Avatar size={size} className={className} title={p.name}>
      <AvatarFallback className={cn("border text-[10px] font-semibold", PERSON_CLASSES[p.tone])}>
        {p.initials}
      </AvatarFallback>
    </Avatar>
  );
}
