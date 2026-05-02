const Attendance = require("../models/Attendance");
const Marks = require("../models/Marks");
const Task = require("../models/Task");
const Submission = require("../models/Submission");
const User = require("../models/User");
const mongoose = require("mongoose");
const { Parser } = require("json2csv");
const PDFDocument = require("pdfkit");
const ExcelJS = require("exceljs");

const reportHeaders = [
  "Name",
  "Email",
  "Roll",
  "Class",
  "Attendance %",
  "Total Classes (P/A)",
  "Tasks Assigned",
  "Tasks Submitted",
  "Tasks Pending",
  "Submission Status",
  "Marks Average",
];

const getStudentAcademicRows = async (match = {}) => {
  return User.aggregate([
    { $match: { role: "student", ...match } },
    {
      $lookup: {
        from: "attendances",
        localField: "_id",
        foreignField: "studentId",
        as: "attendanceRows",
      },
    },
    {
      $lookup: {
        from: "tasks",
        let: { studentClass: "$className" },
        pipeline: [
          {
            $match: {
              $expr: {
                $or: [
                  { $eq: ["$className", "$$studentClass"] },
                  { $and: [{ $eq: [{ $ifNull: ["$className", ""] }, ""] }, { $eq: ["$$studentClass", ""] }] },
                ],
              },
            },
          },
        ],
        as: "assignedTasks",
      },
    },
    {
      $lookup: {
        from: "submissions",
        let: { sid: "$_id", taskIds: "$assignedTasks._id" },
        pipeline: [
          {
            $match: {
              $expr: { $and: [{ $eq: ["$studentId", "$$sid"] }, { $in: ["$taskId", "$$taskIds"] }] },
            },
          },
        ],
        as: "submissionRows",
      },
    },
    {
      $lookup: {
        from: "marks",
        localField: "_id",
        foreignField: "studentId",
        as: "markRows",
      },
    },
    {
      $addFields: {
        presentCount: {
          $size: {
            $filter: {
              input: "$attendanceRows",
              as: "a",
              cond: { $eq: ["$$a.status", "present"] },
            },
          },
        },
        absentCount: {
          $size: {
            $filter: {
              input: "$attendanceRows",
              as: "a",
              cond: { $eq: ["$$a.status", "absent"] },
            },
          },
        },
        totalTasks: { $size: "$assignedTasks" },
        submittedTasks: { $size: "$submissionRows" },
        marksAverage: { $round: [{ $ifNull: [{ $avg: "$markRows.score" }, 0] }, 2] },
      },
    },
    {
      $addFields: {
        totalClasses: { $add: ["$presentCount", "$absentCount"] },
        pendingTasks: { $max: [{ $subtract: ["$totalTasks", "$submittedTasks"] }, 0] },
      },
    },
    {
      $addFields: {
        attendancePercentage: {
          $cond: [
            { $gt: ["$totalClasses", 0] },
            { $round: [{ $multiply: [{ $divide: ["$presentCount", "$totalClasses"] }, 100] }, 2] },
            0,
          ],
        },
      },
    },
    {
      $project: {
        _id: 1,
        name: 1,
        email: 1,
        rollNo: 1,
        className: 1,
        attendancePercentage: 1,
        presentCount: 1,
        absentCount: 1,
        totalClasses: 1,
        totalTasks: 1,
        submittedTasks: 1,
        pendingTasks: 1,
        submissionStatus: { $cond: [{ $gt: ["$submittedTasks", 0] }, "Submitted", "Not Submitted"] },
        marksAverage: 1,
      },
    },
    { $sort: { className: 1, name: 1 } },
  ]);
};

const toReportRow = (r) => ({
  Name: r.name || "-",
  Email: r.email || "-",
  Roll: r.rollNo || "-",
  Class: r.className || "-",
  "Attendance %": Number(r.attendancePercentage || 0).toFixed(2),
  "Total Classes (P/A)": `${r.totalClasses || 0} (${r.presentCount || 0}/${r.absentCount || 0})`,
  "Tasks Assigned": r.totalTasks || 0,
  "Tasks Submitted": r.submittedTasks || 0,
  "Tasks Pending": r.pendingTasks || 0,
  "Submission Status": r.submissionStatus || "Not Submitted",
  "Marks Average": Number(r.marksAverage || 0).toFixed(2),
});

