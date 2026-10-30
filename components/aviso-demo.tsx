"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { restablecerDemo } from "@/lib/datos";

export function AvisoDemo() {
  const [restableciendo, setRestableciendo] = useState(false);

  async function restablecer() {
    if (!confirm("Se borrarán tus cambios y volverán los datos de ejemplo. ¿Continuar?")) return;
    setRestableciendo(true);
    await restablecerDemo();
    window.location.reload();
  }

  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 bg-amber-100 px-4 py-2 text-center text-sm text-amber-950 dark:bg-amber-950 dark:text-amber-100"
    >
      <span>
        <strong>Demo:</strong> tus datos se guardan solo en este navegador.
      </span>
      <Button size="sm" variant="outline" onClick={restablecer} disabled={restableciendo}>
        {restableciendo ? "Restableciendo…" : "Restablecer demo"}
      </Button>
    </div>
  );
}
