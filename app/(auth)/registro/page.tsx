import { registrarse } from "../actions";
import { FormularioAuth } from "../formulario-auth";

export default function RegistroPage() {
  return (
    <FormularioAuth
      titulo="Crear cuenta"
      descripcion="Empieza a hacer presupuestos para tu negocio."
      textoBoton="Crear cuenta"
      accion={registrarse}
      enlace={{ pregunta: "¿Ya tienes cuenta?", texto: "Entra", href: "/login" }}
    />
  );
}
