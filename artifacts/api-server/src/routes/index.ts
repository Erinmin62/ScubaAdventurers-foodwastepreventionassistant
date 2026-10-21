import { Router, type IRouter } from "express";
import healthRouter from "./health";
import guardRouter from "./guard";
import reorderRouter from "./guard-reorders";
import notificationsRouter from "./guard-notifications";
import inboxRouter from "./guard-inbox";

const router: IRouter = Router();

router.use(healthRouter);
router.use(guardRouter);
router.use(reorderRouter);
router.use(notificationsRouter);
router.use(inboxRouter);

export default router;
