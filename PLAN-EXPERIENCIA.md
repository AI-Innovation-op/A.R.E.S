# Siguiente etapa autorizada

Orden acordado el 26 de octubre de 2026. No confundir implementación con comprobación contra servicios reales.

1. [x] Caso DDD completo: documentación, propuesta, diff, aplicación, comprobación aislada y restauración. Proveedor simulado; PostgreSQL/Docker reales, fallo inicial → tres pruebas aprobadas → fallo esperado tras restaurar. Datos de prueba limpiados.
2. [x] Mermaid: zoom, paneo y exportación SVG/PNG. Chrome verificó secuencia, ER, C4, archivos descargados reales, móvil y rechazo de contenido activo.
3. [x] Reglas de dependencia DDD sobre archivos seleccionados: AST JS/TS, huellas, alias, hallazgos e incertidumbres. Pruebas de dominio, API y Chrome aprobadas.
4. [ ] Verificaciones externas: GitHub real completado ([PR borrador #1](https://github.com/AI-Innovation-op/A.R.E.S/pull/1)); micrófono físico confirmado por el usuario con «ARES». Google Search sigue devolviendo 429 GEMINI_QUOTA; queda pendiente repetir cuando haya cuota.
5. [x] Efectos Matrix/neón y conversación española por turnos: activación explícita, «ARES», cierre «okey», transcripción, detener/cancelar y documentación opcional en Biblioteca.

El modo conversación debe admitir ayuda cotidiana sin fingir acceso a correo, calendario, archivos o dispositivos. Las conexiones a accesorios inteligentes pertenecen a una etapa posterior. La voz debe detener la captura durante su propia reproducción para evitar enviarse a sí misma. No activar el micrófono al cargar la página.

Orus se evaluó como alternativa opcional: requeriría llamadas de generación de audio a Gemini. En esta etapa se conserva la síntesis española Web Speech, ya comprobada; Orus no está integrado. Compartir por Internet no es requisito para esta etapa local. Las conexiones a dispositivos se mantienen pendientes para la etapa que el usuario solicite después.
