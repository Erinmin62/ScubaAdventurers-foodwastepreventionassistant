import { Router, type IRouter } from "express";
import healthRouter from "./health";
import guardRouter from "./guard";
import guardMenuRouter from "./guard-menu";
import guardAiForecastDemoRouter from "./guard-ai-forecast-demo";
import reorderRouter from "./guard-reorders";
import notificationsRouter from "./guard-notifications";
import inboxRouter from "./guard-inbox";
import emailHistoryRouter from "./guard-email-history";
import { ownerAuth } from "../middlewares/owner-auth";
import { createIngredientPhotoRouter } from "./ingredient-photos";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/guard", ownerAuth);
router.use("/storage", ownerAuth, createIngredientPhotoRouter());
router.use(guardRouter);
router.use(guardAiForecastDemoRouter);
router.use(guardMenuRouter);
router.use(reorderRouter);
router.use(notificationsRouter);
router.use(inboxRouter);
router.use(emailHistoryRouter);

export default router;
