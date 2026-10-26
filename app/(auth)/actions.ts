"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type EstadoFormulario = { error?: string; mensaje?: string } | undefined;

function leerCredenciales(formData: FormData) {
  return {
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
  };
}

export async function iniciarSesion(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const { email, password } = leerCredenciales(formData);
  if (!email || !password) return { error: "Escribe tu correo y contraseña." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Mensaje genérico: no revelamos si el correo existe o no.
    if (error.code === "email_not_confirmed") {
      return { error: "Confirma tu correo antes de entrar. Revisa tu bandeja de entrada." };
    }
    return { error: "Correo o contraseña incorrectos." };
  }

  redirect("/panel");
}

export async function registrarse(
  _estado: EstadoFormulario,
  formData: FormData,
): Promise<EstadoFormulario> {
  const { email, password } = leerCredenciales(formData);
  if (!email || !password) return { error: "Escribe tu correo y contraseña." };
  if (password.length < 8) return { error: "La contraseña debe tener al menos 8 caracteres." };

  const origin = (await headers()).get("origin");
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${origin}/auth/confirm` },
  });

  if (error) return { error: error.message };

  // Con "Confirm email" activado no hay sesión hasta que se confirma el correo.
  if (!data.session) {
    return { mensaje: "Te enviamos un correo para confirmar tu cuenta." };
  }

  redirect("/panel");
}

export async function cerrarSesion() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
