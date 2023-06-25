import express from "express";
import {
  contact,
  courseRequest,
  getDashboardStats,
} from "../controllers/otherControllers.js";
import { isAuthenticated, authorizeAdmin } from "../middlewares/auth.js";
const router = express.Router();

// contact form
router.route("/contact").post(contact);

// Request form
router.route("/courserequest").post(courseRequest);

// Get admin dashboard stats
router
  .route("/admin/stats")
  .get(isAuthenticated, authorizeAdmin, getDashboardStats);
export default router;
