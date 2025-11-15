import { Router } from "express";
import { ContentController } from "../controllers/ContentController";

const router = Router();
const ctrl = new ContentController();

router.post("/users", ctrl.createUser.bind(ctrl));
router.post("/movies", ctrl.createMovie.bind(ctrl));
router.post("/tv", ctrl.createTvShow.bind(ctrl));

export default router;
