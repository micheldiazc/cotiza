import { Suspense } from "react";
import { iniciarSesion } from "../actions";
import { FormularioAuth } from "../formulario-auth";

// Leer searchParams depende de la petición: va dentro de <Suspense> para que
// el resto de la página se pueda servir al instante (Cache Components).
async function AvisoEnlace({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  if (error !== "enlace") return null;

  return (
    <p className="text-sm text-red-600">
      El enlace de confirmación no es válido o ha caducado. Prueba a entrar o regístrate de nuevo.
    </p>
  );
}

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  return (
    <div className="flex w-full flex-col items-center gap-4">
      <Suspense fallback={null}>
        <AvisoEnlace searchParams={searchParams} />
      </Suspense>
      <FormularioAuth
        titulo="Entrar"
        descripcion="Accede a tus presupuestos."
        textoBoton="Entrar"
        accion={iniciarSesion}
        enlace={{ pregunta: "¿No tienes cuenta?", texto: "Regístrate", href: "/registro" }}
      />
    </div>
  );
}
