"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { EstadoFormulario } from "./actions";

type Props = {
  titulo: string;
  descripcion: string;
  textoBoton: string;
  accion: (estado: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;
  enlace: { pregunta: string; texto: string; href: string };
};

export function FormularioAuth({ titulo, descripcion, textoBoton, accion, enlace }: Props) {
  const [estado, enviar, pendiente] = useActionState(accion, undefined);

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-2xl">{titulo}</CardTitle>
        <CardDescription>{descripcion}</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={enviar} className="flex flex-col gap-4">
          <div className="grid gap-2">
            <Label htmlFor="email">Correo</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete={textoBoton === "Crear cuenta" ? "new-password" : "current-password"}
              required
            />
          </div>

          {estado?.error && <p className="text-sm text-red-600">{estado.error}</p>}
          {estado?.mensaje && <p className="text-sm text-green-700">{estado.mensaje}</p>}

          <Button type="submit" disabled={pendiente}>
            {pendiente ? "Un momento…" : textoBoton}
          </Button>

          <p className="text-center text-sm text-zinc-600">
            {enlace.pregunta}{" "}
            <Link href={enlace.href} className="font-medium underline underline-offset-4">
              {enlace.texto}
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
