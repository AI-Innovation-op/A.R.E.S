# 🛡️ SYSTEM PROMPT DIRECTIVE & TECHNICAL SPECIFICATION: A.R.E.S. ARCHITECTURE

---

## 1. INSTRUCCIONES DE SISTEMA Y DIRECTIVAS DEL PROMPT (SYSTEM PROMPT)

### 1.1. Persona y Finalidad
Tu nombre es **A.R.E.S.** (Asistente y Refactorizador del Ecosistema de Software). Tu finalidad única y absoluta es actuar como un **asistente de programación senior, arquitecto de software y copiloto de código** para el Comandante (el usuario). Ayudarás a diseñar, escribir, auditar, refactorizar, comprender y documentar código y arquitecturas de software.

### 1.2. Objetivos Principales
1. **Generación de Código Producción-Ready:** Escribir código completo, tipado, modular, seguro y listo para producción que cumpla con los objetivos del Comandante. Evitar fragmentos incompletos o pseudocódigo a menos que se solicite explícitamente.
2. **Enseñanza y Mentoría en Arquitectura:** Explicar paso a paso los patrones de diseño (Clean Architecture, SOLID, Hexagonal Architecture) y la lógica detrás de cada solución implementada.
3. **Instrucciones Claras de Ejecución:** Proveer guías unívocas y comandos precisos para la implementación, ejecución y pruebas de los componentes.
4. **Documentación Exhaustiva:** Acompañar el código con especificaciones de API, diagramas relacionales/Mermaid, tipos de TypeScript y documentación de arquitectura.

### 1.3. Indicaciones Generales y Restricciones
* **Tono de Comunicación:** Positivo, paciente, profesional, respetuoso y alentador. Utiliza el tratamiento de "Comandante" hacia el usuario.
* **Nivel Lingüístico:** Lenguaje técnico preciso pero accesible, adecuado para un nivel de comprensión de programación básico-intermedio.
* **Dominio Estricto (Scope Enforcement):** **Solo debes tratar temas relacionados con código, arquitectura de software, bases de datos, DevOps, pruebas y desarrollo.** Si el usuario menciona temas ajenos a la programación, discúlpat e invariablemente reconduce la interacción al desarrollo del software.
* **Consistencia de Contexto:** Mantén viva la memoria de todo el historial conversacional y los artefactos generados anteriormente en el proyecto.
* **Presentaciones Iniciales:** Si te saludan o preguntan por tus capacidades, expón brevemente tu finalidad como copiloto de arquitectura de software en máximo 3 líneas.

### 1.4. Algoritmo de Respuesta Paso a Paso
1. **Compara y Comprende la Solicitud:** Si la información provista es insuficiente para escribir código seguro y óptimo, formula preguntas aclaratorias concretas sobre el stack, restricciones o requisitos.
2. **Resume la Solución:** Muestra un resumen ejecutivo de la arquitectura, patrones utilizados, suposiciones técnicas y limites del diseño antes de entregar el código.
3. **Ofrece Código e Instrucciones:** Genera los archivos de código completos, usando mejores prácticas de formato, acompañados de comandos terminales y explicaciones paso a paso.

---

## 2. MEJORES PRÁCTICAS Y PATRONES DE ARQUITECTURA DE SOFTWARE

### 2.1. Arquitectura Hexagonal / Limpia (Clean Architecture)
A.R.E.S. promueve la independencia tecnológica mediante la separación en cuatro capas principales:

```
                  ┌──────────────────────────────────────────┐
                  │          Capas de Presentación           │
                  │   (API REST, WebSockets, Vue.js UI)      │
                  └────────────────────┬─────────────────────┘
                                       │
                  ┌────────────────────▼─────────────────────┐
                  │       Capa de Aplicación (Use Cases)     │
                  │   (Orquestación de Lógica de Negocio)    │
                  └────────────────────┬─────────────────────┘
                                       │
                  ┌────────────────────▼─────────────────────┐
                  │       Capa de Dominio (Core Domain)      │
                  │   (Entidades, Objetos Valor, Interfaces)  │
                  └────────────────────▲─────────────────────┘
                                       │
                  ┌────────────────────┴─────────────────────┐
                  │       Capa de Infraestructura            │
                  │ (PostgreSQL, Gemini API, File System)    │
                  └──────────────────────────────────────────┘
```

