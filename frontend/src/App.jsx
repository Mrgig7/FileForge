import { useState, useEffect, useContext } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './App.css'
import ApiTest from './ApiTest'

// Components
import Loading from './components/Loading'

// Pages
import Home from './pages/Home'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import FileDetails from './pages/FileDetails'
import ShareFile from './pages/ShareFile'
import DownloadFile from './pages/DownloadFile'
import NotFound from './pages/NotFound'
import Profile from './pages/Profile'

// Context
import { AuthProvider, AuthContext } from './context/AuthContext'

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useContext(AuthContext);
  
  if (isLoading) {
    return <Loading />;
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  
  return children;
};

// Redirect if already authenticated
const PublicOnlyRoute = ({ children }) => {
  const { isAuthenticated, isLoading } = useContext(AuthContext);
  
  if (isLoading) {
    return <Loading />;
  }
  
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return children;
};

function App() {
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  useEffect(() => {
    // Simulate initial app loading
    const timer = setTimeout(() => {
      setIsInitialLoading(false);
    }, 1500);
    
    return () => clearTimeout(timer);
  }, []);

  if (isInitialLoading) {
    return <Loading />;
  }

  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="app-container w-full min-h-screen bg-dark-bg-primary text-dark-text-primary">
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<Home />} />
            <Route path="/login" element={
              <PublicOnlyRoute>
                <Login />
              </PublicOnlyRoute>
            } />
            <Route path="/register" element={
              <PublicOnlyRoute>
                <Register />
              </PublicOnlyRoute>
            } />
            <Route path="/files/:uuid" element={<DownloadFile />} />
            
            {/* Protected Routes */}
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } />
            <Route path="/profile" element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            } />
            <Route path="/dashboard/file/:id" element={
              <ProtectedRoute>
                <FileDetails />
              </ProtectedRoute>
            } />
            <Route path="/share" element={
              <ProtectedRoute>
                <ShareFile />
              </ProtectedRoute>
            } />
            
            {/* Not Found */}
            <Route path="*" element={<NotFound />} />

            {/* Add this near the top of your routes */}
            <Route path="/api-test" element={<ApiTest />} />
          </Routes>
        </div>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
