-- ============================================================================
-- ACADEMIA DE BELLEZA SILVIA
-- BASE DE DATOS - ACADEMIAPP
-- ============================================================================

IF DB_ID('AcademiApp') IS NULL
BEGIN
    CREATE DATABASE AcademiApp;
END
GO

USE AcademiApp;
GO

-- ============================================================================
-- ENTIDADES Y RESTRICCIONES
-- ============================================================================

-- 1. CURSO
CREATE TABLE curso (
    id_curso INT IDENTITY(1,1) PRIMARY KEY,
    nombre_curso VARCHAR(150) NOT NULL,
    descripcion VARCHAR(MAX),
    -- Precio total del curso
    precio NUMERIC(10,2) NOT NULL,
    -- Precio único de matrícula
    precio_matricula NUMERIC(10,2) NOT NULL DEFAULT 0,
    estado VARCHAR(20) NOT NULL DEFAULT 'ACTIVO',

    CONSTRAINT chk_curso_precio
        CHECK (precio >= 0),

    CONSTRAINT chk_curso_precio_matricula
        CHECK (precio_matricula >= 0),

    CONSTRAINT chk_curso_estado
        CHECK (
            estado IN (
                'ACTIVO',
                'FINALIZADO',
                'CANCELADO'
            )
        )
);

-- 2. GRUPO
CREATE TABLE grupo (
    id_grupo INT IDENTITY(1,1) PRIMARY KEY,
    id_curso INT NOT NULL,
    nombre_grupo VARCHAR(100) NOT NULL,
    fecha_inicio DATE NOT NULL,
    -- Duración del grupo expresada en meses
    duracion_meses INT NOT NULL,
    -- Calculada automáticamente a partir de fecha_inicio
    -- + duracion_meses
    fecha_fin DATE NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'ACTIVO',

    CONSTRAINT fk_grupo_curso
        FOREIGN KEY (id_curso)
        REFERENCES curso(id_curso)
        ON DELETE NO ACTION
        ON UPDATE NO ACTION,

    CONSTRAINT chk_grupo_duracion
        CHECK (duracion_meses > 0),

    CONSTRAINT chk_grupo_fecha_fin
        CHECK (fecha_fin > fecha_inicio),

    CONSTRAINT chk_grupo_estado
        CHECK (
            estado IN (
                'ACTIVO',
                'FINALIZADO',
                'CANCELADO'
            )
        )
);

-- 3. HORARIO_CLASE
CREATE TABLE horario_clase (
    id_horario INT IDENTITY(1,1) PRIMARY KEY,
    id_grupo INT NOT NULL,
    dia_semana VARCHAR(20) NOT NULL,
    hora_inicio TIME NOT NULL,
    hora_fin TIME NOT NULL,

    CONSTRAINT fk_horario_grupo
        FOREIGN KEY (id_grupo)
        REFERENCES grupo(id_grupo)
        ON DELETE NO ACTION
        ON UPDATE NO ACTION,
    CONSTRAINT chk_horario_dia
        CHECK (
            dia_semana IN (
                'LUNES',
                'MARTES',
                'MIERCOLES',
                'JUEVES',
                'VIERNES',
                'SABADO',
                'DOMINGO'
            )
        ),
    CONSTRAINT chk_horario_hora
        CHECK (hora_inicio < hora_fin)
);

-- 4. ESTUDIANTE
CREATE TABLE estudiante (
    id_estudiante INT IDENTITY(1,1) PRIMARY KEY,

    codigo_estudiante AS (
        'EST-' + RIGHT(
            '000000' + CAST(id_estudiante AS VARCHAR(6)),
            6
        )
    ),

    nombres VARCHAR(100) NOT NULL,
    apellidos VARCHAR(100) NOT NULL,
    fecha_nacimiento DATE,
    telefono VARCHAR(20),
    fecha_registro DATE NOT NULL DEFAULT CAST(GETDATE() AS DATE),
    estado VARCHAR(20) NOT NULL DEFAULT 'ACTIVO',

    CONSTRAINT chk_estudiante_estado
        CHECK (estado IN ('ACTIVO', 'INACTIVO'))
);

