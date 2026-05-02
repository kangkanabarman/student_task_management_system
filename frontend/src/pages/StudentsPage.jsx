import { useState, useEffect } from 'react';
import api from '../api/client';
import { useTheme } from "../context/useTheme";

const StudentsPage = () => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const { isDark } = useTheme();

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError('');
        const response = await api.get('/users/teacher/students/full-data');
        setStudents(response.data || []);
      } catch {
        setError('Failed to load students');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="p-8 text-center">Loading students...</div>;
  if (error) return <div className="p-8 text-center text-red-600">{error}</div>;
  const filtered = students.filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return [s.name, s.email, s.studentId, s.className].some((v) => String(v || "").toLowerCase().includes(q));
  });

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className={`text-3xl font-bold ${isDark ? "text-slate-100" : "text-gray-900"}`}>Student Directory</h1>
          <p className={isDark ? "text-slate-300" : "text-gray-600"}>Manage student records and statistics</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            className={`flex-1 rounded-lg border px-4 py-2 focus:border-blue-500 focus:outline-none ${isDark ? "border-slate-700 bg-slate-900 text-slate-100" : "border-gray-200 bg-white text-slate-900"}`}
            placeholder="Search by name, email, student ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className={`overflow-x-auto rounded-lg border shadow ${isDark ? "border-slate-700 bg-slate-900" : "border-gray-200 bg-white"}`}>
        <table className={`min-w-full divide-y ${isDark ? "divide-slate-700" : "divide-gray-200"}`}>
          <thead className={isDark ? "bg-slate-800" : "bg-gray-50"}>
            <tr>
              <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-500">Student ID</th>
              <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-500">Name</th>
              <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-500">Email</th>
              <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-500">Class</th>
              <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-500">Att. %</th>
              <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-500">Avg Marks</th>
              <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-500">Total Tasks</th>
              <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-500">Submitted</th>
              <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider text-gray-500">Pending</th>
            </tr>
          </thead>
          <tbody className={`divide-y ${isDark ? "divide-slate-700" : "divide-gray-200"}`}>
            {filtered.map((student) => (
              <tr key={student._id} className={isDark ? "hover:bg-slate-800" : "hover:bg-gray-50"}>
                <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${isDark ? "text-slate-100" : "text-gray-900"}`}>
                  {student.studentId || 'N/A'}
                </td>
                <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${isDark ? "text-slate-100" : "text-gray-900"}`}>
                  {student.name}
                </td>
                <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDark ? "text-slate-300" : "text-gray-600"}`}>
                  {student.email}
                </td>
                <td className={`px-6 py-4 whitespace-nowrap text-sm ${isDark ? "text-slate-300" : "text-gray-600"}`}>
                  {student.className || 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-medium">
                  {Number(student.attendancePct || 0).toFixed(2)}%
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  {Number(student.avgMarks || 0).toFixed(2)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">{student.taskStats?.totalTasks ?? 0}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">{student.taskStats?.submitted ?? 0}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">{student.taskStats?.pending ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default StudentsPage;

