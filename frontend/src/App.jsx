import { useState, useEffect, useContext, Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './App.css'

// Components - Loading always eager loaded for fallback
import Loading from './components/Loading'

// Lazy loaded pages for code splitting
const Home = lazy(() => import('./pages/Home'))
const Login = lazy(() => import('./pages/Login'))
const Register = lazy(() => import('./pages/Register'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
const FileDetails = lazy(() => import('./pages/FileDetails'))
const ShareFile = lazy(() => import('./pages/ShareFile'))
const DownloadFile = lazy(() => import('./pages/DownloadFile'))
const NotFound = lazy(() => import('./pages/NotFound'))
const Profile = lazy(() => import('./pages/Profile'))
const ApiTest = lazy(() => import('./ApiTest'))

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
          <Suspense fallback={<Loading />}>
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

              {/* API Test Route */}
              <Route path="/api-test" element={<ApiTest />} />
            </Routes>
          </Suspense>
        </div>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
