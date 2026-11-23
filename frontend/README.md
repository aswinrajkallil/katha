# Katha

A MERN-stack web app where users share stories and interact with them.

**Live:** [katha.aswinraj.dev](https://katha.aswinraj.dev)

## Features

- Share stories and interact with stories from other users
- JWT-based authentication
- Role-based access control
- Image uploads via Cloudinary
- REST API backend

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React.js |
| Backend | Node.js, Express.js |
| Database | MongoDB |
| Auth | JSON Web Tokens (JWT) |
| Media | Cloudinary |
| Deployment | Vercel (frontend), Render (backend) |

## Getting Started

### Prerequisites

- Node.js (v18 or later recommended)
- A MongoDB database (local or MongoDB Atlas)
- A Cloudinary account

### Installation

```bash
git clone https://github.com/aswinrajkallil/katha.git
cd katha
```

Install dependencies for the frontend and backend (adjust folder names to match the repo):

```bash
cd server && npm install
cd ../client && npm install
```

### Environment Variables

Create a `.env` file in the backend folder. Variable names below are examples; match them to what your code reads.

```env
PORT=5000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

Create a `.env` file in the frontend folder pointing to your API:

```env
VITE_API_URL=http://localhost:5000
```

(Use `REACT_APP_API_URL` instead if the frontend uses Create React App.)

### Run Locally

```bash
# Backend
cd server
npm run dev

# Frontend (in a second terminal)
cd client
npm run dev
```

## Deployment

- **Frontend:** deployed on Vercel
- **Backend:** deployed on Render

When deploying separately, set the backend's allowed CORS origin to your frontend URL and set the frontend's API URL to your backend URL.

## Author

**Aswin Raj**

- GitHub: [@aswinrajkallil](https://github.com/aswinrajkallil)
- Portfolio: [aswinraj.dev](https://aswinraj.dev)
- LinkedIn: [linkedin.com/in/aswinrajkallil](https://linkedin.com/in/aswinrajkallil)