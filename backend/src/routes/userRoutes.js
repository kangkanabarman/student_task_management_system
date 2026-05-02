const express = require("express");
const { protect, allowTeacher } = require("../middleware/authMiddleware");
const { getStudents, getStudentProfile, getStudentsFullData } = require("../controllers/userController");

const router = express.Router();

router.get("/", protect, allowTeacher, getStudents);
router.get("/teacher/students/full-data", protect, allowTeacher, getStudentsFullData);
router.get("/:id", protect, allowTeacher, getStudentProfile);

module.exports = router;