-- 5. PROFESOR
CREATE TABLE profesor (
    id_profesor INT IDENTITY(1,1) PRIMARY KEY,
    nombres VARCHAR(100) NOT NULL,
    apellidos VARCHAR(100) NOT NULL,
    telefono VARCHAR(20),    
    especialidad VARCHAR(100),
    estado VARCHAR(20) NOT NULL DEFAULT 'ACTIVO',

    CONSTRAINT chk_profesor_estado
        CHECK (estado IN ('ACTIVO', 'INACTIVO'))
);

-- 6. ASIGNACION_PROFESOR
CREATE TABLE asignacion_profesor (
    id_asignacion INT IDENTITY(1,1) PRIMARY KEY,
    id_profesor INT NOT NULL,
    id_grupo INT NOT NULL,
    fecha_asignacion DATE NOT NULL DEFAULT CAST(GETDATE() AS DATE),

    CONSTRAINT fk_asignacion_profesor
        FOREIGN KEY (id_profesor)
        REFERENCES profesor(id_profesor)
        ON DELETE NO ACTION
        ON UPDATE NO ACTION,
    CONSTRAINT fk_asignacion_grupo
        FOREIGN KEY (id_grupo)
        REFERENCES grupo(id_grupo)
        ON DELETE NO ACTION
        ON UPDATE NO ACTION,
    CONSTRAINT uq_profesor_grupo
        UNIQUE (id_profesor, id_grupo)
);

-- 7. INSCRIPCION
CREATE TABLE inscripcion (
    id_inscripcion INT IDENTITY(1,1) PRIMARY KEY,
    id_estudiante INT NOT NULL,
    id_grupo INT NOT NULL,
    fecha_inscripcion DATE NOT NULL DEFAULT CAST(GETDATE() AS DATE),
    estado_inscripcion VARCHAR(20) NOT NULL DEFAULT 'ACTIVA',
    observacion VARCHAR(MAX),

    CONSTRAINT fk_inscripcion_estudiante
        FOREIGN KEY (id_estudiante)
        REFERENCES estudiante(id_estudiante)
        ON DELETE NO ACTION
        ON UPDATE NO ACTION,
    CONSTRAINT fk_inscripcion_grupo
        FOREIGN KEY (id_grupo)
        REFERENCES grupo(id_grupo)
        ON DELETE NO ACTION
        ON UPDATE NO ACTION,    
    CONSTRAINT chk_inscripcion_estado
        CHECK (estado_inscripcion IN ('ACTIVA', 'FINALIZADA', 'CANCELADA'))
);

-- 8. SESION_CLASE
CREATE TABLE sesion_clase (
    id_sesion INT IDENTITY(1,1) PRIMARY KEY,
    id_grupo INT NOT NULL,
    id_horario INT,
    fecha_programada DATE NOT NULL,
    hora_inicio TIME NOT NULL,
    hora_fin TIME NOT NULL,
    tema VARCHAR(200),
    estado_sesion VARCHAR(20) NOT NULL DEFAULT 'PROGRAMADA',
    observacion VARCHAR(MAX),

    CONSTRAINT fk_sesion_grupo
        FOREIGN KEY (id_grupo)
        REFERENCES grupo(id_grupo)
        ON DELETE NO ACTION
        ON UPDATE NO ACTION,

    CONSTRAINT fk_sesion_horario
        FOREIGN KEY (id_horario)
        REFERENCES horario_clase(id_horario)
        ON DELETE NO ACTION
        ON UPDATE NO ACTION,

    CONSTRAINT chk_sesion_hora
        CHECK (hora_inicio < hora_fin),

    CONSTRAINT chk_sesion_estado
        CHECK (
            estado_sesion IN (
                'PROGRAMADA',
                'REALIZADA',
                'CANCELADA'
            )
        )
);

