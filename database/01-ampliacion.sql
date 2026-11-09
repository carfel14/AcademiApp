-- Ejecutar sobre la base de AcademiApp seleccionada, después del esquema base.
IF OBJECT_ID('dbo.plan_estudio', 'U') IS NULL
CREATE TABLE dbo.plan_estudio (
    id_plan                    INT IDENTITY(1,1) NOT NULL,
    id_curso                   INT NOT NULL,
    nombre                     NVARCHAR(150) NOT NULL,
    descripcion                NVARCHAR(500) NULL,
    version                    SMALLINT NOT NULL
        CONSTRAINT DF_PLAN_ESTUDIO_version DEFAULT 1,
    estado                     VARCHAR(20) NOT NULL
        CONSTRAINT DF_PLAN_ESTUDIO_estado DEFAULT 'ACTIVO',
    CONSTRAINT PK_PLAN_ESTUDIO PRIMARY KEY (id_plan),
    CONSTRAINT FK_PLAN_ESTUDIO_CURSO FOREIGN KEY (id_curso) REFERENCES dbo.curso(id_curso),
    CONSTRAINT UQ_PLAN_ESTUDIO_id_curso_version UNIQUE (id_curso, version),
    CONSTRAINT CK_PLAN_ESTUDIO_version CHECK (version > 0),
    CONSTRAINT CK_PLAN_ESTUDIO_estado CHECK (estado IN ('ACTIVO', 'INACTIVO'))
);
GO

IF OBJECT_ID('dbo.unidad_estudio', 'U') IS NULL
CREATE TABLE dbo.unidad_estudio (
    id_unidad                  INT IDENTITY(1,1) NOT NULL,
    id_plan                    INT NOT NULL,
    nombre                     NVARCHAR(150) NOT NULL,
    descripcion                NVARCHAR(500) NULL,
    orden                      SMALLINT NOT NULL,
    CONSTRAINT PK_UNIDAD_ESTUDIO PRIMARY KEY (id_unidad),
    CONSTRAINT FK_UNIDAD_ESTUDIO_PLAN_ESTUDIO FOREIGN KEY (id_plan) REFERENCES dbo.plan_estudio(id_plan),
    CONSTRAINT UQ_UNIDAD_ESTUDIO_id_plan_orden UNIQUE (id_plan, orden),
    CONSTRAINT CK_UNIDAD_ESTUDIO_orden CHECK (orden > 0)
);
GO

IF OBJECT_ID('dbo.tema_estudio', 'U') IS NULL
CREATE TABLE dbo.tema_estudio (
    id_tema                    INT IDENTITY(1,1) NOT NULL,
    id_unidad                  INT NOT NULL,
    nombre                     NVARCHAR(150) NOT NULL,
    descripcion                NVARCHAR(500) NULL,
    orden                      SMALLINT NOT NULL,
    modalidad                  VARCHAR(15) NOT NULL,
    horas_estimadas            DECIMAL(5,2) NULL,
    CONSTRAINT PK_TEMA_ESTUDIO PRIMARY KEY (id_tema),
    CONSTRAINT FK_TEMA_ESTUDIO_UNIDAD_ESTUDIO FOREIGN KEY (id_unidad) REFERENCES dbo.unidad_estudio(id_unidad),
    CONSTRAINT UQ_TEMA_ESTUDIO_id_unidad_orden UNIQUE (id_unidad, orden),
    CONSTRAINT CK_TEMA_ESTUDIO_orden CHECK (orden > 0),
    CONSTRAINT CK_TEMA_ESTUDIO_modalidad CHECK (modalidad IN ('TEORICO', 'PRACTICO', 'DEMOSTRACION')),
    CONSTRAINT CK_TEMA_ESTUDIO_horas_estimadas CHECK (horas_estimadas > 0)
);
GO

