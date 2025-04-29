import { useState, useEffect } from 'react';

const ProfileAvatar = ({ user, size = 'md', className = '' }) => {
  const [imageUrl, setImageUrl] = useState('');
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    if (user?.profilePic) {
      console.log('ProfileAvatar: Setting image URL:', user.profilePic);
      setImageUrl(user.profilePic);
      setImageError(false);
    } else {
      setImageUrl('');
    }
  }, [user]);

  // Determine size classes
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-12 h-12',
    lg: 'w-32 h-32'
  };
  
  const sizeClass = sizeClasses[size] || sizeClasses.md;

  // Handle image loading error
  const handleImageError = () => {
    console.error('Profile image failed to load:', imageUrl);
    setImageError(true);
  };

  return (
    <div className={`relative rounded-full overflow-hidden bg-dark-bg-primary border border-dark-border ${sizeClass} ${className}`}>
      {imageUrl && !imageError ? (
        <img 
          src={imageUrl} 
          alt={user?.name || 'Profile'} 
          className="w-full h-full object-cover"
          onError={handleImageError}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-dark-text-secondary">
          <svg className={size === 'sm' ? 'w-5 h-5' : 'w-12 h-12'} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
      )}
    </div>
  );
};

export default ProfileAvatar; 