-- 9. ASISTENCIA
CREATE TABLE asistencia (
    id_asistencia INT IDENTITY(1,1) PRIMARY KEY,
    id_inscripcion INT NOT NULL,
    id_sesion INT NOT NULL,
    estado_asistencia VARCHAR(25) NOT NULL,
    observacion VARCHAR(MAX),

    CONSTRAINT fk_asistencia_inscripcion
        FOREIGN KEY (id_inscripcion)
        REFERENCES inscripcion(id_inscripcion)
        ON DELETE NO ACTION
        ON UPDATE NO ACTION,
    CONSTRAINT fk_asistencia_sesion
        FOREIGN KEY (id_sesion)
        REFERENCES sesion_clase(id_sesion)
        ON DELETE NO ACTION
        ON UPDATE NO ACTION,
    CONSTRAINT uq_inscripcion_sesion
        UNIQUE (id_inscripcion, id_sesion),
    CONSTRAINT chk_estado_asistencia
        CHECK (
            estado_asistencia IN (
                'PRESENTE',
                'AUSENTE',
                'JUSTIFICADO',
                'SUSPENDIDO_POR_MORA'
            )
        )
);

-- 10. EVALUACION
CREATE TABLE evaluacion (
    id_evaluacion INT IDENTITY(1,1) PRIMARY KEY,
    id_sesion INT NOT NULL,
    tipo_evaluacion VARCHAR(50) NOT NULL,
    descripcion VARCHAR(MAX),

    CONSTRAINT fk_evaluacion_sesion
        FOREIGN KEY (id_sesion)
        REFERENCES sesion_clase(id_sesion)
        ON DELETE NO ACTION
        ON UPDATE NO ACTION
);

-- 11. RESULTADO_EVALUACION
CREATE TABLE resultado_evaluacion (
    id_resultado INT IDENTITY(1,1) PRIMARY KEY,
    id_evaluacion INT NOT NULL,
    id_inscripcion INT NOT NULL,
    nota NUMERIC(5,2),
    estado_resultado VARCHAR(20) NOT NULL,

    CONSTRAINT fk_resultado_evaluacion
        FOREIGN KEY (id_evaluacion)
        REFERENCES evaluacion(id_evaluacion)
        ON DELETE NO ACTION
        ON UPDATE NO ACTION,
    CONSTRAINT fk_resultado_inscripcion
        FOREIGN KEY (id_inscripcion)
        REFERENCES inscripcion(id_inscripcion)
        ON DELETE NO ACTION
        ON UPDATE NO ACTION,
    CONSTRAINT uq_evaluacion_inscripcion
        UNIQUE (id_evaluacion, id_inscripcion),
    CONSTRAINT chk_estado_resultado
        CHECK (
            estado_resultado IN (
                'CALIFICADO',
                'NO_SE_PRESENTO'
            )
        ),
    CONSTRAINT chk_resultado_nota
        CHECK (
            (
                estado_resultado = 'CALIFICADO'
                AND nota IS NOT NULL
                AND nota BETWEEN 0 AND 100
            )
            OR
            (
                estado_resultado = 'NO_SE_PRESENTO'
                AND nota IS NULL
            )
        )
);