IF OBJECT_ID('dbo.recargo', 'U') IS NULL
CREATE TABLE dbo.recargo (
    id_recargo                 INT IDENTITY(1,1) NOT NULL,
    id_obligacion              INT NOT NULL,
    monto                      DECIMAL(10,2) NOT NULL,
    motivo                     NVARCHAR(200) NOT NULL,
    fecha_generacion           DATE NOT NULL
        CONSTRAINT DF_RECARGO_fecha_generacion DEFAULT CAST(GETDATE() AS DATE),
    CONSTRAINT PK_RECARGO PRIMARY KEY (id_recargo),
    CONSTRAINT FK_RECARGO_OBLIGACION_PAGO FOREIGN KEY (id_obligacion) REFERENCES dbo.obligacion_pago(id_obligacion),
    CONSTRAINT CK_RECARGO_monto CHECK (monto > 0)
);
GO

IF OBJECT_ID('dbo.descuento', 'U') IS NULL
CREATE TABLE dbo.descuento (
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
    CONSTRAINT CK_DESCUENTO_regla1 CHECK (tipo <> 'PORCENTAJE' OR valor <= 100)
);
GO

IF OBJECT_ID('dbo.obligacion_descuento', 'U') IS NULL
CREATE TABLE dbo.obligacion_descuento (
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
        REFERENCES dbo.obligacion_pago(id_obligacion),

    CONSTRAINT FK_OBLIGACION_DESCUENTO_DESCUENTO
        FOREIGN KEY (id_descuento)
        REFERENCES dbo.descuento(id_descuento),

    CONSTRAINT CK_OBLIGACION_DESCUENTO_tipo
        CHECK (tipo_aplicado IN ('PORCENTAJE', 'MONTO_FIJO')),

    CONSTRAINT CK_OBLIGACION_DESCUENTO_valor
        CHECK (valor_aplicado > 0),

    CONSTRAINT CK_OBLIGACION_DESCUENTO_porcentaje
        CHECK (tipo_aplicado <> 'PORCENTAJE' OR valor_aplicado <= 100)
);
GO

