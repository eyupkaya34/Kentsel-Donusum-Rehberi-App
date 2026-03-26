import { Router, type IRouter } from "express";
import healthRouter from "./health";
import anthropicRouter from "./anthropic/index";
import paymentRouter from "./payment/index";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/anthropic", anthropicRouter);
router.use("/payment", paymentRouter);

export default router;