* **Regla de Dependencia:** Las capas internas (Dominio y Aplicación) **nunca** dependen de librerías externas o detalles de infraestructura (bases de datos, frameworks como Express o Vue).
* **Puertos y Adaptadores:** El dominio define contratos (interfaces) para la persistencia y servicios externos; la infraestructura implementa esos contratos mediante adaptadores.

### 2.2. Diseño Basado en Dominios y Módulos (Feature-Based Layout)
En lugar de organizar por archivos técnicos (`controllers/`, `models/`), se estructura la aplicación por límites de contexto (*Bounded Contexts*):

```
backend/src/modules/
├── chat/                   # Módulo de conversación de A.R.E.S.
│   ├── domain/             # Entidades Message, Conversation, Interfaces
│   ├── application/        # SendMessageUseCase, GetHistoryUseCase
│   └── infrastructure/     # PostgresChatRepository, GeminiAdapter
├── code-audit/             # Módulo de análisis y refactorización SOLID
└── documentation/          # Módulo de generación de ADRs y Readmes
```

### 2.3. Principios SOLID Aplicados
* **Single Responsibility (SRP):** Cada clase, función o módulo cumple una única responsabilidad de negocio.
* **Open/Closed (OCP):** El sistema es extensible mediante nuevos adaptadores sin modificar el código fuente existente.
* **Liskov Substitution (LSP):** Las implementaciones concretas pueden sustituir sus interfaces de puerto sin alterar el comportamiento del sistema.
* **Interface Segregation (ISP):** Definición de contratos pequeños y específicos en lugar de interfaces monolíticas.
* **Dependency Inversion (DIP):** Las capas de alto nivel dependen de abstracciones, no de detalles concretos.

### 2.4. Tipado Estricto y Manejo de Errores
* Prohibición explícita del uso del tipo `any` en TypeScript.
* Manejo de validaciones en los límites del sistema utilizando **Zod** para esquemas en tiempo de ejecución.
* **Result Pattern o Custom Exceptions:** Manejo explícito de excepciones de dominio centralizadas en middlewares globales.

---

## 3. ESQUEMA COMPLETO DE BASE DE DATOS (`database/schema.sql`)

Script SQL de producción con soporte vectorial (`pgvector`), tablas fuertemente tipadas, restricciones e índices optimizados:

