/* =====================================================================
   SISTEMA DE GESTIÓN - ACADEMIA DE BELLEZA SILVIA
   Script de creación de la base de datos (SQL Server 2016 o superior)

   Contenido:
     1. Base de datos y limpieza
     2. Tablas (31) agrupadas por módulo
     3. Índices
     4. Triggers (integridad del plan de estudio y bitácora)
     5. Vistas (estado de cuenta, notificaciones pendientes)
     6. Procedimientos (generar recordatorios de cobro, marcar envío)
     7. Datos iniciales (roles, plantillas y reglas de recordatorio)
   ===================================================================== */

IF DB_ID(N'AcademiaBellezaSilvia') IS NULL
    CREATE DATABASE AcademiaBellezaSilvia;
GO
USE AcademiaBellezaSilvia;
GO
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;   -- requerido por el índice filtrado y FOR JSON
GO

/* ---------------------------------------------------------------------
   1. LIMPIEZA (permite volver a ejecutar el script)
   --------------------------------------------------------------------- */
DROP PROCEDURE IF EXISTS sp_marcar_notificacion;
DROP PROCEDURE IF EXISTS sp_generar_recordatorios;
DROP VIEW IF EXISTS vw_notificaciones_pendientes;
DROP VIEW IF EXISTS vw_estado_cuenta;
DROP TABLE IF EXISTS BITACORA;
DROP TABLE IF EXISTS USUARIO_ROL;
DROP TABLE IF EXISTS ROL;
DROP TABLE IF EXISTS USUARIO;
DROP TABLE IF EXISTS NOTIFICACION;
DROP TABLE IF EXISTS REGLA_RECORDATORIO;
DROP TABLE IF EXISTS PLANTILLA_NOTIFICACION;
DROP TABLE IF EXISTS INSCRIPCION_DESCUENTO;
DROP TABLE IF EXISTS DESCUENTO;
DROP TABLE IF EXISTS RECARGO;
DROP TABLE IF EXISTS PRORROGA;
DROP TABLE IF EXISTS PAGO;
DROP TABLE IF EXISTS OBLIGACION_PAGO;
DROP TABLE IF EXISTS CERTIFICADO;
DROP TABLE IF EXISTS RESULTADO_EVALUACION;
DROP TABLE IF EXISTS EVALUACION;
DROP TABLE IF EXISTS ASISTENCIA;
DROP TABLE IF EXISTS INSCRIPCION;
DROP TABLE IF EXISTS ESTUDIANTE;
DROP TABLE IF EXISTS ASIGNACION_PROFESOR;
DROP TABLE IF EXISTS PROFESOR_ESPECIALIDAD;
DROP TABLE IF EXISTS ESPECIALIDAD;
DROP TABLE IF EXISTS PROFESOR;
DROP TABLE IF EXISTS PROGRAMACION_CONTENIDO;
DROP TABLE IF EXISTS SESION_CLASE;
DROP TABLE IF EXISTS HORARIO_CLASE;
DROP TABLE IF EXISTS GRUPO;
DROP TABLE IF EXISTS TEMA_ESTUDIO;
DROP TABLE IF EXISTS UNIDAD_ESTUDIO;
DROP TABLE IF EXISTS PLAN_ESTUDIO;
DROP TABLE IF EXISTS CURSO;
GO

/* ---------------------------------------------------------------------
   2. TABLAS
   --------------------------------------------------------------------- */

-- =====================================================================
-- MÓDULO ACADÉMICO: cursos, plan de estudio, grupos y sesiones
-- =====================================================================

CREATE TABLE CURSO (
    id_curso                   INT IDENTITY(1,1) NOT NULL,
    nombre                     NVARCHAR(100) NOT NULL,
    descripcion                NVARCHAR(500) NULL,
    precio_total               DECIMAL(10,2) NOT NULL,
    precio_matricula           DECIMAL(10,2) NOT NULL,
    estado                     VARCHAR(20) NOT NULL
        CONSTRAINT DF_CURSO_estado DEFAULT 'ACTIVO',
    CONSTRAINT PK_CURSO PRIMARY KEY (id_curso),
    CONSTRAINT CK_CURSO_precio_total CHECK (precio_total >= 0),
    CONSTRAINT CK_CURSO_precio_matricula CHECK (precio_matricula >= 0),
    CONSTRAINT CK_CURSO_estado CHECK (estado IN ('ACTIVO', 'INACTIVO'))
);
GO

CREATE TABLE PLAN_ESTUDIO (  -- NUEVA
    id_plan                    INT IDENTITY(1,1) NOT NULL,
    id_curso                   INT NOT NULL,
    nombre                     NVARCHAR(150) NOT NULL,
    descripcion                NVARCHAR(500) NULL,
    version                    SMALLINT NOT NULL
        CONSTRAINT DF_PLAN_ESTUDIO_version DEFAULT 1,
    estado                     VARCHAR(20) NOT NULL
        CONSTRAINT DF_PLAN_ESTUDIO_estado DEFAULT 'ACTIVO',
    CONSTRAINT PK_PLAN_ESTUDIO PRIMARY KEY (id_plan),
    CONSTRAINT FK_PLAN_ESTUDIO_CURSO FOREIGN KEY (id_curso) REFERENCES CURSO(id_curso),
    CONSTRAINT UQ_PLAN_ESTUDIO_id_curso_version UNIQUE (id_curso, version),
    CONSTRAINT CK_PLAN_ESTUDIO_version CHECK (version > 0),
    CONSTRAINT CK_PLAN_ESTUDIO_estado CHECK (estado IN ('ACTIVO', 'INACTIVO'))
);
GO

CREATE TABLE UNIDAD_ESTUDIO (  -- NUEVA
    id_unidad                  INT IDENTITY(1,1) NOT NULL,
    id_plan                    INT NOT NULL,
    nombre                     NVARCHAR(150) NOT NULL,
    descripcion                NVARCHAR(500) NULL,
    orden                      SMALLINT NOT NULL,
    CONSTRAINT PK_UNIDAD_ESTUDIO PRIMARY KEY (id_unidad),
    CONSTRAINT FK_UNIDAD_ESTUDIO_PLAN_ESTUDIO FOREIGN KEY (id_plan) REFERENCES PLAN_ESTUDIO(id_plan),
    CONSTRAINT UQ_UNIDAD_ESTUDIO_id_plan_orden UNIQUE (id_plan, orden),
    CONSTRAINT CK_UNIDAD_ESTUDIO_orden CHECK (orden > 0)
);
GO

