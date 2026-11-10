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
