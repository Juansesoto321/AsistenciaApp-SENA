/**
 * Requisitos de la contraseña (los mismos que valida el backend) que se van
 * marcando mientras la persona escribe.
 */
export const REGLAS_CONTRASENA = [
  ["Mínimo 8 caracteres", (c) => c.length >= 8],
  ["Una mayúscula", (c) => /[A-Z]/.test(c)],
  ["Una minúscula", (c) => /[a-z]/.test(c)],
  ["Un número", (c) => /\d/.test(c)],
];

export const reglasCumplidas = (c) => REGLAS_CONTRASENA.filter(([, cumple]) => cumple(c)).length;
export const contrasenaValida = (c) => reglasCumplidas(c) === REGLAS_CONTRASENA.length;

export default function ReglasContrasena({ contrasena }) {
  return (
    <ul className="reglas-clave">
      {REGLAS_CONTRASENA.map(([texto, cumple]) => {
        const ok = cumple(contrasena);
        return (
          <li key={texto} className={ok ? "cumple" : undefined}>
            <svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7" /></svg>
            {texto}
            {/* El color y el chulo no los lee el lector de pantalla */}
            <span className="sr-only">{ok ? ": cumplido" : ": pendiente"}</span>
          </li>
        );
      })}
    </ul>
  );
}
