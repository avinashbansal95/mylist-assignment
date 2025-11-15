import { Router } from "express";
import { MyListController } from "../controllers/MyListController";
import { MyListService } from "../services/MyListService";

const router = Router();
const service = new MyListService();
const controller = new MyListController(service);

router.get("/", controller.list);
router.post("/", controller.add);
router.delete("/:itemId", controller.remove);

export default router;
