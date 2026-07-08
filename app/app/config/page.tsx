import { Settings } from "lucide-react";

import { RoutePlaceholder } from "@/components/layout/route-placeholder";

export default function ConfigPage() {
  return (
    <RoutePlaceholder
      description="Preferencias do workspace e integracoes futuras."
      icon={Settings}
      title="Config"
    />
  );
}
