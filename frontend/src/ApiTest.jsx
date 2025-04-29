import { useState, useEffect } from 'react';

const ApiTest = () => {
  const [testResult, setTestResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  
  const testApi = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Try the simple GET test endpoint
      const getResponse = await fetch('http://localhost:3000/api/test', {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });
      
      console.log('GET test response status:', getResponse.status);
      console.log('GET test headers:', Object.fromEntries([...getResponse.headers]));
      
      if (getResponse.ok) {
        const getContentType = getResponse.headers.get('content-type');
        
        if (getContentType && getContentType.includes('application/json')) {
          const getData = await getResponse.json();
          console.log('GET test succeeded:', getData);
          setTestResult((prev) => ({ ...prev, get: getData }));
        } else {
          const getText = await getResponse.text();
          console.error('GET returned non-JSON:', getText.substring(0, 100));
          setError((prev) => ({ ...prev, get: `Non-JSON response: ${getContentType}` }));
        }
      } else {
        setError((prev) => ({ ...prev, get: `Failed with status: ${getResponse.status}` }));
      }
      
      // Try the POST test endpoint
      const postResponse = await fetch('http://localhost:3000/api/test-auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ email: 'test@example.com', password: 'password123' })
      });
      
      console.log('POST test response status:', postResponse.status);
      console.log('POST test headers:', Object.fromEntries([...postResponse.headers]));
      
      if (postResponse.ok) {
        const postContentType = postResponse.headers.get('content-type');
        
        if (postContentType && postContentType.includes('application/json')) {
          const postData = await postResponse.json();
          console.log('POST test succeeded:', postData);
          setTestResult((prev) => ({ ...prev, post: postData }));
        } else {
          const postText = await postResponse.text();
          console.error('POST returned non-JSON:', postText.substring(0, 100));
          setError((prev) => ({ ...prev, post: `Non-JSON response: ${postContentType}` }));
        }
      } else {
        setError((prev) => ({ ...prev, post: `Failed with status: ${postResponse.status}` }));
      }
    } catch (err) {
      console.error('API test error:', err);
      setError((prev) => ({ ...prev, general: err.message }));
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    testApi();
  }, []);
  
  return (
    <div className="p-5 max-w-xl mx-auto mt-10 bg-gray-800 text-white rounded-lg shadow-lg">
      <h1 className="text-2xl font-bold mb-4">API Test Results</h1>
      
      {loading && <p className="text-blue-400">Testing API endpoints...</p>}
      
      {error && (
        <div className="mb-4 p-3 bg-red-900/50 border border-red-500 rounded-md">
          <h2 className="font-bold text-red-400 mb-2">Errors:</h2>
          <pre className="whitespace-pre-wrap text-sm">
            {JSON.stringify(error, null, 2)}
          </pre>
        </div>
      )}
      
      {testResult && (
        <div className="mb-4 p-3 bg-green-900/50 border border-green-500 rounded-md">
          <h2 className="font-bold text-green-400 mb-2">Success:</h2>
          <pre className="whitespace-pre-wrap text-sm">
            {JSON.stringify(testResult, null, 2)}
          </pre>
        </div>
      )}
      
      <button
        onClick={testApi}
        disabled={loading}
        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-50"
      >
        {loading ? 'Testing...' : 'Test Again'}
      </button>
    </div>
  );
};

export default ApiTest; 