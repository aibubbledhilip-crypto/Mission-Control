import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import tenantsRouter from "./tenants";
import usersRouter from "./users";
import dataSourcesRouter from "./data-sources";
import journeysRouter from "./journeys";
import journeyNodesRouter from "./journey-nodes";
import activityRouter from "./activity";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(tenantsRouter);
router.use(usersRouter);
router.use(dataSourcesRouter);
router.use(journeysRouter);
router.use(journeyNodesRouter);
router.use(activityRouter);
router.use(dashboardRouter);

export default router;