-- 12. OBLIGACION_PAGO
CREATE TABLE obligacion_pago (
    id_obligacion INT IDENTITY(1,1) PRIMARY KEY,
    id_inscripcion INT NOT NULL,

    tipo_obligacion VARCHAR(20) NOT NULL,

    numero_cuota INT NULL,
    periodo VARCHAR(50) NULL,
    fecha_vencimiento DATE NOT NULL,
    monto NUMERIC(10,2) NOT NULL,

    estado VARCHAR(20) NOT NULL CONSTRAINT DF_obligacion_pago_estado DEFAULT 'PENDIENTE',

    CONSTRAINT CK_obligacion_pago_estado
    CHECK (estado IN ('PENDIENTE', 'PAGADA', 'ANULADA')),

    CONSTRAINT fk_obligacion_inscripcion
        FOREIGN KEY (id_inscripcion)
        REFERENCES inscripcion(id_inscripcion)
        ON DELETE NO ACTION,

    CONSTRAINT chk_tipo_obligacion
        CHECK (
            tipo_obligacion IN (
                'MATRICULA',
                'MENSUALIDAD'
            )
        ),

    CONSTRAINT chk_monto_obligacion
        CHECK (monto > 0),

    CONSTRAINT chk_numero_cuota
        CHECK (
            (
                tipo_obligacion = 'MATRICULA'
                AND numero_cuota IS NULL
            )
            OR
            (
                tipo_obligacion = 'MENSUALIDAD'
                AND numero_cuota IS NOT NULL
                AND numero_cuota > 0
            )
        ),

    CONSTRAINT chk_periodo_obligacion
    CHECK (
        (
            tipo_obligacion = 'MATRICULA'
            AND periodo IS NULL
        )
        OR
        (
            tipo_obligacion = 'MENSUALIDAD'
            AND periodo IS NOT NULL
        )
    ),

    CONSTRAINT uq_inscripcion_numero_cuota
        UNIQUE (id_inscripcion, tipo_obligacion, numero_cuota)
);

-- 13. PAGO
CREATE TABLE pago (
    id_pago INT IDENTITY(1,1) PRIMARY KEY,
    id_obligacion INT NOT NULL,
    fecha_pago DATE NOT NULL DEFAULT CAST(GETDATE() AS DATE),
    monto_pagado NUMERIC(10,2) NOT NULL,
    metodo_pago VARCHAR(50) NOT NULL,
    observacion VARCHAR(MAX),

    CONSTRAINT fk_pago_obligacion
        FOREIGN KEY (id_obligacion)
        REFERENCES obligacion_pago(id_obligacion)
        ON DELETE NO ACTION
        ON UPDATE NO ACTION,
    CONSTRAINT chk_monto_pagado
        CHECK (monto_pagado > 0)
);

-- 14. PRORROGA
CREATE TABLE prorroga (
    id_prorroga INT IDENTITY(1,1) PRIMARY KEY,
    id_obligacion INT NOT NULL,
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NOT NULL,
    observacion VARCHAR(MAX),

    CONSTRAINT fk_prorroga_obligacion
        FOREIGN KEY (id_obligacion)
        REFERENCES obligacion_pago(id_obligacion)
        ON DELETE NO ACTION
        ON UPDATE NO ACTION,
    CONSTRAINT uq_prorroga_obligacion
        UNIQUE (id_obligacion),
    CONSTRAINT chk_fechas_prorroga
        CHECK (fecha_inicio <= fecha_fin)
);

-- 15. CERTIFICADO
CREATE TABLE certificado (
    id_certificado INT IDENTITY(1,1) PRIMARY KEY,
    id_inscripcion INT NOT NULL,
    fecha_emision DATE NOT NULL,
    codigo_certificado VARCHAR(100) NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'EMITIDO',

    CONSTRAINT fk_certificado_inscripcion
        FOREIGN KEY (id_inscripcion)
        REFERENCES inscripcion(id_inscripcion)
        ON DELETE NO ACTION
        ON UPDATE NO ACTION,
    CONSTRAINT uq_certificado_inscripcion
        UNIQUE (id_inscripcion),
    CONSTRAINT uq_certificado_codigo
        UNIQUE (codigo_certificado),
    CONSTRAINT chk_estado_certificado
        CHECK (estado IN ('EMITIDO', 'ANULADO'))
);

-- ============================================================================
-- SEGURIDAD DEL SISTEMA
-- ============================================================================

-- 1. ROL
CREATE TABLE rol (
    id_rol INT IDENTITY(1,1) PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL,
    descripcion VARCHAR(200),

    CONSTRAINT uq_rol_nombre
        UNIQUE (nombre)
);