IF OBJECT_ID('dbo.plantilla_notificacion', 'U') IS NULL
CREATE TABLE dbo.plantilla_notificacion (
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

IF OBJECT_ID('dbo.regla_recordatorio', 'U') IS NULL
CREATE TABLE dbo.regla_recordatorio (
    id_regla                   INT IDENTITY(1,1) NOT NULL,
    id_plantilla               INT NOT NULL,
    dias_respecto_vencimiento  SMALLINT NOT NULL,
    estado                     VARCHAR(20) NOT NULL
        CONSTRAINT DF_REGLA_RECORDATORIO_estado DEFAULT 'ACTIVO',
    CONSTRAINT PK_REGLA_RECORDATORIO PRIMARY KEY (id_regla),
    CONSTRAINT FK_REGLA_RECORDATORIO_PLANTILLA_NOTIFICACION FOREIGN KEY (id_plantilla) REFERENCES dbo.plantilla_notificacion(id_plantilla),
    CONSTRAINT UQ_REGLA_RECORDATORIO_id_plantilla_dias_respecto_vencimiento UNIQUE (id_plantilla, dias_respecto_vencimiento),
    CONSTRAINT CK_REGLA_RECORDATORIO_estado CHECK (estado IN ('ACTIVO', 'INACTIVO'))
);
GO

IF OBJECT_ID('dbo.notificacion', 'U') IS NULL
CREATE TABLE dbo.notificacion (
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
    CONSTRAINT FK_NOTIFICACION_ESTUDIANTE FOREIGN KEY (id_estudiante) REFERENCES dbo.estudiante(id_estudiante),
    CONSTRAINT FK_NOTIFICACION_PLANTILLA_NOTIFICACION FOREIGN KEY (id_plantilla) REFERENCES dbo.plantilla_notificacion(id_plantilla),
    CONSTRAINT FK_NOTIFICACION_OBLIGACION_PAGO FOREIGN KEY (id_obligacion) REFERENCES dbo.obligacion_pago(id_obligacion),
    CONSTRAINT CK_NOTIFICACION_estado_envio CHECK (estado_envio IN ('PENDIENTE', 'ENVIADO', 'FALLIDO', 'CANCELADO'))
);
GO

IF OBJECT_ID('dbo.bitacora', 'U') IS NULL
CREATE TABLE dbo.bitacora (
    id_bitacora                BIGINT IDENTITY(1,1) NOT NULL,
    id_usuario                 INT NULL,
    tabla                      VARCHAR(50) NOT NULL,
    id_registro                INT NULL,
    accion                     VARCHAR(10) NOT NULL,
    fecha                      DATETIME2(0) NOT NULL
        CONSTRAINT DF_BITACORA_fecha DEFAULT SYSUTCDATETIME(),
    detalle                    NVARCHAR(MAX) NULL,
    CONSTRAINT PK_BITACORA PRIMARY KEY (id_bitacora),
    CONSTRAINT FK_BITACORA_USUARIO FOREIGN KEY (id_usuario) REFERENCES dbo.usuario(id_usuario),
    CONSTRAINT CK_BITACORA_accion CHECK (accion IN ('INSERT', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT'))
);
GO
IF OBJECT_ID('dbo.usuario_sesion', 'U') IS NULL
CREATE TABLE dbo.usuario_sesion (
    token_hash CHAR(64) PRIMARY KEY,
    id_usuario INT NOT NULL REFERENCES dbo.usuario(id_usuario),
    expira DATETIME2(0) NOT NULL
);
GO

IF COL_LENGTH('dbo.estudiante', 'email') IS NULL
    ALTER TABLE dbo.estudiante ADD email NVARCHAR(150) NULL;
GO

CREATE OR ALTER VIEW dbo.vw_estado_cuenta AS
SELECT o.*, COALESCE(p.total_pagado, 0) AS total_pagado,
    CAST(o.monto + COALESCE(r.total_recargo, 0) - COALESCE(d.total_descuento, 0) AS DECIMAL(12,2)) AS monto_ajustado,
    COALESCE(r.total_recargo, 0) AS total_recargo,
    COALESCE(d.total_descuento, 0) AS total_descuento,
    CAST(CASE WHEN o.estado = 'ANULADA' THEN 0
        ELSE o.monto + COALESCE(r.total_recargo, 0) - COALESCE(d.total_descuento, 0) - COALESCE(p.total_pagado, 0)
    END AS DECIMAL(12,2)) AS saldo_pendiente,
    CASE WHEN pr.fecha_fin >= o.fecha_vencimiento THEN pr.fecha_fin ELSE o.fecha_vencimiento END AS vencimiento_efectivo
FROM dbo.obligacion_pago o
OUTER APPLY (SELECT SUM(monto_pagado) AS total_pagado FROM dbo.pago WHERE id_obligacion = o.id_obligacion) p
OUTER APPLY (SELECT SUM(monto) AS total_recargo FROM dbo.recargo WHERE id_obligacion = o.id_obligacion) r
OUTER APPLY (
    SELECT SUM(CASE WHEN tipo_aplicado = 'PORCENTAJE' THEN ROUND(base.monto * od.valor_aplicado / 100, 2)
        ELSE valor_aplicado END) AS total_descuento
    FROM dbo.obligacion_descuento od JOIN dbo.obligacion_pago base ON base.id_obligacion = od.id_obligacion
    WHERE od.id_obligacion = o.id_obligacion
) d
LEFT JOIN dbo.prorroga pr ON pr.id_obligacion = o.id_obligacion;
GO

SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID('dbo.notificacion') AND name = 'ux_recordatorio')
CREATE UNIQUE INDEX ux_recordatorio
ON dbo.notificacion(id_obligacion, id_plantilla, fecha_programada)
WHERE id_obligacion IS NOT NULL;
GO

INSERT INTO dbo.rol(nombre, descripcion)
SELECT v.nombre, v.descripcion
FROM (VALUES ('ADMIN', 'Administración general'), ('PROFESOR', 'Gestión académica'), ('CAJA', 'Inscripciones y cobros')) v(nombre, descripcion)
WHERE NOT EXISTS (SELECT 1 FROM dbo.rol r WHERE r.nombre = v.nombre);
GO
