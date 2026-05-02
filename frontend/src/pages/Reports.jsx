import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import api from "../api/client";
import { downloadFile } from "../utils/download";
import { useAuth } from "../context/useAuth";
import { useTheme } from "../context/useTheme";

const Reports = () => {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const [loading, setLoading] = useState(false);
  const [myReport, setMyReport] = useState(null);
  const [all, setAll] = useState([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        if (user.role === "student") {
          const res = await api.get("/reports/student/me");
          setMyReport(res.data);
        } else {
          const res = await api.get("/reports/all-students");
          setAll(res.data || []);
        }
      } catch (err) {
        toast.error(err.response?.data?.message || "Failed to load reports");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [user.role]);

  return (
    <div>
      <h2 className="mb-4 text-xl font-bold">Reports</h2>
      <p className="mb-4 text-sm text-slate-600">{user.role === "student" ? "Download your own reports" : "Download institution-wide reports"}</p>
      <div className="grid gap-3 md:grid-cols-2">
        {user.role === "student" && <button className="rounded bg-blue-600 p-3 text-white" onClick={() => downloadFile("/reports/student/me/pdf", "my-report.pdf")}>Download Personal PDF</button>}
        {user.role === "teacher" && <button className="rounded bg-blue-600 p-3 text-white" onClick={() => downloadFile("/reports/all/pdf", "all-students.pdf")}>Download All Students PDF</button>}
        {user.role === "teacher" && <button className="rounded bg-emerald-600 p-3 text-white" onClick={() => downloadFile("/reports/all/csv", "all-students.csv")}>Download CSV</button>}
        {user.role === "teacher" && <button className="rounded bg-indigo-600 p-3 text-white" onClick={() => downloadFile("/reports/all/excel", "all-students.xlsx")}>Download Excel</button>}
      </div>
      {loading && <div className={`mt-4 rounded p-4 text-sm shadow ${isDark ? "bg-slate-900 text-slate-300" : "bg-white text-slate-600"}`}>Loading report data...</div>}

      {user.role === "teacher" && !!all.length && (
        <div className={`mt-6 overflow-x-auto rounded shadow ${isDark ? "bg-slate-900" : "bg-white"}`}>
          <table className="min-w-full text-sm">
            <thead className={isDark ? "bg-slate-800" : "bg-slate-100"}>
              <tr>
                <th className="p-2 text-left">Name</th>
                <th className="p-2 text-left">Email</th>
                <th className="p-2 text-left">Roll</th>
                <th className="p-2 text-left">Class</th>
                <th className="p-2 text-left">Attendance %</th>
                <th className="p-2 text-left">Total Classes (P/A)</th>
                <th className="p-2 text-left">Assigned</th>
                <th className="p-2 text-left">Submitted</th>
                <th className="p-2 text-left">Pending</th>
                <th className="p-2 text-left">Status</th>
                <th className="p-2 text-left">Avg Marks</th>
              </tr>
            </thead>
            <tbody>
              {all.map((r) => (
                <tr key={r.student.id} className={`border-t ${isDark ? "border-slate-700" : "border-slate-200"}`}>
                  <td className="p-2">{r.student.name}</td>
                  <td className="p-2">{r.student.email}</td>
                  <td className="p-2">{r.student.rollNo || "-"}</td>
                  <td className="p-2">{r.student.className || "-"}</td>
                  <td className="p-2">{r.attendance.percentage}%</td>
                  <td className="p-2">{r.attendance.presentDays + r.attendance.absentDays} ({r.attendance.presentDays}/{r.attendance.absentDays})</td>
                  <td className="p-2">{r.summary.tasksAssigned}</td>
                  <td className="p-2">{r.summary.tasksSubmitted}</td>
                  <td className="p-2">{r.summary.tasksPending}</td>
                  <td className="p-2">{r.summary.submissionStatus}</td>
                  <td className="p-2">{r.summary.averageMarks}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {user.role === "student" && myReport && (
        <div className={`mt-6 rounded p-4 shadow ${isDark ? "bg-slate-900" : "bg-white"}`}>
          <p>{myReport.student.name} ({myReport.student.rollNo || "-"})</p>
          <p className="text-sm">Attendance: {myReport.attendance.percentage}% | Tasks: {myReport.summary.tasksSubmitted}/{myReport.summary.tasksAssigned} | Avg: {myReport.summary.averageMarks}</p>
        </div>
      )}
    </div>
  );
};

export default Reports;
