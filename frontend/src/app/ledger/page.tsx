import { Suspense } from "react";
import { LedgerView } from "@/components/ledger/ledger-view";

export default function Page() {
  // LedgerView reads ?topic= from the URL, which needs a Suspense boundary during prerender.
  return (
    <Suspense>
      <LedgerView />
    </Suspense>
  );
}