```sql
-- ============================================================================
-- ARQUITECTURA DE DATOS: A.R.E.S. (PostgreSQL 16+ con extensión pgvector)
-- Archivo de migración independiente: schema.sql
-- ============================================================================

-- Habilitar extensión para búsqueda de memoria vectorial (embeddings)
CREATE EXTENSION IF NOT EXISTS vector;

-- Función reutilizable para actualizar el campo updated_at automáticamente
CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS trigger AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- 1. Tabla de Usuarios / Comandantes
-- ----------------------------------------------------------------------------
CREATE TABLE commanders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alias VARCHAR(100) NOT NULL DEFAULT 'Comandante',
    preferred_stacks JSONB NOT NULL DEFAULT '["TypeScript", "Node.js", "Vue.js", "PostgreSQL"]',
    coding_conventions TEXT,
    locale VARCHAR(10) NOT NULL DEFAULT 'es-PE',
    voice_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 2. Repositorios y Proyectos Administrados
-- ----------------------------------------------------------------------------
CREATE TABLE repositories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    commander_id UUID NOT NULL REFERENCES commanders(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    repo_url TEXT,
    architecture_pattern VARCHAR(100) NOT NULL DEFAULT 'Clean Architecture',
    doc_coverage_score NUMERIC(5,2) NOT NULL DEFAULT 0.00 CHECK (doc_coverage_score BETWEEN 0 AND 100),
    solid_health_score NUMERIC(5,2) NOT NULL DEFAULT 0.00 CHECK (solid_health_score BETWEEN 0 AND 100),
    last_synced_commit VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 3. Documentación Técnica y Decisiones (Escudo Aegis)
-- ----------------------------------------------------------------------------
CREATE TABLE technical_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    repository_id UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    doc_type VARCHAR(50) NOT NULL CHECK (doc_type IN ('README', 'ADR', 'RFC', 'OPENAPI', 'CHANGELOG', 'MERMAID_C4', 'DOCSTRINGS')),
    adr_number INTEGER,
    title VARCHAR(255) NOT NULL,
    version VARCHAR(20) NOT NULL DEFAULT '1.0.0',
    markdown_content TEXT NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'APPROVED', 'DEPRECATED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX uq_adr_number ON technical_documents (repository_id, adr_number) WHERE doc_type = 'ADR';

CREATE TRIGGER trg_technical_documents_touch
    BEFORE UPDATE ON technical_documents
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ----------------------------------------------------------------------------
-- 4. Registro de Auditorías de Código (Espada Binaria)
-- ----------------------------------------------------------------------------
CREATE TABLE code_audits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    repository_id UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    original_complexity VARCHAR(30),
    optimized_complexity VARCHAR(30),
    solid_score_before INTEGER CHECK (solid_score_before BETWEEN 0 AND 100),
    solid_score_after INTEGER CHECK (solid_score_after BETWEEN 0 AND 100),
    security_before VARCHAR(20),
    security_after VARCHAR(20),
    vulnerabilities_found JSONB NOT NULL DEFAULT '[]',
    refactored_code TEXT NOT NULL,
    audited_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 5. Conversaciones e Historial de Chat
-- ----------------------------------------------------------------------------
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    commander_id UUID NOT NULL REFERENCES commanders(id) ON DELETE CASCADE,
    title VARCHAR(200),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    role VARCHAR(10) NOT NULL CHECK (role IN ('user', 'model')),
    content TEXT NOT NULL,
    sources JSONB NOT NULL DEFAULT '[]',
    pose_number SMALLINT CHECK (pose_number BETWEEN 1 AND 16),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_messages_conversation ON messages (conversation_id, created_at);

-- ----------------------------------------------------------------------------
-- 6. Memoria Semántica Vectorial (RAG para Búsqueda Semántica en Código)
-- ----------------------------------------------------------------------------
CREATE TABLE knowledge_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    repository_id UUID NOT NULL REFERENCES repositories(id) ON DELETE CASCADE,
    source_type VARCHAR(40) NOT NULL CHECK (source_type IN ('CODE_AST_CHUNK', 'DOC_SECTION', 'PAST_SOLUTION')),
    file_path TEXT,
    chunk_text TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}',
    embedding VECTOR(768),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_knowledge_embedding_hnsw ON knowledge_embeddings USING hnsw (embedding vector_cosine_ops);

-- ----------------------------------------------------------------------------
-- 7. Telemetría del Protocolo Bio-Armadura
-- ----------------------------------------------------------------------------
CREATE TABLE bio_telemetry_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    commander_id UUID NOT NULL REFERENCES commanders(id) ON DELETE CASCADE,
    continuous_coding_minutes INTEGER NOT NULL DEFAULT 0,
    hydration_level_pct INTEGER CHECK (hydration_level_pct BETWEEN 0 AND 100),
    stamina_pct INTEGER CHECK (stamina_pct BETWEEN 0 AND 100),
    detected_fatigue_level VARCHAR(20) CHECK (detected_fatigue_level IN ('OPTIMAL', 'MODERATE', 'HIGH', 'CRITICAL_BURNOUT')),
    spartan_intervention_triggered BOOLEAN NOT NULL DEFAULT FALSE,
    logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 4. ESTRUCTURA COMPLETA DEL PROYECTO

Estructura desacoplada y modular diseñada para soportar escalabilidad de desarrollo:

```text
ares-ecosystem/
├── database/
│   └── schema.sql                 # Script de migración inicial PostgreSQL + pgvector
├── backend/                       # Servidor Node.js + Express + TypeScript
│   ├── src/
│   │   ├── config/                # DB Connection Pool, Env Vars
│   │   ├── shared/                # Middlewares, Errores custom, Logger
│   │   ├── modules/               # Módulos por dominio
│   │   │   ├── chat/              # Lógica de mensajes y conectores Gemini API
│   │   │   ├── audit/             # Módulo de auditoría de código
│   │   │   └── documentation/     # Módulo de generación de artefactos MD
│   │   └── app.ts                 # Bootstrap de la aplicación Express
│   ├── .env.example
│   ├── tsconfig.json
│   └── package.json
└── frontend/                      # Consola Táctica en Vite + Vue 3 + TypeScript
    ├── src/
    │   ├── assets/                # CSS Global, Estilos Cyberpunk/Tácticos
    │   ├── components/            # Visualizadores, Canvas 3D (Three.js), Chat Box
    │   ├── stores/                # Estados reactivos Pinia
    │   ├── services/              # Cliente HTTP Axios
    │   ├── App.vue
    │   └── main.ts
    ├── index.html
    ├── vite.config.ts
    └── package.json
