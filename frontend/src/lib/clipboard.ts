import { toast } from "sonner";

/** Copy text and tell the user how it went. Resolves true on success. */
export async function copyText(text: string, success = "Copied to clipboard"): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(success);
    return true;
  } catch {
    toast.error("Couldn't copy", { description: "Your browser blocked clipboard access." });
    return false;
  }
}
