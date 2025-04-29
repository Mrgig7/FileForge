import { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import Header from '../components/Header';
import ProfileAvatar from '../components/ProfileAvatar';

const Profile = () => {
  const { user, updateProfile, token } = useContext(AuthContext);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    currentPassword: '',
    newPassword: '',
    confirmNewPassword: '',
    profilePic: null
  });
  const [previewUrl, setPreviewUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        name: user.name || '',
        email: user.email || '',
      }));
      if (user.profilePic) {
        setPreviewUrl(user.profilePic);
        console.log('Setting profile preview URL:', user.profilePic);
      }
    }
  }, [user]);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Check file size
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        setError('Image is too large. Maximum size is 5MB.');
        return;
      }
      
      setFormData(prev => ({ ...prev, profilePic: file }));
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadProfilePicture = async (file) => {
    if (!file) return null;
    
    try {
      // Read the file as a data URL (Base64)
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = async () => {
          try {
            // Create an image element to compress the image
            const img = new Image();
            img.src = reader.result;
            
            img.onload = async () => {
              try {
                // Create a canvas to resize the image
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                
                // Calculate new dimensions (max 800px width/height)
                const MAX_SIZE = 800;
                if (width > height && width > MAX_SIZE) {
                  height = Math.round((height * MAX_SIZE) / width);
                  width = MAX_SIZE;
                } else if (height > MAX_SIZE) {
                  width = Math.round((width * MAX_SIZE) / height);
                  height = MAX_SIZE;
                }
                
                canvas.width = width;
                canvas.height = height;
                
                // Draw resized image to canvas
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                // Get compressed image as JPEG data URL (quality 0.8)
                const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
                
                // Extract content type and Base64 data
                const contentType = compressedDataUrl.split(';')[0].split(':')[1];
                
                console.log(`Original size: ${Math.round(reader.result.length / 1024)}KB, Compressed: ${Math.round(compressedDataUrl.length / 1024)}KB`);
                
                try {
                  // Upload to the server with the complete data URL
                  const response = await fetch('/api/profile/upload-base64', {
                    method: 'PUT',
                    headers: {
                      'Content-Type': 'application/json',
                      'Authorization': `Bearer ${token}`,
                    },
                    body: JSON.stringify({ 
                      imageData: compressedDataUrl, // Send the complete data URL
                      contentType 
                    }),
                  });
                  
                  if (!response.ok) {
                    const errorText = await response.text();
                    let errorMessage = `Server error: ${response.status}`;
                    
                    try {
                      // Try to parse as JSON
                      const errorData = JSON.parse(errorText);
                      errorMessage = errorData.error || errorMessage;
                    } catch {
                      // If not JSON, use text (might be HTML error page)
                      errorMessage = errorText.includes('<') 
                        ? `Server error: ${response.status}` 
                        : errorText;
                    }
                    
                    throw new Error(errorMessage);
                  }
                  
                  const result = await response.json();
                  
                  // Save the Cloudinary URL to localStorage for persistence
                  if (result.user && result.user.profilePic) {
                    localStorage.setItem('profilePicUrl', result.user.profilePic);
                    console.log('Saved profile pic URL to localStorage:', result.user.profilePic);
                  }
                  
                  resolve(result);
                } catch (uploadError) {
                  console.error('Upload error:', uploadError);
                  reject(uploadError);
                }
              } catch (canvasError) {
                console.error('Canvas error:', canvasError);
                reject(new Error('Failed to process image'));
              }
            };
            
            img.onerror = () => reject(new Error('Failed to load image for processing'));
            
          } catch (error) {
            console.error('Image processing error:', error);
            reject(error);
          }
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
      });
    } catch (error) {
      console.error('Error uploading profile picture:', error);
      throw error;
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);

    try {
      // Password validation if changing password
      if (formData.newPassword || formData.confirmNewPassword) {
        if (!formData.currentPassword) {
          throw new Error('Current password is required to change password');
        }
        if (formData.newPassword !== formData.confirmNewPassword) {
          throw new Error('New passwords do not match');
        }
        if (formData.newPassword.length < 6) {
          throw new Error('New password must be at least 6 characters');
        }
      }

      // Check if token is available
      if (!token) {
        console.error('No authentication token found in Profile component');
        throw new Error('Authentication required. Please try logging in again.');
      }

      let profileUpdateResult;
      
      // If we have a profile picture, upload it separately using the Base64 endpoint
      if (formData.profilePic instanceof File) {
        try {
          const uploadResult = await uploadProfilePicture(formData.profilePic);
          if (uploadResult && uploadResult.success) {
            profileUpdateResult = uploadResult;
            // Update the preview with the server-returned URL
            if (uploadResult.user && uploadResult.user.profilePic) {
              setPreviewUrl(uploadResult.user.profilePic);
            }
          }
        } catch (picError) {
          console.error('Profile picture upload failed:', picError);
          setError(picError.message || 'Failed to upload profile picture');
          setIsLoading(false);
          return;
        }
      }
      
      // Only update other profile fields if we're not just updating the profile picture
      // or if the profile picture upload didn't succeed
      if (!profileUpdateResult) {
        console.log('Updating other profile fields');
        
        profileUpdateResult = await updateProfile({
          name: formData.name,
          email: formData.email,
          currentPassword: formData.currentPassword,
          newPassword: formData.newPassword
        });
      }

      setSuccess(profileUpdateResult.message || 'Profile updated successfully!');
      // Clear sensitive data
      setFormData(prev => ({
        ...prev,
        currentPassword: '',
        newPassword: '',
        confirmNewPassword: ''
      }));
    } catch (err) {
      console.error('Profile update error:', err);
      setError(err.message || 'Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark-bg-primary text-dark-text-primary">
      <Header />
      
      <main className="py-12 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="bg-dark-bg-secondary rounded-2xl p-8 border border-dark-border/60">
            <h1 className="text-3xl font-bold mb-8">Profile Settings</h1>
            
            {error && (
              <div className="mb-6 p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400">
                {error}
              </div>
            )}
            
            {success && (
              <div className="mb-6 p-4 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400">
                {success}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-8">
              {/* Profile Picture Section */}
              <div className="flex items-start space-x-6">
                <div className="relative group">
                  {previewUrl ? (
                    <div className="w-32 h-32 rounded-full overflow-hidden bg-dark-bg-primary border-2 border-dark-border group-hover:border-dark-accent-primary transition-colors">
                      <img 
                        src={previewUrl} 
                        alt="Profile" 
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <ProfileAvatar user={user} size="lg" className="border-2 border-dark-border group-hover:border-dark-accent-primary transition-colors" />
                  )}
                  <label className="absolute bottom-0 right-0 bg-dark-accent-primary hover:bg-dark-accent-secondary p-2 rounded-full cursor-pointer transition-colors">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="hidden"
                    />
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </label>
                </div>

                <div className="flex-1">
                  <h3 className="text-lg font-medium">Profile Picture</h3>
                  <p className="text-dark-text-secondary text-sm mt-1">
                    Upload a new profile picture. JPG, PNG or GIF, max 5MB.
                  </p>
                </div>
              </div>

              {/* Basic Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-dark-text-secondary mb-2">
                    Full Name
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-4 py-3 bg-dark-bg-primary border border-dark-border rounded-lg focus:ring-2 focus:ring-dark-accent-primary focus:border-dark-accent-primary transition-all"
                    placeholder="Your name"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-dark-text-secondary mb-2">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full px-4 py-3 bg-dark-bg-primary border border-dark-border rounded-lg focus:ring-2 focus:ring-dark-accent-primary focus:border-dark-accent-primary transition-all"
                    placeholder="your@email.com"
                    required
                  />
                </div>
              </div>

              {/* Change Password Section */}
              <div className="border-t border-dark-border pt-8">
                <h3 className="text-lg font-medium mb-6">Change Password</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-dark-text-secondary mb-2">
                      Current Password
                    </label>
                    <input
                      type="password"
                      value={formData.currentPassword}
                      onChange={(e) => setFormData(prev => ({ ...prev, currentPassword: e.target.value }))}
                      className="w-full px-4 py-3 bg-dark-bg-primary border border-dark-border rounded-lg focus:ring-2 focus:ring-dark-accent-primary focus:border-dark-accent-primary transition-all"
                      placeholder="••••••••"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-dark-text-secondary mb-2">
                        New Password
                      </label>
                      <input
                        type="password"
                        value={formData.newPassword}
                        onChange={(e) => setFormData(prev => ({ ...prev, newPassword: e.target.value }))}
                        className="w-full px-4 py-3 bg-dark-bg-primary border border-dark-border rounded-lg focus:ring-2 focus:ring-dark-accent-primary focus:border-dark-accent-primary transition-all"
                        placeholder="••••••••"
                        minLength={6}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-dark-text-secondary mb-2">
                        Confirm New Password
                      </label>
                      <input
                        type="password"
                        value={formData.confirmNewPassword}
                        onChange={(e) => setFormData(prev => ({ ...prev, confirmNewPassword: e.target.value }))}
                        className="w-full px-4 py-3 bg-dark-bg-primary border border-dark-border rounded-lg focus:ring-2 focus:ring-dark-accent-primary focus:border-dark-accent-primary transition-all"
                        placeholder="••••••••"
                        minLength={6}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-6 py-3 bg-dark-accent-primary hover:bg-dark-accent-secondary text-white font-medium rounded-lg transition-colors flex items-center space-x-2"
                >
                  {isLoading ? (
                    <>
                      <svg className="animate-spin h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <span>Updating...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Save Changes</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Profile; 