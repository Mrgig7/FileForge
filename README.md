<p align="center">
  <img src="https://img.shields.io/badge/FileForge-Premium%20File%20Sharing-8B5CF6?style=for-the-badge&logo=files&logoColor=white" alt="FileForge Banner"/>
</p>

<h1 align="center">
  🚀 FileForge
</h1>

<p align="center">
  <strong>A Premium, Immersive File Sharing Platform with Stunning 3D Visuals</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-19.0.0-61DAFB?style=flat-square&logo=react&logoColor=white" alt="React"/>
  <img src="https://img.shields.io/badge/Three.js-r182-000000?style=flat-square&logo=three.js&logoColor=white" alt="Three.js"/>
  <img src="https://img.shields.io/badge/Node.js-Express-339933?style=flat-square&logo=node.js&logoColor=white" alt="Node.js"/>
  <img src="https://img.shields.io/badge/MongoDB-Atlas-47A248?style=flat-square&logo=mongodb&logoColor=white" alt="MongoDB"/>
  <img src="https://img.shields.io/badge/Cloudinary-Storage-3448C5?style=flat-square&logo=cloudinary&logoColor=white" alt="Cloudinary"/>
  <img src="https://img.shields.io/badge/TailwindCSS-4.1-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white" alt="Tailwind"/>
</p>

<p align="center">
  <a href="#-features">Features</a> •
  <a href="#-tech-stack">Tech Stack</a> •
  <a href="#-installation">Installation</a> •
  <a href="#-usage">Usage</a> •
  <a href="#-api-endpoints">API</a> •
  <a href="#-deployment">Deployment</a>
</p>

---

## ✨ Overview

**FileForge** is not just another file-sharing platform—it's an **immersive experience**. Built with cutting-edge web technologies, FileForge combines the functionality of secure file management with a stunning **3D animated interface** powered by Three.js and React Three Fiber.

Whether you're sharing documents, images, videos, or code files, FileForge makes it memorable with:
- 🌌 **Space-themed 3D environments** with floating particles and dynamic camera rigs
- ⚡ **Lightning-fast file uploads** with chunked upload support
- 📱 **QR code generation** for instant mobile sharing
- 👁️ **In-browser document preview** for 50+ file types
- 🔐 **Secure authentication** with JWT tokens

---

## 🎯 Features

### 🎨 Immersive 3D User Interface
- **Stunning 3D Scenes**: Each page features unique Three.js environments with animated particles, warp effects, and glowing elements
- **Smooth Transitions**: Framer Motion-powered animations for fluid page transitions
- **Dark Theme**: Premium dark mode design with glassmorphism effects
- **Responsive Design**: Works beautifully on all devices from mobile to desktop

### 📤 Advanced File Upload
- **Drag & Drop**: Intuitive file dropping with visual feedback
- **Chunk Upload**: Large files are split for reliable uploads
- **Progress Tracking**: Real-time upload progress with animated indicators
- **Multi-format Support**: Upload any file type up to 10MB

### 📥 Smart File Sharing
- **Unique Share Links**: Each file gets a unique UUID-based shareable link
- **QR Code Generation**: Instant QR codes for easy mobile access
- **Download Tracking**: Monitor how many times your files have been downloaded
- **Link Status**: See if your share links are active or expired

### 👁️ In-Browser Document Viewer
View files directly in your browser without downloading:
- **PDF Documents**: Full-featured PDF viewer with page navigation
- **Images**: View JPG, PNG, GIF, SVG, and WebP images
- **Videos**: Stream MP4, WebM, and other video formats
- **Audio**: Play MP3, WAV, and audio files
- **Code Files**: Syntax-highlighted preview for 20+ programming languages
- **Text Files**: View markdown, plain text, and documents

### 👤 User Profile Management
- **Custom Avatars**: Upload and manage profile pictures
- **Account Settings**: Update name, email, and password
- **Activity Dashboard**: Track your uploaded files and sharing activity
- **File Statistics**: See download counts and link status at a glance

### 🔐 Security & Authentication
- **JWT Authentication**: Secure token-based authentication
- **Password Hashing**: BCrypt encryption for user passwords
- **Session Management**: Secure session handling with MongoDB store
- **CORS Protection**: Configured cross-origin resource sharing

---

## 🛠️ Tech Stack

