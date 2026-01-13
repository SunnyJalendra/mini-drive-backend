# Mini Drive - File Sharing Application

A full-stack web app where users can upload files, manage sharing permissions, and admins can oversee all uploads.

## Features

✅ **User Authentication** - Signup/Login with JWT tokens  
✅ **File Upload** - Upload PDFs, images, and other files  
✅ **File Management** - View, download, and delete your files  
✅ **File Sharing** - Share files with access requests (View/Edit permissions)  
✅ **Admin Dashboard** - View and delete all files from any user  
✅ **Session Management** - Persistent login with JWT  

---

## Tech Stack

**Backend:**
- Node.js + Express
- MongoDB (with Mongoose)
- JWT for authentication
- Multer for file uploads
- bcryptjs for password hashing

**Frontend:**
- React
- Axios for API calls
- React Router for navigation
- Tailwind CSS for styling

---

## Backend Setup

### 1. Prerequisites
- Node.js (v14+)
- MongoDB Atlas account (free tier: https://www.mongodb.com/cloud/atlas)

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables

Create/update `.env` file:
```
PORT=5000
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/mini-drive?retryWrites=true&w=majority
JWT_SECRET=your_super_secret_key_change_this
ADMIN_CODE=admin123
```

**Get your MongoDB URI:**
1. Go to MongoDB Atlas → Create a cluster (free tier)
2. Click "Connect" → Select "Connect with the MongoDB driver"
3. Copy your connection string and replace `<password>` and `<username>`

### 4. Run Backend

**Development (with hot-reload):**
```bash
npm run dev
```

**Production:**
```bash
npm start
```

Server runs on `http://localhost:5000`

---

## API Endpoints

### Authentication
- `POST /auth/signup` - Create new user
  ```json
  { "email": "user@example.com", "password": "pass123", "adminCode": "admin123" }
  ```
- `POST /auth/login` - Login user
  ```json
  { "email": "user@example.com", "password": "pass123" }
  ```

### Files
- `POST /files/upload` - Upload file (requires auth)
- `GET /files` - List user's files (requires auth)
- `GET /files/:id` - Download a file (if owner/admin or shared)
- `DELETE /files/:id` - Delete file (owner or admin only)
- `POST /files/share/:id/request` - Request access to a shared file
- `POST /files/share/:id/respond` - Owner approves/rejects access request

### Admin
- `GET /admin/files` - View all files (admin only)
- `DELETE /admin/files/:id` - Delete any file (admin only)

---

## Frontend Setup

Create a separate React app:

```bash
npx create-react-app mini-drive-frontend
cd mini-drive-frontend
npm install axios react-router-dom
```

### Connect to Backend

Update `src/api.js`:
```javascript
import axios from 'axios';

const API = axios.create({
  baseURL: 'http://localhost:5000',
  headers: { 'Content-Type': 'application/json' }
});

export const setAuthToken = (token) => {
  if (token) API.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  else delete API.defaults.headers.common['Authorization'];
};

export default API;
```

### Example Login Component

```javascript
import { useState } from 'react';
import API, { setAuthToken } from './api';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const { data } = await API.post('/auth/login', { email, password });
      localStorage.setItem('token', data.token);
      setAuthToken(data.token);
      // Redirect to dashboard
    } catch (err) {
      alert('Login failed: ' + err.response.data.message);
    }
  };

  return (
    <form onSubmit={handleLogin}>
      <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <button type="submit">Login</button>
    </form>
  );
}
```

---

## Deployment

### Deploy Backend to Render

1. Push your code to GitHub
2. Go to https://render.com
3. Click "New +" → "Web Service"
4. Connect your GitHub repo
5. **Settings:**
   - Build Command: `npm install`
   - Start Command: `npm start`
   - Add Environment Variables:
     ```
     MONGO_URI=your_mongodb_atlas_uri
     JWT_SECRET=your_secret_key
     ADMIN_CODE=admin123
     PORT=5000
     ```
6. Deploy!

Get your backend URL: `https://your-app.onrender.com`

### Deploy Frontend to Vercel

1. Go to https://vercel.com
2. Import your frontend repo from GitHub
3. Add environment variable:
   ```
   REACT_APP_API_URL=https://your-app.onrender.com
   ```
4. Deploy!

Update `src/api.js` to use the env var:
```javascript
const API = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000'
});
```

---

## Testing the API

Use Postman or curl:

```bash
# Signup
curl -X POST http://localhost:5000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"user@test.com","password":"pass123"}'

# Login
curl -X POST http://localhost:5000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@test.com","password":"pass123"}'

# Upload file (use returned token)
curl -X POST http://localhost:5000/files/upload \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@/path/to/file.pdf"

# List files
curl -X GET http://localhost:5000/files \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## File Structure

```
mini-drive-backend/
├── models/
│   ├── User.js
│   ├── File.js
│   └── ShareRequest.js
├── routes/
│   ├── authRoutes.js
│   ├── fileRoutes.js
│   └── adminRoutes.js
├── middleware/
│   └── authMiddleware.js
├── utils/
│   └── multerConfig.js
├── uploads/          # Files stored here
├── server.js
├── package.json
└── .env
```

---

## Troubleshooting

**MongoDB connection error:**
- Ensure your IP is whitelisted in MongoDB Atlas
- Check connection string format
- Verify username/password are URL-encoded

**Files not uploading:**
- Ensure `uploads/` folder has write permissions
- Check file size limits (default: unlimited)
- Verify auth token is valid

**CORS errors:**
- Frontend and backend must have matching origin
- Update `cors()` in server.js if needed

---

## License

ISC