CREATE TABLE TEMA_ESTUDIO (  -- NUEVA
    id_tema                    INT IDENTITY(1,1) NOT NULL,
    id_unidad                  INT NOT NULL,
    nombre                     NVARCHAR(150) NOT NULL,
    descripcion                NVARCHAR(500) NULL,
    orden                      SMALLINT NOT NULL,
    modalidad                  VARCHAR(15) NOT NULL,
    horas_estimadas            DECIMAL(5,2) NULL,
    CONSTRAINT PK_TEMA_ESTUDIO PRIMARY KEY (id_tema),
    CONSTRAINT FK_TEMA_ESTUDIO_UNIDAD_ESTUDIO FOREIGN KEY (id_unidad) REFERENCES UNIDAD_ESTUDIO(id_unidad),
    CONSTRAINT UQ_TEMA_ESTUDIO_id_unidad_orden UNIQUE (id_unidad, orden),
    CONSTRAINT CK_TEMA_ESTUDIO_orden CHECK (orden > 0),
    CONSTRAINT CK_TEMA_ESTUDIO_modalidad CHECK (modalidad IN ('TEORICO', 'PRACTICO', 'DEMOSTRACION')),
    CONSTRAINT CK_TEMA_ESTUDIO_horas_estimadas CHECK (horas_estimadas > 0)
);
GO

-- fecha_fin = fecha REAL de cierre (NULL mientras el grupo está en curso).
-- La fecha estimada se calcula: DATEADD(MONTH, duracion_meses, fecha_inicio).
-- El curso se obtiene a través del plan (GRUPO -> PLAN_ESTUDIO -> CURSO).
CREATE TABLE GRUPO (
    id_grupo                   INT IDENTITY(1,1) NOT NULL,
    id_plan                    INT NOT NULL,
    nombre                     NVARCHAR(100) NOT NULL,
    fecha_inicio               DATE NOT NULL,
    duracion_meses             TINYINT NOT NULL,
    fecha_fin                  DATE NULL,
    estado                     VARCHAR(20) NOT NULL
        CONSTRAINT DF_GRUPO_estado DEFAULT 'EN_CURSO',
    CONSTRAINT PK_GRUPO PRIMARY KEY (id_grupo),
    CONSTRAINT FK_GRUPO_PLAN_ESTUDIO FOREIGN KEY (id_plan) REFERENCES PLAN_ESTUDIO(id_plan),
    CONSTRAINT CK_GRUPO_duracion_meses CHECK (duracion_meses > 0),
    CONSTRAINT CK_GRUPO_estado CHECK (estado IN ('EN_CURSO', 'FINALIZADO', 'CANCELADO')),
    CONSTRAINT CK_GRUPO_regla1 CHECK (fecha_fin IS NULL OR fecha_fin >= fecha_inicio)
);
GO

CREATE TABLE HORARIO_CLASE (
    id_horario                 INT IDENTITY(1,1) NOT NULL,
    id_grupo                   INT NOT NULL,
    dia_semana                 VARCHAR(10) NOT NULL,
    hora_inicio                TIME(0) NOT NULL,
    hora_finalizacion          TIME(0) NOT NULL,
    CONSTRAINT PK_HORARIO_CLASE PRIMARY KEY (id_horario),
    CONSTRAINT FK_HORARIO_CLASE_GRUPO FOREIGN KEY (id_grupo) REFERENCES GRUPO(id_grupo),
    CONSTRAINT CK_HORARIO_CLASE_dia_semana CHECK (dia_semana IN ('LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO')),
    CONSTRAINT CK_HORARIO_CLASE_regla1 CHECK (hora_finalizacion > hora_inicio)
);
GO

CREATE TABLE SESION_CLASE (
    id_sesion                  INT IDENTITY(1,1) NOT NULL,
    id_grupo                   INT NOT NULL,
    fecha_programada           DATE NOT NULL,
    hora_inicio                TIME(0) NOT NULL,
    hora_finalizacion          TIME(0) NOT NULL,
    tipo_sesion                VARCHAR(10) NOT NULL,
    estado                     VARCHAR(20) NOT NULL
        CONSTRAINT DF_SESION_CLASE_estado DEFAULT 'PROGRAMADA',
    observacion                NVARCHAR(500) NULL,
    CONSTRAINT PK_SESION_CLASE PRIMARY KEY (id_sesion),
    CONSTRAINT FK_SESION_CLASE_GRUPO FOREIGN KEY (id_grupo) REFERENCES GRUPO(id_grupo),
    CONSTRAINT CK_SESION_CLASE_tipo_sesion CHECK (tipo_sesion IN ('TEORICA', 'PRACTICA', 'REPASO')),
    CONSTRAINT CK_SESION_CLASE_estado CHECK (estado IN ('PROGRAMADA', 'REALIZADA', 'CANCELADA')),
    CONSTRAINT CK_SESION_CLASE_regla1 CHECK (hora_finalizacion > hora_inicio)
);
GO

CREATE TABLE PROGRAMACION_CONTENIDO (  -- NUEVA
    id_programacion            INT IDENTITY(1,1) NOT NULL,
    id_sesion                  INT NOT NULL,
    id_tema                    INT NOT NULL,
    estado_cumplimiento        VARCHAR(10) NOT NULL
        CONSTRAINT DF_PROGRAMACION_CONTENIDO_estado_cumplimiento DEFAULT 'PENDIENTE',
    observacion                NVARCHAR(500) NULL,
    CONSTRAINT PK_PROGRAMACION_CONTENIDO PRIMARY KEY (id_programacion),
    CONSTRAINT FK_PROGRAMACION_CONTENIDO_SESION_CLASE FOREIGN KEY (id_sesion) REFERENCES SESION_CLASE(id_sesion),
    CONSTRAINT FK_PROGRAMACION_CONTENIDO_TEMA_ESTUDIO FOREIGN KEY (id_tema) REFERENCES TEMA_ESTUDIO(id_tema),
    CONSTRAINT UQ_PROGRAMACION_CONTENIDO_id_sesion_id_tema UNIQUE (id_sesion, id_tema),
    CONSTRAINT CK_PROGRAMACION_CONTENIDO_estado_cumplimiento CHECK (estado_cumplimiento IN ('PENDIENTE', 'PARCIAL', 'CUBIERTO'))
);
GO


-- =====================================================================
-- MÓDULO DOCENTES
-- =====================================================================

CREATE TABLE PROFESOR (
    id_profesor                INT IDENTITY(1,1) NOT NULL,
    nombres                    NVARCHAR(100) NOT NULL,
    apellidos                  NVARCHAR(100) NOT NULL,
    telefono                   VARCHAR(20) NULL,
    estado                     VARCHAR(20) NOT NULL
        CONSTRAINT DF_PROFESOR_estado DEFAULT 'ACTIVO',
    CONSTRAINT PK_PROFESOR PRIMARY KEY (id_profesor),
    CONSTRAINT CK_PROFESOR_estado CHECK (estado IN ('ACTIVO', 'INACTIVO'))
);
GO