### Frontend
| Technology | Purpose |
|------------|---------|
| **React 19** | Core UI framework with latest features |
| **Vite 6** | Next-generation frontend tooling |
| **Three.js + React Three Fiber** | 3D graphics and animations |
| **Framer Motion** | Smooth animations and transitions |
| **Tailwind CSS 4** | Utility-first styling |
| **React Router 7** | Client-side routing |
| **Axios** | HTTP client for API calls |
| **QRCode.react** | QR code generation |
| **React-PDF** | PDF document viewing |
| **Highlight.js** | Code syntax highlighting |

### Backend
| Technology | Purpose |
|------------|---------|
| **Node.js + Express** | REST API server |
| **MongoDB + Mongoose** | Database and ODM |
| **Cloudinary** | Cloud file storage |
| **JWT** | Authentication tokens |
| **Passport.js** | Authentication middleware |
| **Nodemailer** | Email notifications |
| **Express-fileupload** | File upload handling |
| **BCrypt** | Password hashing |

### Deployment
| Service | Purpose |
|---------|---------|
| **Vercel** | Frontend & Backend hosting |
| **MongoDB Atlas** | Cloud database |
| **Cloudinary** | Media storage CDN |

---

## 📦 Installation

### Prerequisites
- Node.js v18 or higher
- npm or yarn
- MongoDB Atlas account (or local MongoDB)
- Cloudinary account

### Clone the Repository

```bash
git clone https://github.com/your-username/FileForge.git
cd FileForge
```

### Backend Setup

```bash
# Navigate to backend directory
cd backend

# Install dependencies
npm install

# Create environment file
cp .env.example .env
```

Configure your `.env` file:

```env
# Server Configuration
ALLOWED_CLIENTS=http://localhost:5173
APP_BASE_URL=http://localhost:3000

# MongoDB Connection
MONGO_CONNECTION_URL=mongodb+srv://username:password@cluster.mongodb.net/fileforge

# JWT Secret (generate a secure random string)
JWT_SECRET=your-super-secret-jwt-key

# Cloudinary Configuration
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
CLOUDINARY_URL=cloudinary://api-key:api-secret@cloud-name

# Email Configuration (Optional)
SMTP_HOST=smtp.example.com
SMTP_PORT=587
MAIL_USER=your-email@example.com
MAIL_PASS=your-password
```

Start the backend server:

```bash
npm run dev
```

### Frontend Setup

```bash
# Navigate to frontend directory
cd ../frontend

# Install dependencies
npm install

# Create environment file
echo "VITE_API_URL=http://localhost:3000" > .env

# Start development server
npm run dev
```

### Access the Application

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3000

---

## 🚀 Usage

### 1. Create an Account
Navigate to the registration page and create your account with:
- Full name
- Email address
- Secure password

### 2. Upload Files
From your dashboard:
1. Click the **Upload** button or drag files directly
2. Watch the stunning upload animation
3. Get your shareable link instantly

### 3. Share Files
- **Copy Link**: Click to copy the download link
- **QR Code**: Generate a QR code for mobile sharing
- **View File**: Preview the file in your browser

### 4. Manage Your Files
- View download counts for each file
- Delete files you no longer need
- Update your profile and avatar

---

## 🔌 API Endpoints

### Authentication
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/register` | Create new user account |
| `POST` | `/api/auth/login` | Authenticate user |
| `GET` | `/api/auth/user` | Get current user info |

### Files
| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/files` | Upload a new file |
| `GET` | `/api/files/:uuid` | Get file details |
| `GET` | `/api/files/download/:uuid` | Download a file |
| `GET` | `/api/files/preview/:uuid` | Preview file in browser |
| `DELETE` | `/api/files/:id` | Delete a file |

### Dashboard
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/dashboard/files` | Get user's files |
| `GET` | `/api/dashboard/stats` | Get upload statistics |

### Profile
| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/profile` | Get user profile |
| `PUT` | `/api/profile` | Update profile info |
| `PUT` | `/api/profile/avatar` | Update profile picture |
| `PUT` | `/api/profile/password` | Change password |

---

## 🌐 Deployment

### Deploy Frontend to Vercel

```bash
cd frontend
npm run build
vercel --prod
```

### Deploy Backend to Vercel

The backend is configured for Vercel serverless deployment with `vercel.json`:

