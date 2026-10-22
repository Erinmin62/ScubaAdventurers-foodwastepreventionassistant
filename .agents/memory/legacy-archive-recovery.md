---
name: Legacy archive recovery
description: How to treat archive imports that predate explicit batch metadata.
---

Treat legacy rows sharing an import timestamp as one recoverable batch and explicitly label their original file name as unavailable. Never invent a source file name or treat the record date as the import date.

**Why:** The earlier importer retained a shared server timestamp per import but discarded the source file name. Timestamp grouping is the available approximation, not proof of distinct files if two old imports happened at precisely the same instant.

**How to apply:** Preserve this limitation in archive review, removal, export, or later migration work; new imports must remain distinguishable even when the file name or timestamp is identical.