CREATE TABLE ESPECIALIDAD (
    id_especialidad            INT IDENTITY(1,1) NOT NULL,
    nombre                     NVARCHAR(100) NOT NULL,
    CONSTRAINT PK_ESPECIALIDAD PRIMARY KEY (id_especialidad),
    CONSTRAINT UQ_ESPECIALIDAD_nombre UNIQUE (nombre)
);
GO

CREATE TABLE PROFESOR_ESPECIALIDAD (
    id_profesor                INT NOT NULL,
    id_especialidad            INT NOT NULL,
    CONSTRAINT PK_PROFESOR_ESPECIALIDAD PRIMARY KEY (id_profesor, id_especialidad),
    CONSTRAINT FK_PROFESOR_ESPECIALIDAD_PROFESOR FOREIGN KEY (id_profesor) REFERENCES PROFESOR(id_profesor),
    CONSTRAINT FK_PROFESOR_ESPECIALIDAD_ESPECIALIDAD FOREIGN KEY (id_especialidad) REFERENCES ESPECIALIDAD(id_especialidad)
);
GO

CREATE TABLE ASIGNACION_PROFESOR (
    id_asignacion              INT IDENTITY(1,1) NOT NULL,
    id_profesor                INT NOT NULL,
    id_grupo                   INT NOT NULL,
    fecha_asignacion           DATE NOT NULL
        CONSTRAINT DF_ASIGNACION_PROFESOR_fecha_asignacion DEFAULT CAST(GETDATE() AS DATE),
    CONSTRAINT PK_ASIGNACION_PROFESOR PRIMARY KEY (id_asignacion),
    CONSTRAINT FK_ASIGNACION_PROFESOR_PROFESOR FOREIGN KEY (id_profesor) REFERENCES PROFESOR(id_profesor),
    CONSTRAINT FK_ASIGNACION_PROFESOR_GRUPO FOREIGN KEY (id_grupo) REFERENCES GRUPO(id_grupo)
);
GO


-- =====================================================================
-- MÓDULO ESTUDIANTES: inscripción, asistencia, evaluación y certificado
-- =====================================================================

CREATE TABLE ESTUDIANTE (
    id_estudiante              INT IDENTITY(1,1) NOT NULL,
    codigo                     VARCHAR(20) NOT NULL,
    nombres                    NVARCHAR(100) NOT NULL,
    apellidos                  NVARCHAR(100) NOT NULL,
    fecha_nacimiento           DATE NULL,
    telefono                   VARCHAR(20) NULL,
    email                      NVARCHAR(150) NULL,
    canal_preferido            VARCHAR(10) NOT NULL
        CONSTRAINT DF_ESTUDIANTE_canal_preferido DEFAULT 'WHATSAPP',
    fecha_registro             DATE NOT NULL
        CONSTRAINT DF_ESTUDIANTE_fecha_registro DEFAULT CAST(GETDATE() AS DATE),
    estado                     VARCHAR(20) NOT NULL
        CONSTRAINT DF_ESTUDIANTE_estado DEFAULT 'ACTIVO',
    CONSTRAINT PK_ESTUDIANTE PRIMARY KEY (id_estudiante),
    CONSTRAINT UQ_ESTUDIANTE_codigo UNIQUE (codigo),
    CONSTRAINT CK_ESTUDIANTE_canal_preferido CHECK (canal_preferido IN ('EMAIL', 'WHATSAPP', 'SMS')),
    CONSTRAINT CK_ESTUDIANTE_estado CHECK (estado IN ('ACTIVO', 'INACTIVO'))
);
GO

CREATE TABLE INSCRIPCION (
    id_inscripcion             INT IDENTITY(1,1) NOT NULL,
    id_estudiante              INT NOT NULL,
    id_grupo                   INT NOT NULL,
    fecha_inscripcion          DATE NOT NULL
        CONSTRAINT DF_INSCRIPCION_fecha_inscripcion DEFAULT CAST(GETDATE() AS DATE),
    estado                     VARCHAR(20) NOT NULL
        CONSTRAINT DF_INSCRIPCION_estado DEFAULT 'ACTIVA',
    observacion                NVARCHAR(500) NULL,
    CONSTRAINT PK_INSCRIPCION PRIMARY KEY (id_inscripcion),
    CONSTRAINT FK_INSCRIPCION_ESTUDIANTE FOREIGN KEY (id_estudiante) REFERENCES ESTUDIANTE(id_estudiante),
    CONSTRAINT FK_INSCRIPCION_GRUPO FOREIGN KEY (id_grupo) REFERENCES GRUPO(id_grupo),
    CONSTRAINT UQ_INSCRIPCION_id_estudiante_id_grupo UNIQUE (id_estudiante, id_grupo),
    CONSTRAINT CK_INSCRIPCION_estado CHECK (estado IN ('ACTIVA', 'CANCELADA', 'FINALIZADA'))
);
GO

CREATE TABLE ASISTENCIA (
    id_asistencia              INT IDENTITY(1,1) NOT NULL,
    id_inscripcion             INT NOT NULL,
    id_sesion                  INT NOT NULL,
    estado_asistencia          VARCHAR(20) NOT NULL,
    observacion                NVARCHAR(500) NULL,
    CONSTRAINT PK_ASISTENCIA PRIMARY KEY (id_asistencia),
    CONSTRAINT FK_ASISTENCIA_INSCRIPCION FOREIGN KEY (id_inscripcion) REFERENCES INSCRIPCION(id_inscripcion),
    CONSTRAINT FK_ASISTENCIA_SESION_CLASE FOREIGN KEY (id_sesion) REFERENCES SESION_CLASE(id_sesion),
    CONSTRAINT UQ_ASISTENCIA_id_inscripcion_id_sesion UNIQUE (id_inscripcion, id_sesion),
    CONSTRAINT CK_ASISTENCIA_estado_asistencia CHECK (estado_asistencia IN ('PRESENTE', 'AUSENTE', 'SUSPENDIDO_POR_MORA', 'JUSTIFICADA'))
);
GO

CREATE TABLE EVALUACION (
    id_evaluacion              INT IDENTITY(1,1) NOT NULL,
    id_sesion                  INT NOT NULL,
    tipo                       VARCHAR(10) NOT NULL,
    descripcion                NVARCHAR(500) NULL,
    CONSTRAINT PK_EVALUACION PRIMARY KEY (id_evaluacion),
    CONSTRAINT FK_EVALUACION_SESION_CLASE FOREIGN KEY (id_sesion) REFERENCES SESION_CLASE(id_sesion),
    CONSTRAINT CK_EVALUACION_tipo CHECK (tipo IN ('EXAMEN', 'TAREA', 'PROYECTO'))
);
GO

