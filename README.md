🎓 Student task/attendance/marks Management System

A full-stack MERN (MongoDB, Express, React, Node.js) web application to manage Tasks, Attendance, and Marks with role-based access for Teachers and Students.

⸻

🚀 Features

* 🔐 Authentication (JWT-based login/register)
* 👩‍🏫 Teacher Dashboard
    * Create & manage tasks
    * Mark attendance
    * Assign marks
    * Review submissions
* 👨‍🎓 Student Dashboard
    * View tasks & submit work
    * Track attendance
    * Check marks
* 📊 Reports (PDF & CSV)
* 🐳 Docker & ☸️ Kubernetes ready

⸻

🏗️ Tech Stack

Frontend: React (Vite)
Backend: Node.js + Express
Database: MongoDB
DevOps: Docker, Kubernetes

⸻

📁 Project Structure

backend/
  src/
    config/
    controllers/
    middleware/
    models/
    routes/
    tests/

frontend/
  src/
    api/
    components/
    context/
    layouts/
    pages/
    utils/

⸻

⚙️ Environment Setup

Backend (.env)
PORT=5000
MONGO_URI=mongodb://localhost:27017/academic_management
JWT_SECRET=your_secure_secret

Frontend (.env)
VITE_API_URL=http://localhost:5000

⸻

🌱 Seed Demo Data

Run:
npm run seed –prefix backend

Demo Users:
Teacher → teacher@test.com / 123456
Student → student1@test.com / 123456
Student → student2@test.com / 123456

⸻

▶️ Run Locally

npm install –prefix backend
npm install –prefix frontend

npm run dev –prefix backend
npm run dev –prefix frontend

⸻

🔗 API Endpoints

Auth:
POST /api/auth/register
POST /api/auth/login
GET /api/auth/me

Tasks:
GET /api/tasks
POST /api/tasks
PUT /api/tasks/:id
DELETE /api/tasks/:id

Submissions:
POST /api/submissions/:taskId
GET /api/submissions/task/:taskId
PUT /api/submissions/:id/review

Attendance:
POST /api/attendance/request
POST /api/attendance/mark
GET /api/attendance/student/:id
GET /api/attendance/all

Marks:
POST /api/marks
GET /api/marks/student/:id

Reports:
GET /api/reports/student/:id/pdf
GET /api/reports/all/pdf
GET /api/reports/all/csv

⸻

🚀 Deployment

1. Setup MongoDB (Atlas/local)
2. Set environment variables
3. Build frontend:
    npm run build –prefix frontend
4. Start backend:
    npm run start –prefix backend
5. Deploy frontend (Vercel/Netlify/Nginx)
6. Update VITE_API_URL

⸻

👩‍💻 Author

Kangkana Barman
CSE Student | Full Stack Developer
