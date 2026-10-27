# AGENTS.md - Instrucciones para agentes

## Memoria persistente del proyecto

- Este repositorio mantiene un archivo de memoria persistente: `MEM.md` (en la raiz del proyecto).
- Toda tarea debe comenzar **leyendo `MEM.md`** para cargar contexto de arquitectura, decisiones de diseno, modulos clave y convenciones antes de escribir o modificar codigo.
- Toda tarea debe **actualizar `MEM.md`** al finalizar, si se modifico la arquitectura, decisiones de diseno, modulos creados o convenciones de codigo.

## Proposito

- Conservar contexto entre sesiones (terminal/chat reiniciados).
- Ahorrar tokens y ventana de contexto en cada nueva consulta.
- Mantener consistencia de codigo entre refactorizaciones y nuevas funciones.