CREATE TABLE RESULTADO_EVALUACION (
    id_resultado               INT IDENTITY(1,1) NOT NULL,
    id_evaluacion              INT NOT NULL,
    id_inscripcion             INT NOT NULL,
    nota                       DECIMAL(5,2) NULL,
    estado_resultado           VARCHAR(15) NOT NULL,
    CONSTRAINT PK_RESULTADO_EVALUACION PRIMARY KEY (id_resultado),
    CONSTRAINT FK_RESULTADO_EVALUACION_EVALUACION FOREIGN KEY (id_evaluacion) REFERENCES EVALUACION(id_evaluacion),
    CONSTRAINT FK_RESULTADO_EVALUACION_INSCRIPCION FOREIGN KEY (id_inscripcion) REFERENCES INSCRIPCION(id_inscripcion),
    CONSTRAINT UQ_RESULTADO_EVALUACION_id_evaluacion_id_inscripcion UNIQUE (id_evaluacion, id_inscripcion),
    CONSTRAINT CK_RESULTADO_EVALUACION_nota CHECK (nota BETWEEN 0 AND 100),
    CONSTRAINT CK_RESULTADO_EVALUACION_estado_resultado CHECK (estado_resultado IN ('CALIFICADO', 'NO_SE_PRESENTO'))
);
GO

CREATE TABLE CERTIFICADO (
    id_certificado             INT IDENTITY(1,1) NOT NULL,
    id_inscripcion             INT NOT NULL,
    codigo                     VARCHAR(30) NOT NULL,
    fecha_emision              DATE NOT NULL
        CONSTRAINT DF_CERTIFICADO_fecha_emision DEFAULT CAST(GETDATE() AS DATE),
    estado                     VARCHAR(10) NOT NULL
        CONSTRAINT DF_CERTIFICADO_estado DEFAULT 'EMITIDO',
    CONSTRAINT PK_CERTIFICADO PRIMARY KEY (id_certificado),
    CONSTRAINT FK_CERTIFICADO_INSCRIPCION FOREIGN KEY (id_inscripcion) REFERENCES INSCRIPCION(id_inscripcion),
    CONSTRAINT UQ_CERTIFICADO_id_inscripcion UNIQUE (id_inscripcion),
    CONSTRAINT UQ_CERTIFICADO_codigo UNIQUE (codigo),
    CONSTRAINT CK_CERTIFICADO_estado CHECK (estado IN ('EMITIDO', 'ANULADO'))
);
GO


-- =====================================================================
-- MÓDULO PAGOS: obligaciones, pagos, prórrogas, recargos y descuentos
-- =====================================================================

CREATE TABLE OBLIGACION_PAGO (
    id_obligacion              INT IDENTITY(1,1) NOT NULL,
    id_inscripcion             INT NOT NULL,
    tipo                       VARCHAR(15) NOT NULL,
    numero_cuota               TINYINT NULL,
    periodo                    CHAR(7) NULL,
    fecha_vencimiento          DATE NOT NULL,
    monto                      DECIMAL(10,2) NOT NULL,
    estado                     VARCHAR(10) NOT NULL
        CONSTRAINT DF_OBLIGACION_PAGO_estado DEFAULT 'PENDIENTE',
    CONSTRAINT PK_OBLIGACION_PAGO PRIMARY KEY (id_obligacion),
    CONSTRAINT FK_OBLIGACION_PAGO_INSCRIPCION FOREIGN KEY (id_inscripcion) REFERENCES INSCRIPCION(id_inscripcion),
    CONSTRAINT CK_OBLIGACION_PAGO_tipo CHECK (tipo IN ('MATRICULA', 'MENSUALIDAD')),
    CONSTRAINT CK_OBLIGACION_PAGO_monto CHECK (monto >= 0),
    CONSTRAINT CK_OBLIGACION_PAGO_estado CHECK (estado IN ('PENDIENTE', 'PAGADA', 'ANULADA'))
);
GO

CREATE TABLE PAGO (
    id_pago                    INT IDENTITY(1,1) NOT NULL,
    id_obligacion              INT NOT NULL,
    fecha_pago                 DATETIME2(0) NOT NULL
        CONSTRAINT DF_PAGO_fecha_pago DEFAULT SYSDATETIME(),
    monto_pagado               DECIMAL(10,2) NOT NULL,
    metodo_pago                VARCHAR(15) NOT NULL,
    observacion                NVARCHAR(500) NULL,
    CONSTRAINT PK_PAGO PRIMARY KEY (id_pago),
    CONSTRAINT FK_PAGO_OBLIGACION_PAGO FOREIGN KEY (id_obligacion) REFERENCES OBLIGACION_PAGO(id_obligacion),
    CONSTRAINT CK_PAGO_monto_pagado CHECK (monto_pagado > 0),
    CONSTRAINT CK_PAGO_metodo_pago CHECK (metodo_pago IN ('EFECTIVO', 'TRANSFERENCIA', 'TARJETA'))
);
GO

CREATE TABLE PRORROGA (
    id_prorroga                INT IDENTITY(1,1) NOT NULL,
    id_obligacion              INT NOT NULL,
    fecha_inicio               DATE NOT NULL,
    fecha_finalizacion         DATE NOT NULL,
    observacion                NVARCHAR(500) NULL,
    CONSTRAINT PK_PRORROGA PRIMARY KEY (id_prorroga),
    CONSTRAINT FK_PRORROGA_OBLIGACION_PAGO FOREIGN KEY (id_obligacion) REFERENCES OBLIGACION_PAGO(id_obligacion),
    CONSTRAINT CK_PRORROGA_regla1 CHECK (fecha_finalizacion >= fecha_inicio)
);
GO

CREATE TABLE RECARGO (  -- NUEVA
    id_recargo                 INT IDENTITY(1,1) NOT NULL,
    id_obligacion              INT NOT NULL,
    monto                      DECIMAL(10,2) NOT NULL,
    motivo                     NVARCHAR(200) NOT NULL,
    fecha_generacion           DATE NOT NULL
        CONSTRAINT DF_RECARGO_fecha_generacion DEFAULT CAST(GETDATE() AS DATE),
    CONSTRAINT PK_RECARGO PRIMARY KEY (id_recargo),
    CONSTRAINT FK_RECARGO_OBLIGACION_PAGO FOREIGN KEY (id_obligacion) REFERENCES OBLIGACION_PAGO(id_obligacion),
    CONSTRAINT CK_RECARGO_monto CHECK (monto > 0)
);
GO

