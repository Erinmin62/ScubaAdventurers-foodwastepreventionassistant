import { Router, type IRouter } from "express";
import healthRouter from "./health";
import guardRouter from "./guard";
import reorderRouter from "./guard-reorders";

const router: IRouter = Router();

router.use(healthRouter);
router.use(guardRouter);
router.use(reorderRouter);

export default router;
