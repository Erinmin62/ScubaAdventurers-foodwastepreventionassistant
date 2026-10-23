---
name: Measurement ordering
description: Rationale for conservative inventory updates when measurements have only calendar dates
---

Treat same-day inventory measurements as ambiguous rather than assuming a follow-up observation is newer.

**Why:** Measurements currently have day precision, not a time of observation. Submission time is not observation time: an owner may submit a morning observation after a later stock count. Allowing equal-date replacement could silently overwrite the newer count.

**How to apply:** Keep same-day inventory unchanged when saving a follow-up, explain the skipped update, and preserve the outcome independently. If same-day replacement is required later, introduce actual observation-time ordering or an explicit conflict-resolution flow rather than comparing submission timestamps.