CREATE TABLE DESCUENTO (  -- NUEVA
    id_descuento               INT IDENTITY(1,1) NOT NULL,
    nombre                     NVARCHAR(100) NOT NULL,
    tipo                       VARCHAR(12) NOT NULL,
    valor                      DECIMAL(10,2) NOT NULL,    
    estado                     VARCHAR(20) NOT NULL
        CONSTRAINT DF_DESCUENTO_estado DEFAULT 'ACTIVO',
    CONSTRAINT PK_DESCUENTO PRIMARY KEY (id_descuento),
    CONSTRAINT CK_DESCUENTO_tipo CHECK (tipo IN ('PORCENTAJE', 'MONTO_FIJO')),
    CONSTRAINT CK_DESCUENTO_valor CHECK (valor > 0),
    CONSTRAINT CK_DESCUENTO_estado CHECK (estado IN ('ACTIVO', 'INACTIVO')),
    CONSTRAINT CK_DESCUENTO_regla1 CHECK (tipo <> 'PORCENTAJE' OR valor <= 100),    
);
GO

CREATE TABLE OBLIGACION_DESCUENTO (
    id_obligacion              INT NOT NULL,
    id_descuento               INT NOT NULL,
    tipo_aplicado              VARCHAR(12) NOT NULL,
    valor_aplicado             DECIMAL(10,2) NOT NULL,
    fecha_aplicacion           DATE NOT NULL
        CONSTRAINT DF_OBLIGACION_DESCUENTO_fecha_aplicacion
        DEFAULT CAST(GETDATE() AS DATE),
    observacion                NVARCHAR(500) NULL,

    CONSTRAINT PK_OBLIGACION_DESCUENTO
        PRIMARY KEY (id_obligacion, id_descuento),

    CONSTRAINT FK_OBLIGACION_DESCUENTO_OBLIGACION
        FOREIGN KEY (id_obligacion)
        REFERENCES OBLIGACION_PAGO(id_obligacion),

    CONSTRAINT FK_OBLIGACION_DESCUENTO_DESCUENTO
        FOREIGN KEY (id_descuento)
        REFERENCES DESCUENTO(id_descuento),

    CONSTRAINT CK_OBLIGACION_DESCUENTO_tipo
        CHECK (tipo_aplicado IN ('PORCENTAJE', 'MONTO_FIJO')),

    CONSTRAINT CK_OBLIGACION_DESCUENTO_valor
        CHECK (valor_aplicado > 0),

    CONSTRAINT CK_OBLIGACION_DESCUENTO_porcentaje
        CHECK (tipo_aplicado <> 'PORCENTAJE' OR valor_aplicado <= 100)
);
GO


-- =====================================================================
-- MÓDULO NOTIFICACIONES: recordatorios de cobro por email / WhatsApp / SMS
-- =====================================================================

CREATE TABLE PLANTILLA_NOTIFICACION (  -- NUEVA
    id_plantilla               INT IDENTITY(1,1) NOT NULL,
    nombre                     NVARCHAR(100) NOT NULL,
    canal                      VARCHAR(10) NOT NULL,
    asunto                     NVARCHAR(150) NULL,
    cuerpo                     NVARCHAR(MAX) NOT NULL,
    estado                     VARCHAR(20) NOT NULL
        CONSTRAINT DF_PLANTILLA_NOTIFICACION_estado DEFAULT 'ACTIVO',
    CONSTRAINT PK_PLANTILLA_NOTIFICACION PRIMARY KEY (id_plantilla),
    CONSTRAINT UQ_PLANTILLA_NOTIFICACION_nombre UNIQUE (nombre),
    CONSTRAINT CK_PLANTILLA_NOTIFICACION_canal CHECK (canal IN ('EMAIL', 'WHATSAPP', 'SMS')),
    CONSTRAINT CK_PLANTILLA_NOTIFICACION_estado CHECK (estado IN ('ACTIVO', 'INACTIVO'))
);
GO

CREATE TABLE REGLA_RECORDATORIO (  -- NUEVA
    id_regla                   INT IDENTITY(1,1) NOT NULL,
    id_plantilla               INT NOT NULL,
    dias_respecto_vencimiento  SMALLINT NOT NULL,
    estado                     VARCHAR(20) NOT NULL
        CONSTRAINT DF_REGLA_RECORDATORIO_estado DEFAULT 'ACTIVO',
    CONSTRAINT PK_REGLA_RECORDATORIO PRIMARY KEY (id_regla),
    CONSTRAINT FK_REGLA_RECORDATORIO_PLANTILLA_NOTIFICACION FOREIGN KEY (id_plantilla) REFERENCES PLANTILLA_NOTIFICACION(id_plantilla),
    CONSTRAINT UQ_REGLA_RECORDATORIO_id_plantilla_dias_respecto_vencimiento UNIQUE (id_plantilla, dias_respecto_vencimiento),
    CONSTRAINT CK_REGLA_RECORDATORIO_estado CHECK (estado IN ('ACTIVO', 'INACTIVO'))
);
GO

-- El canal lo define la plantilla; destino guarda el email/teléfono usado en el envío.
CREATE TABLE NOTIFICACION (  -- NUEVA
    id_notificacion            INT IDENTITY(1,1) NOT NULL,
    id_estudiante              INT NOT NULL,
    id_plantilla               INT NOT NULL,
    id_obligacion              INT NULL,
    destino                    NVARCHAR(150) NOT NULL,
    fecha_programada           DATETIME2(0) NOT NULL
        CONSTRAINT DF_NOTIFICACION_fecha_programada DEFAULT SYSDATETIME(),
    fecha_envio                DATETIME2(0) NULL,
    estado_envio               VARCHAR(10) NOT NULL
        CONSTRAINT DF_NOTIFICACION_estado_envio DEFAULT 'PENDIENTE',
    intentos                   TINYINT NOT NULL
        CONSTRAINT DF_NOTIFICACION_intentos DEFAULT 0,
    error                      NVARCHAR(500) NULL,
    CONSTRAINT PK_NOTIFICACION PRIMARY KEY (id_notificacion),
    CONSTRAINT FK_NOTIFICACION_ESTUDIANTE FOREIGN KEY (id_estudiante) REFERENCES ESTUDIANTE(id_estudiante),
    CONSTRAINT FK_NOTIFICACION_PLANTILLA_NOTIFICACION FOREIGN KEY (id_plantilla) REFERENCES PLANTILLA_NOTIFICACION(id_plantilla),
    CONSTRAINT FK_NOTIFICACION_OBLIGACION_PAGO FOREIGN KEY (id_obligacion) REFERENCES OBLIGACION_PAGO(id_obligacion),
    CONSTRAINT CK_NOTIFICACION_estado_envio CHECK (estado_envio IN ('PENDIENTE', 'ENVIADO', 'FALLIDO', 'CANCELADO'))
);
GO


-- =====================================================================
-- MÓDULO SEGURIDAD: usuarios, roles y bitácora
-- =====================================================================