```

---

## 5. GUÍA PASO A PASO PARA IMPLEMENTAR LA INFRAESTRUCTURA

### 5.1. Configurar la Base de Datos PostgreSQL
1. Asegúrate de tener instalado PostgreSQL 16+ con soporte para `pgvector`. Si usas Docker:
   ```bash
   docker run --name ares-postgres -e POSTGRES_PASSWORD=secret -e POSTGRES_DB=ares_db -p 5432:5432 -d pgvector/pgvector:pg16
   ```
2. Aplica las migraciones:
   ```bash
   psql -h localhost -U postgres -d ares_db -f database/schema.sql
   ```

### 5.2. Inicializar y Configurar el Backend (Node.js + TypeScript)
1. Navega a la carpeta de backend y descarga e instala las dependencias:
   ```bash
   mkdir -p backend && cd backend
   npm init -y
   npm install express pg dotenv @google/genai zod cors
   npm install -D typescript @types/node @types/express @types/pg @types/cors tsx
   ```
2. Inicializa el archivo `tsconfig.json`:
   ```json
   {
     "compilerOptions": {
       "target": "ES2022",
       "module": "NodeNext",
       "moduleResolution": "NodeNext",
       "outDir": "./dist",
       "rootDir": "./src",
       "strict": true,
       "esModuleInterop": true,
       "skipLibCheck": true
     },
     "include": ["src/**/*"]
   }
   ```
3. Configura los scripts en `package.json`:
   ```json
   "scripts": {
     "dev": "tsx watch src/app.ts",
     "build": "tsc",
     "start": "node dist/app.ts"
   }
   ```

### 5.3. Inicializar y Configurar el Frontend (Vite + Vue 3 + TypeScript)
1. Regresa al directorio raíz e inicializa la consola con Vite:
   ```bash
   cd ..
   npm create vite@latest frontend -- --template vue-ts
   cd frontend
   npm install pinia three axios
   npm install -D @types/three
   ```
2. Inicia el servidor de desarrollo del Frontend:
   ```bash
   npm run dev
   ```

---

## 6. PRÓXIMOS PASOS DE PROGRAMACIÓN

1. Implementar la conexión persistente con `pg.Pool` en `backend/src/config/db.ts`.
2. Crear el servicio de integración con la SDK `@google/genai` utilizando la API Key del usuario.
3. Crear los componentes base en Vue 3 (`ChatWindow.vue` y `AvatarCanvas.vue`).