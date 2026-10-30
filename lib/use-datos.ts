"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ErrorDatos, obtenerRepositorio, type Repositorio } from "@/lib/datos";

/** Mensaje para el usuario: los de nuestras reglas tal cual, el resto genérico. */
export function mensajeDeError(error: unknown): string {
  if (error instanceof ErrorDatos) return error.message;
  console.error(error);
  return "Algo salió mal. Inténtalo de nuevo.";
}

interface Estado<T> {
  datos: T | undefined;
  error: string | null;
  cargando: boolean;
}

/**
 * Carga datos del repositorio al montar el componente.
 *
 *   const { datos, cargando, error, recargar } = useDatos((repo) => repo.clientes.listar());
 *
 * `recargar()` vuelve a pedirlos, por ejemplo tras guardar un cambio.
 */
export function useDatos<T>(cargar: (repo: Repositorio) => Promise<T>) {
  const [estado, setEstado] = useState<Estado<T>>({ datos: undefined, error: null, cargando: true });
  const [version, setVersion] = useState(0);

  // La función cambia en cada render (es una arrow function nueva); guardamos
  // la última en un ref para no volver a cargar en cada render.
  const cargarRef = useRef(cargar);
  useEffect(() => {
    cargarRef.current = cargar;
  });

  useEffect(() => {
    let vigente = true; // evita escribir el resultado de una petición antigua
    obtenerRepositorio()
      .then((repo) => cargarRef.current(repo))
      .then(
        (datos) => vigente && setEstado({ datos, error: null, cargando: false }),
        (error) => vigente && setEstado({ datos: undefined, error: mensajeDeError(error), cargando: false }),
      );
    return () => {
      vigente = false;
    };
  }, [version]);

  const recargar = useCallback(() => setVersion((v) => v + 1), []);

  return { ...estado, recargar };
}