CREATE TABLE USUARIO (  -- NUEVA
    id_usuario                 INT IDENTITY(1,1) NOT NULL,
    id_profesor                INT NULL,
    usuario                    VARCHAR(50) NOT NULL,
    contrasena_hash            NVARCHAR(255) NOT NULL,
    email                      NVARCHAR(150) NULL,
    ultimo_acceso              DATETIME2(0) NULL,
    estado                     VARCHAR(20) NOT NULL
        CONSTRAINT DF_USUARIO_estado DEFAULT 'ACTIVO',
    CONSTRAINT PK_USUARIO PRIMARY KEY (id_usuario),
    CONSTRAINT FK_USUARIO_PROFESOR FOREIGN KEY (id_profesor) REFERENCES PROFESOR(id_profesor),
    CONSTRAINT UQ_USUARIO_usuario UNIQUE (usuario),
    CONSTRAINT CK_USUARIO_estado CHECK (estado IN ('ACTIVO', 'INACTIVO'))
);
GO

CREATE TABLE ROL (  -- NUEVA
    id_rol                     INT IDENTITY(1,1) NOT NULL,
    nombre                     VARCHAR(30) NOT NULL,
    descripcion                NVARCHAR(200) NULL,
    CONSTRAINT PK_ROL PRIMARY KEY (id_rol),
    CONSTRAINT UQ_ROL_nombre UNIQUE (nombre)
);
GO

CREATE TABLE USUARIO_ROL (  -- NUEVA
    id_usuario                 INT NOT NULL,
    id_rol                     INT NOT NULL,
    CONSTRAINT PK_USUARIO_ROL PRIMARY KEY (id_usuario, id_rol),
    CONSTRAINT FK_USUARIO_ROL_USUARIO FOREIGN KEY (id_usuario) REFERENCES USUARIO(id_usuario),
    CONSTRAINT FK_USUARIO_ROL_ROL FOREIGN KEY (id_rol) REFERENCES ROL(id_rol)
);
GO