const drawReportPdfTable = (doc, rows) => {
  const cols = [90, 120, 55, 55, 50, 90, 50, 55, 50, 85, 50];
  const rowHeight = 20;
  let y = doc.y;

  const drawHeader = () => {
    let x = doc.page.margins.left;
    doc.font("Helvetica-Bold").fontSize(8);
    reportHeaders.forEach((h, idx) => {
      doc.rect(x, y, cols[idx], rowHeight).stroke();
      doc.text(h, x + 3, y + 6, { width: cols[idx] - 6, align: "left" });
      x += cols[idx];
    });
    y += rowHeight;
    doc.font("Helvetica").fontSize(8);
  };

  drawHeader();
  rows.forEach((row) => {
    if (y + rowHeight > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      y = doc.page.margins.top;
      drawHeader();
    }
    let x = doc.page.margins.left;
    const vals = Object.values(toReportRow(row));
    vals.forEach((v, idx) => {
      doc.rect(x, y, cols[idx], rowHeight).stroke();
      doc.text(String(v), x + 3, y + 6, { width: cols[idx] - 6, align: "left" });
      x += cols[idx];
    });
    y += rowHeight;
  });
};

const writeSimplePdf = (res, title, rows) => {
  const doc = new PDFDocument({ margin: 24, size: "A4", layout: "landscape" });
  res.setHeader("Content-Type", "application/pdf");
  doc.pipe(res);
  doc.fontSize(14).text(title);
  doc.moveDown(0.8);
  drawReportPdfTable(doc, rows);
  doc.end();
};

const attendanceSummary = (rows) => {
  const presentDays = rows.filter((a) => a.status === "present").length;
  const absentDays = rows.filter((a) => a.status === "absent").length;
  const total = presentDays + absentDays;
  const percentage = total ? Math.round((presentDays / total) * 100) : 0;
  return { presentDays, absentDays, percentage };
};

const buildStudentReport = async (studentId) => {
  const objectId = new mongoose.Types.ObjectId(String(studentId));
  const [full] = await getStudentAcademicRows({ _id: objectId });
  if (!full) return null;
  const [marks, submissions] = await Promise.all([
    Marks.find({ studentId: objectId }).sort({ updatedAt: -1 }),
    Submission.find({ studentId: objectId }).populate("taskId", "title subject deadline").sort({ submittedAt: -1, createdAt: -1 }),
  ]);
  return {
    student: { id: full._id, name: full.name, email: full.email, rollNo: full.rollNo, className: full.className },
    attendance: { presentDays: full.presentCount, absentDays: full.absentCount, percentage: full.attendancePercentage },
    marks: marks.map((m) => ({ id: m._id, subject: m.subject, score: m.score, remarks: m.remarks, updatedAt: m.updatedAt })),
    submissions: submissions.map((s) => ({
      id: s._id,
      status: s.status,
      submittedAt: s.submittedAt,
      marks: s.marks ?? null,
      feedback: s.feedback || "",
      file: s.file || "",
      task: s.taskId ? { id: s.taskId._id, title: s.taskId.title, subject: s.taskId.subject || "", deadline: s.taskId.deadline } : null,
    })),
    summary: {
      tasksAssigned: full.totalTasks,
      tasksSubmitted: full.submittedTasks,
      tasksPending: full.pendingTasks,
      submissionStatus: full.submissionStatus,
      averageMarks: full.marksAverage,
    },
  };
};

