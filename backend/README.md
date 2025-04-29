# FileForge - File Sharing Application

FileForge is a powerful file sharing application that allows users to upload, share, and manage files with ease. The application now features user authentication, providing a personalized dashboard to manage your uploaded files.

## Features

- **File Upload**: Drag and drop interface for easy file uploads (up to 100MB)
- **File Sharing**: Generate sharable links that expire in 24 hours
- **Email Sharing**: Share files directly via email
- **User Authentication**: Register and login to your personal account
- **User Dashboard**: View and manage all your uploaded files in one place
- **File Management**: Delete files or view detailed information about them

## Setup Instructions

### Prerequisites

- Node.js (v14 or higher)
- MongoDB

### Installation

1. Clone the repository
   ```
   git clone https://github.com/yourusername/fileforge.git
   cd fileforge
   ```

2. Install dependencies
   ```
   npm install
   ```

3. Create a `.env` file in the root directory with the following variables:
   ```
   ALLOWED_CLIENTS=http://localhost:5500/
   MONGO_CONNECTION_URL=your_mongodb_connection_string
   APP_BASE_URL=http://localhost:3000
   SMTP_HOST=your_smtp_host
   SMTP_PORT=587
   MAIL_USER=your_email_username
   MAIL_PASS=your_email_password
   SESSION_SECRET=your_session_secret_key
   ```

4. Create an `uploads` folder in the root directory
   ```
   mkdir uploads
   ```

5. Start the development server
   ```
   npm run dev
   ```

6. Access the application at `http://localhost:3000`

## User Authentication

### Registration

1. Click on the "Register" link in the navigation bar
2. Fill in your details (name, email, password)
3. Submit the form to create your account

### Login

1. Click on the "Login" link in the navigation bar
2. Enter your email and password
3. You will be redirected to your dashboard

### Dashboard

The dashboard provides an overview of all the files you've uploaded, allowing you to:

- View file details
- Download files
- Get sharable links
- Delete files
- Share files via email

## API Endpoints

### File Management

- `POST /api/files` - Upload a file
- `GET /files/:uuid` - View a file
- `GET /files/download/:uuid` - Download a file
- `POST /api/files/send` - Share a file via email
- `GET /api/files/user-files` - Get all files for the authenticated user
- `DELETE /dashboard/file/:id` - Delete a file

### Authentication

- `GET /auth/register` - Registration page
- `POST /auth/register` - Process registration
- `GET /auth/login` - Login page
- `POST /auth/login` - Process login
- `GET /auth/logout` - Logout

## Security Features

- Passwords are securely hashed using bcrypt
- Session management with MongoDB store
- CSRF protection
- Authentication validation

## License

MIT License

---

Enjoy using FileForge for all your file sharing needs! If you encounter any issues or have suggestions for improvement, please create an issue or submit a pull request.