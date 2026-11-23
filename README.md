<div align="center">

# 📖 Katha

**A MERN-stack web app where users share stories and interact with them.**

[![Live Demo](https://img.shields.io/badge/Live-katha.aswinraj.dev-success?style=for-the-badge)](https://katha.aswinraj.dev)

![React](https://img.shields.io/badge/React-20232A?style=flat&logo=react&logoColor=61DAFB)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat&logo=nodedotjs&logoColor=white)
![Express](https://img.shields.io/badge/Express-000000?style=flat&logo=express&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=flat&logo=mongodb&logoColor=white)
![JWT](https://img.shields.io/badge/JWT-000000?style=flat&logo=jsonwebtokens&logoColor=white)
![Cloudinary](https://img.shields.io/badge/Cloudinary-3448C5?style=flat&logo=cloudinary&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-000000?style=flat&logo=vercel&logoColor=white)
![Render](https://img.shields.io/badge/Render-46E3B7?style=flat&logo=render&logoColor=white)

[Live Demo](https://katha.aswinraj.dev) · [Features](#-features) · [Tech Stack](#-tech-stack) · [Getting Started](#-getting-started) · [Deployment](#-deployment)

</div>

---

## ✨ Features

- 📝 Share stories and interact with stories from other users
- 🔐 JWT-based authentication
- 🔑 Password reset by emailed single-use link (users and admins)
- 🛡️ Role-based access control
- 🖼️ Image uploads via Cloudinary
- 🔌 REST API backend

## 🛠️ Tech Stack

| Layer | Technology |
| --- | --- |
| **Frontend** | React.js |
| **Backend** | Node.js, Express.js |
| **Database** | MongoDB |
| **Authentication** | JSON Web Tokens (JWT) |
| **Media Storage** | Cloudinary |
| **Deployment** | Vercel (frontend), Render (backend) |

## 📁 Project Structure

```
katha/
├── frontend/   # React.js client
└── backend/    # Node.js + Express REST API
```

## 🚀 Getting Started

### Prerequisites

- Node.js (v18 or later recommended)
- A MongoDB database (local or MongoDB Atlas)
- A Cloudinary account

### 1. Clone the repository

```bash
git clone https://github.com/aswinrajkallil/katha.git
cd katha
```

### 2. Set up the backend

```bash
cd backend
npm install
```

Create a `.env` file in `backend/` (variable names are examples; match them to what your code reads):

```env
PORT=5000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Password reset emails (any SMTP provider). FRONTEND_URL is used to build the reset links.
FRONTEND_URL=http://localhost:5173
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_smtp_username
SMTP_PASS=your_smtp_password
EMAIL_FROM="Kathā <no-reply@example.com>"
```

> In development, if the `SMTP_*` variables are not set, the password reset link is printed to the
> backend console instead of being emailed. In production they are required.

Start the server:

```bash
npm run dev
```

### 3. Set up the frontend

Open a second terminal:

```bash
cd frontend
npm install
```

Create a `.env` file in `frontend/` pointing to your API:

```env
VITE_API_URL=http://localhost:5000
```

> Use `REACT_APP_API_URL` instead if the frontend uses Create React App.

Start the app:

```bash
npm run dev
```

## 🌐 Deployment

| Part | Platform |
| --- | --- |
| Frontend | [Vercel](https://vercel.com) |
| Backend | [Render](https://render.com) |

When deploying separately, set the backend's allowed CORS origin to your frontend URL, and set the frontend's API URL to your backend URL.

## 👨‍💻 Author

**Aswin Raj**

[![GitHub](https://img.shields.io/badge/GitHub-aswinrajkallil-181717?style=flat&logo=github)](https://github.com/aswinrajkallil)
[![Portfolio](https://img.shields.io/badge/Portfolio-aswinraj.dev-blue?style=flat&logo=googlechrome&logoColor=white)](https://aswinraj.dev)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-aswinrajkallil-0A66C2?style=flat&logo=linkedin)](https://linkedin.com/in/aswinrajkallil)

---

<div align="center">

⭐ If you like this project, consider giving it a star!

</div>