const getDashboardStats = async (req, res) => {
  if (req.user.role === "teacher") {
    const [totalStudents, tasksAssigned, submissionsPending, totalSubmissions] = await Promise.all([
      User.countDocuments({ role: "student" }),
      Task.countDocuments({ createdBy: req.user._id }),
      Submission.countDocuments({ status: { $in: ["submitted", "pending"] } }),
      Submission.countDocuments(),
    ]);
    const marks = await Marks.find();
    const averageMarks = marks.length ? Math.round(marks.reduce((s, m) => s + m.score, 0) / marks.length) : 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const attendanceToday = await Attendance.countDocuments({ date: today, status: "present" });
    const submissionRate = totalSubmissions ? Math.round(((totalSubmissions - submissionsPending) / totalSubmissions) * 100) : 0;
    return res.json({ totalStudents, tasksAssigned, submissionsPending, attendanceToday, averageMarks, submissionRate });
  }

  const [submissions, attendance, marks, taskCount] = await Promise.all([
    Submission.find({ studentId: req.user._id }),
    Attendance.find({ studentId: req.user._id }),
    Marks.find({ studentId: req.user._id }),
    Task.countDocuments(),
  ]);
  const completedTasks = submissions.length;
  const pendingTasks = Math.max(taskCount - completedTasks, 0);
  const attendancePercent = attendance.length
    ? Math.round((attendance.filter((a) => a.status === "present").length / attendance.length) * 100)
    : 0;
  const marksAverage = marks.length ? Math.round(marks.reduce((s, m) => s + m.score, 0) / marks.length) : 0;
  return res.json({ pendingTasks, completedTasks, attendancePercent, marksAverage });
};

const studentPdf = async (req, res) => {
  const id = req.params.id === "me" ? req.user._id : req.params.id;
  if (req.user.role === "student" && String(id) !== String(req.user._id)) {
    return res.status(403).json({ message: "Forbidden" });
  }
  const [studentRow] = await getStudentAcademicRows({ _id: new mongoose.Types.ObjectId(String(id)) });
  if (!studentRow) return res.status(404).json({ message: "Student not found." });
  writeSimplePdf(res, `Student Report - ${studentRow.name}`, [studentRow]);
};

const allPdf = async (req, res) => {
  const rows = await getStudentAcademicRows();
  writeSimplePdf(res, "All Students Academic Report", rows);
};

const allCsv = async (req, res) => {
  const rows = (await getStudentAcademicRows()).map(toReportRow);
  const csv = new Parser({ fields: reportHeaders }).parse(rows);
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=students-academic-report.csv");
  return res.send(csv);
};

const allExcel = async (req, res) => {
  const rows = (await getStudentAcademicRows()).map(toReportRow);
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Academic Report");
  ws.columns = reportHeaders.map((header) => ({ header, key: header, width: 22 }));
  rows.forEach((r) => ws.addRow(r));
  ws.getRow(1).font = { bold: true };
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", "attachment; filename=students-academic-report.xlsx");
  await wb.xlsx.write(res);
  res.end();
};

const studentReport = async (req, res) => {
  const id = req.params.id === "me" ? req.user._id : req.params.id;
  if (req.user.role === "student" && String(id) !== String(req.user._id)) {
    return res.status(403).json({ message: "Forbidden" });
  }
  const report = await buildStudentReport(id);
  if (!report) return res.status(404).json({ message: "Student not found." });
  return res.json(report);
};

const allStudentsReport = async (req, res) => {
  const rows = await getStudentAcademicRows();
  return res.json(rows.map((r) => ({
    student: { id: r._id, name: r.name, email: r.email, rollNo: r.rollNo, className: r.className },
    attendance: { percentage: r.attendancePercentage, presentDays: r.presentCount, absentDays: r.absentCount },
    summary: {
      tasksAssigned: r.totalTasks,
      tasksSubmitted: r.submittedTasks,
      tasksPending: r.pendingTasks,
      submissionStatus: r.submissionStatus,
      averageMarks: r.marksAverage,
    },
  })));
};

module.exports = {
  getDashboardStats,
  studentPdf,
  allPdf,
  allCsv,
  allExcel,
  studentReport,
  allStudentsReport,
};
