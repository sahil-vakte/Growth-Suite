import AssistantManager from "@/components/admin/AssistantManager";
import { env } from "@/lib/env";
export default function AssistantPage() {
  return <AssistantManager baseUrl={env.appUrl} />;
}
