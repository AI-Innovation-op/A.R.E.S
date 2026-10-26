-- Preferencia para proyectos nuevos; no reescribe proyectos existentes.
ALTER TABLE repositories ALTER COLUMN architecture_pattern SET DEFAULT 'DDD + Hexagonal';
