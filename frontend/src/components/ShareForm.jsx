import { useState } from 'react';

const ShareForm = ({ fileUuid }) => {
  const [emailFrom, setEmailFrom] = useState('');
  const [emailTo, setEmailTo] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccess('');

    // Basic validation
    if (!emailFrom || !emailTo) {
      setError('Please fill in all fields.');
      setIsLoading(false);
      return;
    }

    // Email validation with regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailFrom) || !emailRegex.test(emailTo)) {
      setError('Please enter valid email addresses.');
      setIsLoading(false);
      return;
    }

    try {
      // Create an AbortController for timeout handling
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      // Fix the API URL - ensure it's using the correct base URL
      const apiUrl = `${import.meta.env.VITE_API_URL}/files/send`;
      console.log('Sending request to:', apiUrl);
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          uuid: fileUuid,
          emailTo: emailTo,
          emailFrom: emailFrom
        }),
        signal: controller.signal
      });
      
      // Clear the timeout since the request completed
      clearTimeout(timeoutId);
      
      let data;
      try {
        // Only parse JSON once
        data = await response.json();
      } catch (jsonError) {
        console.error('JSON parsing error:', jsonError);
        throw new Error('Invalid response from server');
      }
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to send email');
      }
      
      console.log('Email sent successfully:', data);
      
      setSuccess('File shared successfully! An email has been sent to the recipient.');
      setEmailTo('');
      setEmailFrom('');
      setIsLoading(false);
    } catch (error) {
      console.error('Share error:', error);
      setError(error.name === 'AbortError' 
        ? 'Request timed out. The server may be busy.' 
        : error.message || 'Something went wrong');
      setIsLoading(false);
    }
  };

  return (
    <div>
      {error && (
        <div className="mb-4 p-3 bg-red-900/20 border border-red-500/30 text-red-400 rounded-lg flex items-start">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <span>{error}</span>
        </div>
      )}
      
      {success && (
        <div className="mb-4 p-3 bg-green-900/20 border border-green-500/30 text-green-400 rounded-lg flex items-start">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          <span>{success}</span>
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label htmlFor="emailFrom" className="block text-sm uppercase tracking-wider text-dark-text-secondary font-medium mb-2">
            Your Email
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-dark-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
              </svg>
            </div>
            <input
              id="emailFrom"
              type="email"
              value={emailFrom}
              onChange={(e) => setEmailFrom(e.target.value)}
              className="bg-dark-bg-primary/40 border border-dark-border/60 rounded-lg py-3 pl-10 pr-3 w-full text-dark-text-primary placeholder:text-dark-text-secondary/60 focus:outline-none focus:ring-2 focus:ring-dark-accent-primary/50"
              placeholder="your@email.com"
              disabled={isLoading}
              required
            />
          </div>
        </div>
        
        <div>
          <label htmlFor="emailTo" className="block text-sm uppercase tracking-wider text-dark-text-secondary font-medium mb-2">
            Recipient's Email
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-dark-text-secondary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <input
              id="emailTo"
              type="email"
              value={emailTo}
              onChange={(e) => setEmailTo(e.target.value)}
              className="bg-dark-bg-primary/40 border border-dark-border/60 rounded-lg py-3 pl-10 pr-3 w-full text-dark-text-primary placeholder:text-dark-text-secondary/60 focus:outline-none focus:ring-2 focus:ring-dark-accent-primary/50"
              placeholder="recipient@email.com"
              disabled={isLoading}
              required
            />
          </div>
        </div>
        
        <button 
          type="submit" 
          className="w-full group relative overflow-hidden px-6 py-3 bg-dark-accent-primary hover:bg-dark-accent-secondary text-white font-medium rounded-lg transition-all duration-300 shadow-lg shadow-dark-accent-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={isLoading}
        >
          <span className="absolute top-0 left-0 w-full h-full bg-white/10 transform -skew-x-12 -translate-x-full group-hover:translate-x-[105%] transition-transform duration-700 ease-in-out"></span>
          <span className="relative z-10 flex items-center justify-center gap-2">
            {isLoading ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Sending...
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                Send Email
              </>
            )}
          </span>
        </button>
      </form>
    </div>
  );
};

export default ShareForm; 