```bash
cd backend
vercel --prod
```

### Environment Variables for Production

Set these in your Vercel dashboard:

| Variable | Value |
|----------|-------|
| `ALLOWED_CLIENTS` | `https://your-frontend.vercel.app` |
| `APP_BASE_URL` | `https://your-backend.vercel.app` |
| `MONGO_CONNECTION_URL` | Your MongoDB Atlas connection string |
| `CLOUDINARY_*` | Your Cloudinary credentials |

---

## 📁 Project Structure

```
FileForge/
├── frontend/                   # React frontend application
│   ├── src/
│   │   ├── components/        # Reusable UI components
│   │   │   ├── 3d/            # Three.js 3D scene components
│   │   │   │   ├── Scene.jsx          # Main 3D dashboard scene
│   │   │   │   ├── LandingScene.jsx   # Home page 3D scene
│   │   │   │   ├── AuthScene.jsx      # Login/Register 3D scene
│   │   │   │   ├── ProfileScene.jsx   # Profile page 3D scene
│   │   │   │   └── WarpScene.jsx      # Warp speed effect scene
│   │   │   ├── DocumentViewer.jsx     # In-browser file viewer
│   │   │   ├── FileUploader.jsx       # Drag & drop uploader
│   │   │   ├── FileCard.jsx           # File display card
│   │   │   └── Header.jsx             # Navigation header
│   │   ├── pages/             # Route page components
│   │   │   ├── Dashboard.jsx          # User dashboard
│   │   │   ├── Home.jsx               # Landing page
│   │   │   ├── Login.jsx              # Login page
│   │   │   ├── Register.jsx           # Registration page
│   │   │   ├── Profile.jsx            # User profile
│   │   │   ├── FileDetails.jsx        # File details page
│   │   │   ├── ShareFile.jsx          # File sharing page
│   │   │   └── DownloadFile.jsx       # Download page
│   │   ├── context/           # React context providers
│   │   ├── services/          # API service functions
│   │   └── utils/             # Utility functions
│   └── package.json
│
├── backend/                    # Express backend API
│   ├── config/                # Configuration files
│   ├── middleware/            # Express middleware
│   ├── models/                # Mongoose schemas
│   ├── routes/                # API route handlers
│   ├── services/              # Business logic services
│   ├── views/                 # EJS templates
│   ├── server.js              # Express app entry point
│   └── package.json
│
└── README.md
```

---

## 🏗️ Architecture

### System Overview

```mermaid
graph TB
    subgraph Client
        FE[React Frontend]
        P2P[WebRTC P2P]
    end
    
    subgraph API Layer
        LB[Load Balancer]
        API[Express API]
        WS[WebSocket Signaling]
    end
    
    subgraph Queue System
        REDIS[(Redis)]
        BQ[BullMQ Workers]
    end
    
    subgraph Storage
        MONGO[(MongoDB)]
        CDN[Cloudinary CDN]
    end
    
    subgraph Security
        CLAM[ClamAV Scanner]
        CAPTCHA[mCaptcha PoW]
    end
    
    subgraph Observability
        PROM[Prometheus]
        GRAF[Grafana]
        TEMPO[Tempo/Jaeger]
    end
    
    FE --> LB
    P2P <--> WS
    P2P -.->|fallback| FE
    LB --> API
    API --> REDIS
    API --> MONGO
    API --> CDN
    BQ --> CLAM
    BQ --> MONGO
    REDIS --> BQ
    API --> PROM
    PROM --> GRAF
    API -.->|OTLP| TEMPO
```

### Upload Flow (Sequence Diagram)

```mermaid
sequenceDiagram
    participant C as Client
    participant A as API
    participant R as Redis
    participant Q as BullMQ
    participant CDN as Cloudinary
    participant DB as MongoDB
    participant SC as ClamAV
    
    C->>A: POST /chunked-uploads/init
    A->>DB: Create UploadSession
    A->>C: Return sessionId
    
    loop For each chunk
        C->>A: POST /chunked-uploads/chunk
        A->>A: Verify chunk hash
        A->>R: Store chunk
        A->>C: Chunk accepted
    end
    
    C->>A: POST /chunked-uploads/complete
    A->>A: Merge chunks
    A->>A: Verify file hash
    A->>CDN: Upload to Cloudinary
    A->>Q: Queue scan job
    A->>DB: Create File record
    A->>C: Return file metadata
    
    Q->>SC: Scan for malware
    SC->>Q: Scan result
    Q->>DB: Update scan status
```

