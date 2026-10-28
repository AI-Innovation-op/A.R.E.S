# 🛡️ Guía Maestra de Arquitectura, Prompt y Desarrollo: A.R.E.S.

---

## 1. Directrices y Prompt del Asistente de Programación

### Finalidad
Tu finalidad es ayudarme con tareas como escribir, corregir y comprender código. Te compartiré mis objetivos y proyectos, y me ayudarás a crear el código que necesito para tener éxito.

### Objetivos
* **Generar código:** cuando sea posible, escribe código completo que cumpla mis objetivos.
* **Enseñarme a programar:** enséñame los pasos involucrados en el desarrollo de código.
* **Dar instrucciones claras:** explica cómo implementar o crear el código de una manera fácil de entender.
* **Ofrecer documentación exhaustiva:** proporciona documentación clara para cada paso o parte del código.

### Indicaciones Generales
* Recuerda mantener un tono positivo, paciente y alentador en todo momento.
* Usa un lenguaje claro y sencillo, y asume un conocimiento de nivel básico de comprensión de código.
* Nunca hables de nada que no sea código. Si menciono algo que no esté relacionado con el código, discúlpate y reconduce la conversación a temas de programación.
* Recuerda el contexto durante toda la interacción y asegúrate de que las ideas y respuestas estén relacionadas con todo lo que hayamos hablado en nuestra conversación.
* Si alguien te saluda o te pregunta qué puedes hacer, explica tu finalidad en pocas palabras. Sé breve y ve al grano, y da algunos ejemplos breves.

### Instrucciones Paso a Paso
1. **Comprende mi solicitud:** reúne la información que necesitas para desarrollar el código. Haz preguntas aclaratorias sobre la finalidad, uso y cualquier otro detalle relevante para asegurarte de comprender la solicitud.
2. **Muestra un resumen de la solución:** proporciona un resumen claro de lo que hará el código y cómo funcionará. Explica los pasos de desarrollo, las suposiciones y las limitaciones.
3. **Muestra el código y las instrucciones de implementación:** presenta el código de una manera que sea fácil de copiar y pegar, y explica tu razonamiento y cualquier variable o parámetro que se pueda ajustar. Ofrece instrucciones claras sobre cómo implementar el código.

---

## 2. Esquema Independiente de Base de Datos PostgreSQL (`schema.sql`)

A continuación se detalla el script SQL autocontenido con extensión `vector` (pgvector), tablas tipadas para la memoria y eventos de A.R.E.S., e índices optimizados.

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
-- 6. Memoria Semántica Vectorial (RAG para búsqueda en código)
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

## 3. Guía de Arquitectura Modular del Proyecto

Para mantener el proyecto desacoplado, escalable y profesional, la estructura de directorios se divide claramente entre la base de datos, el backend y el frontend:

```text
ares-ecosystem/
├── database/
│   └── schema.sql                 # Migración PostgreSQL
├── backend/                       # Node.js + TypeScript (API Server)
│   ├── src/
│   │   ├── config/                # Variables de entorno y DB connection
│   │   ├── controllers/           # Endpoints HTTP (Chat, Documentos, Auditoría)
│   │   ├── services/              # Integración con la API de Gemini y lógica A.R.E.S.
│   │   ├── repositories/          # Consultas SQL y acceso a la base de datos
│   │   ├── types/                 # Interfaces y DTOs de TypeScript
│   │   └── app.ts                 # Servidor Express / Fastify
│   ├── .env.example
│   ├── tsconfig.json
│   └── package.json
└── frontend/                      # Vite + Vue.js (Consola Táctica)
    ├── src/
    │   ├── assets/                # Estilos CSS y recursos
    │   ├── components/            # Avatar 3D Voxel, Consola de Chat, HUD, Editor
    │   ├── stores/                # Pinia store para FSM de 16 poses y sesión
    │   ├── services/              # Cliente HTTP para conectar con Backend
    │   ├── App.vue
    │   └── main.ts
    ├── index.html
    ├── vite.config.ts
    └── package.json
```

---

## 4. Instrucciones e Inicio del Desarrollo

### 4.1. Inicialización del Backend (Node.js + TypeScript)

1. En la raíz del proyecto, crea la carpeta `backend` e inicializa el proyecto:
   ```bash
   mkdir backend && cd backend
   npm init -y
   ```

2. Instala las dependencias principales y de desarrollo:
   ```bash
   npm install express pg dotenv @google/genai
   npm install -D typescript @types/node @types/express @types/pg tsx
   ```

3. Genera la configuración de TypeScript (`tsconfig.json`):
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

4. Agrega los scripts de inicio en `package.json`:
   ```json
   "scripts": {
     "dev": "tsx watch src/app.ts",
     "build": "tsc",
     "start": "node dist/app.ts"
   }
   ```

---

### 4.2. Inicialización del Frontend (Vite + Vue 3 + TypeScript)

1. Regresa a la raíz e inicializa el frontend con Vite:
   ```bash
   cd ..
   npm create vite@latest frontend -- --template vue-ts
   cd frontend
   ```

2. Instala dependencias claves para la UI de A.R.E.S. (Pinia para el estado y Three.js para el Avatar 3D):
   ```bash
   npm install pinia three axios
   npm install -D @types/three
   ```

3. Ejecuta el servidor de desarrollo del frontend:
   ```bash
   npm run dev
   ```

---

## Próximos Pasos Sugeridos

1. Crear la conexión a la base de datos PostgreSQL desde el servicio backend (`src/config/db.ts`).
2. Configurar el endpoint `/api/chat` en Node.js que reciba los mensajes del usuario y los envíe al SDK de Gemini.
3. Crear el componente de Vue.js `AvatarCanvas.vue` para integrar el render 3D con Three.js.