-- id_usuario se toma de SESSION_CONTEXT(N'id_usuario'), que la aplicación fija al iniciar sesión:
--   EXEC sp_set_session_context @key = N'id_usuario', @value = 1;
CREATE TABLE BITACORA (  -- NUEVA
    id_bitacora                BIGINT IDENTITY(1,1) NOT NULL,
    id_usuario                 INT NULL,
    tabla                      VARCHAR(50) NOT NULL,
    id_registro                INT NULL,
    accion                     VARCHAR(10) NOT NULL,
    fecha                      DATETIME2(0) NOT NULL
        CONSTRAINT DF_BITACORA_fecha DEFAULT SYSDATETIME(),
    detalle                    NVARCHAR(MAX) NULL,
    CONSTRAINT PK_BITACORA PRIMARY KEY (id_bitacora),
    CONSTRAINT FK_BITACORA_USUARIO FOREIGN KEY (id_usuario) REFERENCES USUARIO(id_usuario),
    CONSTRAINT CK_BITACORA_accion CHECK (accion IN ('INSERT', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT'))
);
GO


/* ---------------------------------------------------------------------
   3. ÍNDICES
   --------------------------------------------------------------------- */
-- Un profesor puede tener como máximo un usuario (UNIQUE que admite varios NULL)
CREATE UNIQUE INDEX UX_USUARIO_id_profesor ON USUARIO(id_profesor) WHERE id_profesor IS NOT NULL;
CREATE INDEX IX_GRUPO_id_plan              ON GRUPO(id_plan);
CREATE INDEX IX_SESION_CLASE_id_grupo      ON SESION_CLASE(id_grupo, fecha_programada);
CREATE INDEX IX_INSCRIPCION_id_grupo       ON INSCRIPCION(id_grupo);
CREATE INDEX IX_OBLIGACION_PAGO_venc       ON OBLIGACION_PAGO(estado, fecha_vencimiento);
CREATE INDEX IX_OBLIGACION_PAGO_inscr      ON OBLIGACION_PAGO(id_inscripcion);
CREATE INDEX IX_PAGO_id_obligacion         ON PAGO(id_obligacion);
CREATE INDEX IX_PRORROGA_id_obligacion     ON PRORROGA(id_obligacion);
CREATE INDEX IX_RECARGO_id_obligacion      ON RECARGO(id_obligacion);
CREATE INDEX IX_NOTIFICACION_pendientes    ON NOTIFICACION(estado_envio, fecha_programada);
CREATE INDEX IX_NOTIFICACION_obligacion    ON NOTIFICACION(id_obligacion);
CREATE INDEX IX_BITACORA_tabla_registro    ON BITACORA(tabla, id_registro);
GO

/* ---------------------------------------------------------------------
   4. TRIGGERS
   --------------------------------------------------------------------- */
-- El tema programado en una sesión debe pertenecer al plan de estudio del grupo
CREATE OR ALTER TRIGGER TR_PROGRAMACION_CONTENIDO_ValidarPlan ON PROGRAMACION_CONTENIDO
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;
    IF EXISTS (
        SELECT 1
        FROM inserted i
        JOIN SESION_CLASE   s ON s.id_sesion = i.id_sesion
        JOIN GRUPO          g ON g.id_grupo  = s.id_grupo
        JOIN TEMA_ESTUDIO   t ON t.id_tema   = i.id_tema
        JOIN UNIDAD_ESTUDIO u ON u.id_unidad = t.id_unidad
        WHERE u.id_plan <> g.id_plan
    )
    BEGIN
        ROLLBACK TRANSACTION;
        THROW 50001, N'El tema no pertenece al plan de estudio del grupo de la sesión.', 1;
    END
END;
GO

-- Bitácora automática de las tablas sensibles (pagos, notas, certificados)
CREATE OR ALTER TRIGGER TR_PAGO_Bitacora ON PAGO
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @id_usuario INT = TRY_CAST(SESSION_CONTEXT(N'id_usuario') AS INT);
    INSERT INTO BITACORA (id_usuario, tabla, id_registro, accion, detalle)
    SELECT @id_usuario, 'PAGO', i.id_pago,
           CASE WHEN EXISTS (SELECT 1 FROM deleted) THEN 'UPDATE' ELSE 'INSERT' END,
           (SELECT i.* FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)
    FROM inserted i;
    INSERT INTO BITACORA (id_usuario, tabla, id_registro, accion, detalle)
    SELECT @id_usuario, 'PAGO', d.id_pago, 'DELETE',
           (SELECT d.* FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)
    FROM deleted d
    WHERE NOT EXISTS (SELECT 1 FROM inserted);
END;
GO

CREATE OR ALTER TRIGGER TR_OBLIGACION_PAGO_Bitacora ON OBLIGACION_PAGO
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @id_usuario INT = TRY_CAST(SESSION_CONTEXT(N'id_usuario') AS INT);
    INSERT INTO BITACORA (id_usuario, tabla, id_registro, accion, detalle)
    SELECT @id_usuario, 'OBLIGACION_PAGO', i.id_obligacion,
           CASE WHEN EXISTS (SELECT 1 FROM deleted) THEN 'UPDATE' ELSE 'INSERT' END,
           (SELECT i.* FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)
    FROM inserted i;
    INSERT INTO BITACORA (id_usuario, tabla, id_registro, accion, detalle)
    SELECT @id_usuario, 'OBLIGACION_PAGO', d.id_obligacion, 'DELETE',
           (SELECT d.* FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)
    FROM deleted d
    WHERE NOT EXISTS (SELECT 1 FROM inserted);
END;
GO

CREATE OR ALTER TRIGGER TR_PRORROGA_Bitacora ON PRORROGA
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @id_usuario INT = TRY_CAST(SESSION_CONTEXT(N'id_usuario') AS INT);
    INSERT INTO BITACORA (id_usuario, tabla, id_registro, accion, detalle)
    SELECT @id_usuario, 'PRORROGA', i.id_prorroga,
           CASE WHEN EXISTS (SELECT 1 FROM deleted) THEN 'UPDATE' ELSE 'INSERT' END,
           (SELECT i.* FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)
    FROM inserted i;
    INSERT INTO BITACORA (id_usuario, tabla, id_registro, accion, detalle)
    SELECT @id_usuario, 'PRORROGA', d.id_prorroga, 'DELETE',
           (SELECT d.* FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)
    FROM deleted d
    WHERE NOT EXISTS (SELECT 1 FROM inserted);
END;
GO

CREATE OR ALTER TRIGGER TR_RECARGO_Bitacora ON RECARGO
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @id_usuario INT = TRY_CAST(SESSION_CONTEXT(N'id_usuario') AS INT);
    INSERT INTO BITACORA (id_usuario, tabla, id_registro, accion, detalle)
    SELECT @id_usuario, 'RECARGO', i.id_recargo,
           CASE WHEN EXISTS (SELECT 1 FROM deleted) THEN 'UPDATE' ELSE 'INSERT' END,
           (SELECT i.* FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)
    FROM inserted i;
    INSERT INTO BITACORA (id_usuario, tabla, id_registro, accion, detalle)
    SELECT @id_usuario, 'RECARGO', d.id_recargo, 'DELETE',
           (SELECT d.* FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)
    FROM deleted d
    WHERE NOT EXISTS (SELECT 1 FROM inserted);
END;
GO

CREATE OR ALTER TRIGGER TR_RESULTADO_EVALUACION_Bitacora ON RESULTADO_EVALUACION
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @id_usuario INT = TRY_CAST(SESSION_CONTEXT(N'id_usuario') AS INT);
    INSERT INTO BITACORA (id_usuario, tabla, id_registro, accion, detalle)
    SELECT @id_usuario, 'RESULTADO_EVALUACION', i.id_resultado,
           CASE WHEN EXISTS (SELECT 1 FROM deleted) THEN 'UPDATE' ELSE 'INSERT' END,
           (SELECT i.* FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)
    FROM inserted i;
    INSERT INTO BITACORA (id_usuario, tabla, id_registro, accion, detalle)
    SELECT @id_usuario, 'RESULTADO_EVALUACION', d.id_resultado, 'DELETE',
           (SELECT d.* FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)
    FROM deleted d
    WHERE NOT EXISTS (SELECT 1 FROM inserted);
END;
GO

CREATE OR ALTER TRIGGER TR_CERTIFICADO_Bitacora ON CERTIFICADO
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @id_usuario INT = TRY_CAST(SESSION_CONTEXT(N'id_usuario') AS INT);
    INSERT INTO BITACORA (id_usuario, tabla, id_registro, accion, detalle)
    SELECT @id_usuario, 'CERTIFICADO', i.id_certificado,
           CASE WHEN EXISTS (SELECT 1 FROM deleted) THEN 'UPDATE' ELSE 'INSERT' END,
           (SELECT i.* FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)
    FROM inserted i;
    INSERT INTO BITACORA (id_usuario, tabla, id_registro, accion, detalle)
    SELECT @id_usuario, 'CERTIFICADO', d.id_certificado, 'DELETE',
           (SELECT d.* FOR JSON PATH, WITHOUT_ARRAY_WRAPPER)
    FROM deleted d
    WHERE NOT EXISTS (SELECT 1 FROM inserted);
END;
GO


/* ---------------------------------------------------------------------
   5. VISTAS
   --------------------------------------------------------------------- */
-- Estado de cuenta por obligación: recargos, pagado, saldo y días de mora
CREATE OR ALTER VIEW vw_estado_cuenta
AS
SELECT
    o.id_obligacion,
    i.id_inscripcion,
    e.id_estudiante,
    e.codigo,
    e.nombres + N' ' + e.apellidos                      AS estudiante,
    g.nombre                                            AS grupo,
    o.tipo,
    o.numero_cuota,
    o.periodo,
    o.monto,
    ISNULL(r.total_recargos, 0)                         AS recargos,
    ISNULL(p.total_pagado, 0)                           AS pagado,
    o.monto + ISNULL(r.total_recargos, 0)
            - ISNULL(p.total_pagado, 0)                 AS saldo,
    o.fecha_vencimiento,
    v.fecha_vencimiento_efectiva,
    CASE WHEN o.estado = 'PENDIENTE' AND v.fecha_vencimiento_efectiva < CAST(GETDATE() AS DATE)
         THEN DATEDIFF(DAY, v.fecha_vencimiento_efectiva, CAST(GETDATE() AS DATE))
         ELSE 0 END                                     AS dias_mora,
    o.estado
FROM OBLIGACION_PAGO o
JOIN INSCRIPCION i ON i.id_inscripcion = o.id_inscripcion
JOIN ESTUDIANTE  e ON e.id_estudiante  = i.id_estudiante
JOIN GRUPO       g ON g.id_grupo       = i.id_grupo
OUTER APPLY (SELECT SUM(monto) AS total_recargos FROM RECARGO WHERE id_obligacion = o.id_obligacion) r
OUTER APPLY (SELECT SUM(monto_pagado) AS total_pagado FROM PAGO WHERE id_obligacion = o.id_obligacion) p
OUTER APPLY (
    -- una prórroga mueve el vencimiento a su fecha_finalizacion
    SELECT CASE WHEN MAX(pr.fecha_finalizacion) > o.fecha_vencimiento
                THEN MAX(pr.fecha_finalizacion) ELSE o.fecha_vencimiento END AS fecha_vencimiento_efectiva
    FROM PRORROGA pr WHERE pr.id_obligacion = o.id_obligacion
) v;
GO

-- Cola de envío que lee la aplicación (o un job) para mandar los mensajes
CREATE OR ALTER VIEW vw_notificaciones_pendientes
AS
SELECT
    n.id_notificacion,
    pl.canal,
    n.destino,
    e.nombres + N' ' + e.apellidos AS estudiante,
    pl.asunto,
    pl.cuerpo,
    ec.tipo                        AS concepto,
    ec.saldo                       AS monto,
    ec.fecha_vencimiento_efectiva  AS fecha_vencimiento,
    n.fecha_programada,
    n.intentos
FROM NOTIFICACION n
JOIN ESTUDIANTE             e  ON e.id_estudiante = n.id_estudiante
JOIN PLANTILLA_NOTIFICACION pl ON pl.id_plantilla = n.id_plantilla
LEFT JOIN vw_estado_cuenta  ec ON ec.id_obligacion = n.id_obligacion
WHERE n.estado_envio = 'PENDIENTE'
  AND n.fecha_programada <= SYSDATETIME();
GO

/* ---------------------------------------------------------------------
   6. PROCEDIMIENTOS
   --------------------------------------------------------------------- */
-- Genera los recordatorios de cobro del día según REGLA_RECORDATORIO.
-- Ejecutar una vez al día (SQL Agent / tarea programada):  EXEC sp_generar_recordatorios;
CREATE OR ALTER PROCEDURE sp_generar_recordatorios
    @fecha DATE = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SET @fecha = ISNULL(@fecha, CAST(GETDATE() AS DATE));

    INSERT INTO NOTIFICACION (id_estudiante, id_plantilla, id_obligacion, destino, fecha_programada)
    SELECT ec.id_estudiante,
           r.id_plantilla,
           ec.id_obligacion,
           CASE pl.canal WHEN 'EMAIL' THEN e.email ELSE e.telefono END,
           SYSDATETIME()
    FROM vw_estado_cuenta ec
    JOIN INSCRIPCION i              ON i.id_inscripcion = ec.id_inscripcion
    JOIN ESTUDIANTE  e              ON e.id_estudiante  = ec.id_estudiante
    JOIN PLANTILLA_NOTIFICACION pl  ON pl.canal = e.canal_preferido
    JOIN REGLA_RECORDATORIO r       ON r.id_plantilla = pl.id_plantilla
    WHERE ec.estado = 'PENDIENTE'
      AND ec.saldo > 0
      AND i.estado  = 'ACTIVA'
      AND e.estado  = 'ACTIVO'
      AND pl.estado = 'ACTIVO'
      AND r.estado  = 'ACTIVO'
      AND DATEADD(DAY, r.dias_respecto_vencimiento, ec.fecha_vencimiento_efectiva) = @fecha
      AND (CASE pl.canal WHEN 'EMAIL' THEN e.email ELSE e.telefono END) IS NOT NULL
      AND NOT EXISTS (
            SELECT 1 FROM NOTIFICACION n
            WHERE n.id_obligacion = ec.id_obligacion
              AND n.id_plantilla  = r.id_plantilla
              AND n.estado_envio <> 'CANCELADO'
              AND CAST(n.fecha_programada AS DATE) = @fecha);

    SELECT @@ROWCOUNT AS notificaciones_generadas;
END;
GO

-- La aplicación lo llama después de intentar el envío
CREATE OR ALTER PROCEDURE sp_marcar_notificacion
    @id_notificacion INT,
    @exito           BIT,
    @error           NVARCHAR(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE NOTIFICACION
    SET intentos     = intentos + 1,
        estado_envio = CASE WHEN @exito = 1 THEN 'ENVIADO'
                            WHEN intentos + 1 >= 3 THEN 'FALLIDO'
                            ELSE 'PENDIENTE' END,
        fecha_envio  = CASE WHEN @exito = 1 THEN SYSDATETIME() ELSE fecha_envio END,
        error        = CASE WHEN @exito = 1 THEN NULL ELSE @error END
    WHERE id_notificacion = @id_notificacion;
END;
GO

/* ---------------------------------------------------------------------
   7. DATOS INICIALES
   --------------------------------------------------------------------- */
INSERT INTO ROL (nombre, descripcion) VALUES
    ('ADMINISTRADOR', N'Acceso total al sistema'),
    ('CAJERO',        N'Registra pagos, prórrogas y descuentos'),
    ('DOCENTE',       N'Registra asistencia, notas y avance del plan'),
    ('RECEPCION',     N'Registra estudiantes e inscripciones');

INSERT INTO PLANTILLA_NOTIFICACION (nombre, canal, asunto, cuerpo) VALUES
    (N'Recordatorio previo - WhatsApp', 'WHATSAPP', NULL,
     N'Hola {nombre}, te recordamos que tu pago de {concepto} por C$ {monto} vence el {fecha_vencimiento}. Academia de Belleza Silvia.'),
    (N'Recordatorio previo - Email', 'EMAIL', N'Recordatorio de pago',
     N'Hola {nombre}: te recordamos que tu pago de {concepto} por C$ {monto} vence el {fecha_vencimiento}. Academia de Belleza Silvia'),
    (N'Vence hoy - WhatsApp', 'WHATSAPP', NULL,
     N'Hola {nombre}, hoy vence tu pago de {concepto} por C$ {monto}. Puedes pagar en caja o por transferencia.'),
    (N'Vence hoy - Email', 'EMAIL', N'Tu pago vence hoy',
     N'Hola {nombre}: hoy vence tu pago de {concepto} por C$ {monto}. Puedes pagar en caja o por transferencia.'),
    (N'Pago en mora - WhatsApp', 'WHATSAPP', NULL,
     N'Hola {nombre}, tu pago de {concepto} venció el {fecha_vencimiento}. Saldo pendiente: C$ {monto}. Si necesitas una prórroga, comunícate con nosotros.'),
    (N'Pago en mora - Email', 'EMAIL', N'Pago pendiente',
     N'Hola {nombre}: tu pago de {concepto} venció el {fecha_vencimiento}. Saldo pendiente: C$ {monto}. Si necesitas una prórroga, comunícate con nosotros.');

-- 3 días antes, el mismo día y 5 días después del vencimiento
INSERT INTO REGLA_RECORDATORIO (id_plantilla, dias_respecto_vencimiento)
SELECT id_plantilla,
       CASE WHEN nombre LIKE N'Recordatorio previo%' THEN -3
            WHEN nombre LIKE N'Vence hoy%'           THEN 0
            ELSE 5 END
FROM PLANTILLA_NOTIFICACION;

INSERT INTO DESCUENTO (nombre, tipo, valor) VALUES
    (N'Beca 50 %',       'PORCENTAJE', 50),
    (N'Pago de contado', 'PORCENTAJE', 10),
    (N'Referido',        'MONTO_FIJO', 500);
GO
