# AcademiApp

Aplicación de gestión académica y cobros para Academia Silvia. Usa React, NestJS y SQL Server.

## Instalación

1. Para una base nueva, ejecuta [database/AcademiApp.sql](database/AcademiApp.sql) en SQL Server. Si ya tienes una base de AcademiApp, selecciónala y continúa con el siguiente paso.
2. Ejecuta [database/01-ampliacion.sql](database/01-ampliacion.sql) en esa base. Puedes volver a aplicar la migración. Agrega planes, ajustes de cobro, recordatorios, sesiones de usuario y bitácora.
3. Copia `backend/.env.example` a `backend/.env`. Configura la conexión y asigna un valor privado a `APP_SETUP_KEY` para crear la primera cuenta. Con LocalDB en Windows, inicia la instancia y asigna a `DB_LOCALDB_PIPE` el canal completo que empieza con `np:` en la salida de `SqlLocalDB info <instancia>`. Pon el canal entre comillas simples para que se lea el signo `#`. Si LocalDB reinicia, consulta el canal de nuevo.
4. Abre una terminal en `backend` y otra en `frontend`.

   | Backend | Frontend |
   | --- | --- |
   | `npm ci` | `npm ci` |
   | `npm run start:dev` | `npm run dev` |

5. Abre la URL que muestra Vite. En **Configurar primer acceso**, ingresa la clave del servidor y crea la cuenta administradora. Si cambias el puerto del backend, define `VITE_API_URL` en el frontend.

## Operación

- En **Cursos** crea el curso y su grupo. En **Horarios y sesiones** agrega los turnos semanales y genera el calendario. Puedes repetir la generación para completar las sesiones faltantes. Los cambios de horario semanal se usan al generar nuevas sesiones. Edita las sesiones ya creadas desde el calendario.
- Inscribe a los estudiantes desde **Inscripciones**. El flujo cobra la matrícula en efectivo y genera las mensualidades según la duración del grupo. En **Cobros** puedes registrar abonos, aplicar descuentos, agregar recargos y conceder prórrogas.
- En **Asistencia** selecciona el grupo y la sesión, marca un estado para cada estudiante y guarda la lista. En **Evaluaciones** registra las notas de los presentes. El expediente del estudiante conserva el historial.
- En **Recordatorios** configura una plantilla y una regla y genera avisos para la fecha elegida. Se guardan para consulta con estado pendiente y pueden cancelarse desde el historial. El prototipo registra los avisos en SQL Server.
- **Usuarios y roles** permite administrar cuentas con los roles ADMIN, PROFESOR y CAJA. La API valida el rol. **Reportes** muestra datos consolidados por curso y **Bitácora** las operaciones de la aplicación.

Ejecuta `npm run build` en ambos proyectos y `npm run lint` en el frontend para verificar la compilación y el código de la interfaz.
