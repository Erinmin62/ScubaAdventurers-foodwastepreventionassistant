---
name: Food SME product scope
description: Product audience and demo-stage constraints for ExpiryGuardAI.
---

ExpiryGuardAI is a demonstration for food-and-beverage SMEs broadly, including cafes, restaurants, food vendors, and cloud kitchens. It is not a complete production deployment, and product flows must not be hardcoded to cafes alone.

**Why:** The user's main goal is to demonstrate a reusable solution to food waste across different food-related SMEs.

**How to apply:** Prefer configurable business types, menus, ingredients, and workflows where needed. Label demo-only or synthetic capabilities clearly, and don't imply production readiness.

Business type is profile information only for now; selecting a cafe, restaurant, food vendor, cloud kitchen, or other type must not silently change forecasts, inventory rules, safety checks, or automation.

**Why:** The current data is synthetic, and different operating rules have not been validated for each business type.

**How to apply:** Keep shared demo behavior explicit until business-specific workflows are supported by real requirements and tested data.
