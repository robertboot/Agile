import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ContractEditor } from "./ContractEditor";

export default async function AdminContractPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { data: contract } = await supabase
    .from("contract_templates")
    .select("body, updated_at")
    .limit(1)
    .maybeSingle();

  return <ContractEditor body={contract?.body ?? ""} updatedAt={contract?.updated_at ?? null} />;
}
