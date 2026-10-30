# Tasks: 01 Base

> Tareas 3–9: código listo, pendiente de prueba contra Supabase (ver tarea 10).

- [x] 1. Crear el proyecto
  - Next.js + TypeScript strict + Tailwind 4 + ESLint en `src/`, `.npmrc` con `save-exact=true`
  - Instalar `@supabase/supabase-js`, `@supabase/ssr`, `zod`, `lucide-react`, `server-only`; dev: `vitest`, `supabase`, `tsx`
  - `.env.example` con `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`
  - `npx supabase init`; en `config.toml` desactivar registro público y confirmación de correo, contraseña mínima 8
  - _R: base_

- [x] 2. Tokens visuales y componentes UI base
  - `globals.css` con los tokens de `.kiro/steering/ui.md`, fuentes Hanken Grotesk y JetBrains Mono (`next/font`)
  - `components/ui`: Boton (primario, secundario, peligro), Campo, Modal, Interruptor, Aviso, `formatearPesos()`
  - _R: steering ui_

- [x] 3. Migración de sedes y perfiles
  - Tablas, enums, trigger de creación de perfil, triggers `validar_sede` y `validar_perfil`
  - Funciones `privado.es_admin()`, `privado.sede_actual()`, `privado.usuario_activo()`
  - RLS de ambas tablas
  - _R: R2.3, R4.1, R4.2, R5.4_

- [x] 4. Clientes Supabase y proxy
  - `lib/supabase/{browser,server,admin}.ts` (admin = clave secreta, `server-only`)
  - `src/proxy.ts`: refresco de sesión y redirección optimista por rol
  - Verificación real en layouts de servidor: usuario inactivo y cajero con sede inactiva
  - _R: R1.4, R1.6, R2.1, R2.2_

- [x] 5. Pantalla de login y Salir
  - _R: R1.1, R1.2, R1.3, R1.5_

- [x] 6. Script `crear-admin`
  - `scripts/crear-admin.ts` pide usuario y contraseña por consola y crea el primer admin
  - _R: R5.5_

- [x] 7. Layout admin con selector de sede
  - Inicio con tarjetas de sedes, barra superior con selector, menú lateral
  - _R: R3_

- [x] 8. CRUD de sedes
  - _R: R4.1–R4.4_

- [x] 9. CRUD de usuarios
  - Crear y restablecer contraseña vía Server Action con cliente admin
  - _R: R5.1–R5.3, R5.6_

- [ ] 10. Pruebas — Vitest, typecheck, lint y build OK; falta aplicar la migración y correr pgTAP contra la BD
  - pgTAP de RLS y triggers; Vitest de validaciones
  - `npm run build` y `npm test` sin errores
