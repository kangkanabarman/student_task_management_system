const User = require("../models/User");
const Attendance = require("../models/Attendance");
const Marks = require("../models/Marks");
const Task = require("../models/Task");
const Submission = require("../models/Submission");

const getStudents = async (req, res) => {
  const { search = "", className = "", page = 1, limit = 10 } = req.query;
  const query = { role: "student" };
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
      { rollNo: { $regex: search, $options: "i" } },
    ];
  }
  if (className) query.className = className;
  const skip = (Number(page) - 1) * Number(limit);
  const [rows, total] = await Promise.all([User.find(query).select("-password").sort({ createdAt: -1 }).skip(skip).limit(Number(limit)), User.countDocuments(query)]);
  const students = rows.map((r) => r.toObject());
  const studentIds = students.map((s) => s._id);
  const classNames = [...new Set(students.map((s) => s.className || ""))];
  const [attendanceRows, marksRows, tasks, submissions] = await Promise.all([
    Attendance.find({ studentId: { $in: studentIds } }).select("studentId status"),
    Marks.find({ studentId: { $in: studentIds } }).select("studentId score"),
    Task.find({ className: { $in: classNames } }).select("_id className"),
    Submission.find({ studentId: { $in: studentIds } }).select("studentId taskId"),
  ]);

  const attendanceMap = new Map();
  attendanceRows.forEach((a) => {
    const key = String(a.studentId);
    if (!attendanceMap.has(key)) attendanceMap.set(key, { present: 0, absent: 0 });
    if (a.status === "present") attendanceMap.get(key).present += 1;
    if (a.status === "absent") attendanceMap.get(key).absent += 1;
  });

  const marksMap = new Map();
  marksRows.forEach((m) => {
    const key = String(m.studentId);
    if (!marksMap.has(key)) marksMap.set(key, []);
    marksMap.get(key).push(m.score);
  });

  const tasksByClass = new Map();
  tasks.forEach((t) => {
    const key = t.className || "";
    if (!tasksByClass.has(key)) tasksByClass.set(key, []);
    tasksByClass.get(key).push(String(t._id));
  });

  const submissionMap = new Map();
  submissions.forEach((s) => {
    const key = String(s.studentId);
    if (!submissionMap.has(key)) submissionMap.set(key, new Set());
    submissionMap.get(key).add(String(s.taskId));
  });

  const enriched = students.map((student) => {
    const sid = String(student._id);
    const att = attendanceMap.get(sid) || { present: 0, absent: 0 };
    const totalAttendance = att.present + att.absent;
    const attendancePct = totalAttendance ? Math.round((att.present / totalAttendance) * 100) : 0;
    const marks = marksMap.get(sid) || [];
    const avgMarks = marks.length ? Math.round(marks.reduce((sum, val) => sum + val, 0) / marks.length) : 0;
    const totalTasks = (tasksByClass.get(student.className || "") || []).length;
    const submitted = submissionMap.get(sid)?.size || 0;
    return {
      ...student,
      attendancePct,
      avgMarks,
      taskStats: {
        totalTasks,
        submitted,
        pending: Math.max(totalTasks - submitted, 0),
      },
    };
  });

  return res.json({ data: enriched, pagination: { page: Number(page), limit: Number(limit), total } });
};

const getStudentProfile = async (req, res) => {
  const student = await User.findOne({ _id: req.params.id, role: "student" }).select("-password");
  if (!student) return res.status(404).json({ message: "Student not found." });
  const [attendance, marks] = await Promise.all([
    Attendance.find({ studentId: student._id }),
    Marks.find({ studentId: student._id }),
  ]);
  const attendancePct = attendance.length
    ? Math.round((attendance.filter((a) => a.status === "present").length / attendance.length) * 100)
    : 0;
  const avgMarks = marks.length ? Math.round(marks.reduce((sum, m) => sum + m.score, 0) / marks.length) : 0;
  return res.json({ student, attendancePct, avgMarks });
};

const getStudentsFullData = async (req, res) => {
  const rows = await User.aggregate([
    { $match: { role: "student" } },
    { $lookup: { from: "attendances", localField: "_id", foreignField: "studentId", as: "attendanceRows" } },
    { $lookup: { from: "marks", localField: "_id", foreignField: "studentId", as: "markRows" } },
    {
      $lookup: {
        from: "tasks",
        let: { cls: "$className" },
        pipeline: [{ $match: { $expr: { $eq: ["$className", "$$cls"] } } }],
        as: "classTasks",
      },
    },
    {
      $lookup: {
        from: "submissions",
        let: { sid: "$_id", classTaskIds: "$classTasks._id" },
        pipeline: [{ $match: { $expr: { $and: [{ $eq: ["$studentId", "$$sid"] }, { $in: ["$taskId", "$$classTaskIds"] }] } } }],
        as: "submissionRows",
      },
    },
    {
      $addFields: {
        present: { $size: { $filter: { input: "$attendanceRows", as: "a", cond: { $eq: ["$$a.status", "present"] } } } },
        absent: { $size: { $filter: { input: "$attendanceRows", as: "a", cond: { $eq: ["$$a.status", "absent"] } } } },
        avgMarks: { $round: [{ $ifNull: [{ $avg: "$markRows.score" }, 0] }, 2] },
        totalTasks: { $size: "$classTasks" },
        submittedTasks: { $size: "$submissionRows" },
      },
    },
    {
      $addFields: {
        attendancePct: {
          $cond: [
            { $gt: [{ $add: ["$present", "$absent"] }, 0] },
            { $round: [{ $multiply: [{ $divide: ["$present", { $add: ["$present", "$absent"] }] }, 100] }, 2] },
            0,
          ],
        },
      },
    },
    {
      $project: {
        _id: 1,
        studentId: "$rollNo",
        name: 1,
        email: 1,
        className: 1,
        attendancePct: 1,
        avgMarks: 1,
        taskStats: {
          totalTasks: "$totalTasks",
          submitted: "$submittedTasks",
          pending: { $max: [{ $subtract: ["$totalTasks", "$submittedTasks"] }, 0] },
        },
      },
    },
    { $sort: { className: 1, name: 1 } },
  ]);
  return res.json(rows);
};

module.exports = { getStudents, getStudentProfile, getStudentsFullData };

