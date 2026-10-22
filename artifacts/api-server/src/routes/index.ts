import { Router, type IRouter } from "express";
import healthRouter from "./health";
import guardRouter from "./guard";
import guardMenuRouter from "./guard-menu";
import reorderRouter from "./guard-reorders";
import notificationsRouter from "./guard-notifications";
import inboxRouter from "./guard-inbox";
import { ownerAuth } from "../middlewares/owner-auth";
import { createIngredientPhotoRouter } from "./ingredient-photos";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/guard", ownerAuth);
router.use("/storage", ownerAuth, createIngredientPhotoRouter());
router.use(guardRouter);
router.use(guardMenuRouter);
router.use(reorderRouter);
router.use(notificationsRouter);
router.use(inboxRouter);

export default router;