### Download Flow (Share Link)

```mermaid
sequenceDiagram
    participant C as Client
    participant A as API
    participant DB as MongoDB
    participant CDN as Cloudinary
    
    C->>A: GET /share/:token?sig=xxx&exp=xxx
    A->>A: Verify HMAC signature
    A->>A: Check expiry
    A->>DB: Find ShareLink
    A->>A: Check password (if set)
    A->>A: Check download limit
    A->>A: Check IP throttle
    A->>DB: Log access
    A->>CDN: Generate signed URL
    A->>C: Redirect to CDN
    CDN->>C: Stream file
```

---

## 🔐 Production Security Features

| Feature | Description | Status |
|---------|-------------|--------|
| **JWT + Refresh Tokens** | Short-lived access tokens, long-lived httpOnly refresh cookies | ✅ |
| **Token Rotation** | Detect token reuse and revoke entire session family | ✅ |
| **RBAC** | Role-based access (USER, PRO, ADMIN) with limits | ✅ |
| **Rate Limiting** | Per-IP and per-user with Redis backing | ✅ |
| **Brute Force Protection** | Lockout after 5 failed attempts + CAPTCHA | ✅ |
| **mCaptcha Integration** | Open-source PoW CAPTCHA after failed logins | ✅ |
| **Share Link Security** | HMAC signatures, expiry, password, download limits | ✅ |
| **Field-Level Encryption** | AES-256-GCM for sensitive metadata | ✅ |
| **Malware Scanning** | ClamAV async scanning queue | ✅ |
| **Audit Logs** | Hash-chained tamper-evident logs | ✅ |
| **P2P Transfer** | WebRTC with automatic cloud fallback | ✅ |

📄 **Full threat model**: [docs/threat-model.md](docs/threat-model.md)

---

## 📊 Observability

### Prometheus Metrics

The `/api/metrics` endpoint exposes:
- `http_request_duration_seconds` - Request latency histogram
- `uploads_total` - Upload counter by status
- `downloads_total` - Download counter
- `rate_limit_hits_total` - Rate limiting events
- `active_sessions` - Current active sessions

### Distributed Tracing

OpenTelemetry integration with Tempo/Jaeger:

```bash
# Enable in .env
OTEL_TRACING_ENABLED=true
OTEL_EXPORTER_URL=http://localhost:4318/v1/traces
```

### Structured Logging

Pino JSON logging with request correlation:

```javascript
// Automatic log format
{"level":30,"time":1705789200000,"requestId":"abc123","userId":"user_1","msg":"File uploaded"}
```

📊 **Grafana setup**: [docs/grafana/README.md](docs/grafana/README.md)

---

## 🚀 CI/CD Pipeline

GitHub Actions workflows in `.github/workflows/`:

| Workflow | Trigger | Jobs |
|----------|---------|------|
| `backend-ci.yml` | PR/push to `backend/**` | Lint → Test → Security Audit → Build |
| `frontend-ci.yml` | PR/push to `frontend/**` | Lint → Build → Test → Lighthouse |

### Running Tests Locally

```bash
# Backend tests
cd backend
npm test

# Frontend tests
cd frontend
npm test
```

### Load Testing

```bash
# Install k6
choco install k6  # Windows

# Run auth load test
cd load-tests
k6 run auth-flow.js
```

📦 **Load test scripts**: [load-tests/README.md](load-tests/README.md)

---

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- [React Three Fiber](https://docs.pmnd.rs/react-three-fiber) for amazing 3D React bindings
- [Drei](https://github.com/pmndrs/drei) for useful Three.js helpers
- [Framer Motion](https://www.framer.com/motion/) for smooth animations
- [Cloudinary](https://cloudinary.com/) for reliable file storage
- [Tailwind CSS](https://tailwindcss.com/) for beautiful styling

---

<p align="center">
  <strong>⭐ If you found this project useful, please consider giving it a star!</strong>
</p>

<p align="center">
  Made with ❤️ and ☕ by <a href="https://github.com/Mrgig7">Mrgig7</a>
</p>