-- 2. PERMISO
CREATE TABLE permiso (
    id_permiso INT IDENTITY(1,1) PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    descripcion VARCHAR(200),

    CONSTRAINT uq_permiso_nombre
        UNIQUE (nombre)
);

-- 3. USUARIO
CREATE TABLE usuario (
    id_usuario INT IDENTITY(1,1) PRIMARY KEY,
    id_rol INT NOT NULL,
    username VARCHAR(50) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    nombres VARCHAR(100) NOT NULL,
    apellidos VARCHAR(100) NOT NULL,
    activo BIT NOT NULL DEFAULT 1,

    CONSTRAINT fk_usuario_rol
        FOREIGN KEY (id_rol)
        REFERENCES rol(id_rol)
        ON DELETE NO ACTION
        ON UPDATE NO ACTION,

    CONSTRAINT uq_usuario_username
        UNIQUE (username)
);

-- 4. ROL_PERMISO
CREATE TABLE rol_permiso (
    id_rol INT NOT NULL,
    id_permiso INT NOT NULL,

    CONSTRAINT pk_rol_permiso
        PRIMARY KEY (id_rol, id_permiso),

    CONSTRAINT fk_rol_permiso_rol
        FOREIGN KEY (id_rol)
        REFERENCES rol(id_rol)
        ON DELETE NO ACTION
        ON UPDATE NO ACTION,

    CONSTRAINT fk_rol_permiso_permiso
        FOREIGN KEY (id_permiso)
        REFERENCES permiso(id_permiso)
        ON DELETE NO ACTION
        ON UPDATE NO ACTION
);

-- ============================================================================
-- INDICES
-- ============================================================================

SET QUOTED_IDENTIFIER ON;
SET ANSI_NULLS ON;

CREATE INDEX idx_grupo_curso
ON grupo(id_curso);

CREATE INDEX idx_horario_grupo
ON horario_clase(id_grupo);

CREATE UNIQUE INDEX ux_estudiante_codigo
ON estudiante(codigo_estudiante);

CREATE INDEX idx_asignacion_profesor
ON asignacion_profesor(id_profesor);

CREATE INDEX idx_asignacion_grupo
ON asignacion_profesor(id_grupo);

CREATE INDEX idx_inscripcion_estudiante
ON inscripcion(id_estudiante);

CREATE UNIQUE INDEX ux_estudiante_grupo_activa
ON inscripcion(id_estudiante, id_grupo)
WHERE estado_inscripcion = 'ACTIVA';

CREATE INDEX idx_inscripcion_grupo
ON inscripcion(id_grupo);

CREATE INDEX idx_sesion_grupo
ON sesion_clase(id_grupo);

CREATE INDEX idx_sesion_horario
ON sesion_clase(id_horario);

CREATE INDEX idx_asistencia_inscripcion
ON asistencia(id_inscripcion);

CREATE INDEX idx_asistencia_sesion
ON asistencia(id_sesion);

CREATE INDEX idx_evaluacion_sesion
ON evaluacion(id_sesion);

CREATE INDEX idx_resultado_evaluacion
ON resultado_evaluacion(id_evaluacion);

CREATE INDEX idx_resultado_inscripcion
ON resultado_evaluacion(id_inscripcion);

CREATE INDEX idx_obligacion_inscripcion
ON obligacion_pago(id_inscripcion);

CREATE INDEX idx_pago_obligacion
ON pago(id_obligacion);

CREATE INDEX idx_prorroga_obligacion
ON prorroga(id_obligacion);

CREATE INDEX idx_certificado_inscripcion
ON certificado(id_inscripcion);

-- ============================================================================
-- INDICES DE SEGURIDAD
-- ============================================================================

CREATE INDEX idx_usuario_rol
ON usuario(id_rol);

CREATE INDEX idx_rol_permiso_permiso
ON rol_permiso(id_permiso);
