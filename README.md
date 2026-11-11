# AcademiApp

## Cómo correr el servidor

Requisitos: Node.js 22, SQL Server LocalDB y ODBC Driver 17 for SQL Server.

1. Crea la base (solo la primera vez):

   ```bash
   sqlcmd -S "(localdb)\MSSQLLocalDB" -E -i database/AcademiaBellezaSilvia.sql
   ```

2. Backend (http://localhost:3000):

   ```bash
   cd backend
   npm ci
   npm run start:dev
   ```

3. Frontend, en otra terminal:

   ```bash
   cd frontend
   npm ci
   npm run dev
   ```

4. Abre la URL que muestra Vite y usa **Configurar primer acceso** con la clave `APP_SETUP_KEY` de `backend/.env` para crear la cuenta administradora.

### Datos de demostración

Para recrear la base con datos ficticios (cursos, grupos, estudiantes, cobros, asistencia, notas, recordatorios y certificados), ejecuta en `backend`:

```bash
npm run db:demo
```

Borra la base y la vuelve a crear desde el script. Al terminar muestra las cuentas de demostración; reinicia el backend si estaba corriendo. Para cargar los datos en una base recién creada y vacía, sin recrearla, usa `npm run db:seed`.
