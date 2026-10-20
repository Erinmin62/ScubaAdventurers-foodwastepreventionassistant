import { Router, type IRouter } from "express";
import healthRouter from "./health";
import guardRouter from "./guard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(guardRouter);

export default router;
