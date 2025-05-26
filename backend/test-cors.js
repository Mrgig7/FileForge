// Simple CORS test script to verify configuration
const fetch = require('node-fetch');

async function testCORS() {
    console.log('🧪 Testing CORS configuration...\n');
    
    const frontendOrigin = 'https://fileforge-indol.vercel.app';
    const backendUrl = 'https://fileforge-backend.vercel.app';
    
    try {
        // Test 1: Simple GET request
        console.log('Test 1: Testing simple GET request...');
        const getResponse = await fetch(`${backendUrl}/api/test`, {
            method: 'GET',
            headers: {
                'Origin': frontendOrigin,
                'Accept': 'application/json'
            }
        });
        
        console.log(`Status: ${getResponse.status}`);
        console.log('CORS Headers:');
        console.log(`  Access-Control-Allow-Origin: ${getResponse.headers.get('access-control-allow-origin')}`);
        console.log(`  Access-Control-Allow-Credentials: ${getResponse.headers.get('access-control-allow-credentials')}`);
        
        if (getResponse.ok) {
            const data = await getResponse.json();
            console.log('✅ GET request successful');
            console.log(`Response: ${data.message}\n`);
        } else {
            console.log('❌ GET request failed\n');
        }
        
        // Test 2: OPTIONS preflight request
        console.log('Test 2: Testing OPTIONS preflight request...');
        const optionsResponse = await fetch(`${backendUrl}/api/test-cors`, {
            method: 'OPTIONS',
            headers: {
                'Origin': frontendOrigin,
                'Access-Control-Request-Method': 'POST',
                'Access-Control-Request-Headers': 'Content-Type, Authorization'
            }
        });
        
        console.log(`Status: ${optionsResponse.status}`);
        console.log('CORS Headers:');
        console.log(`  Access-Control-Allow-Origin: ${optionsResponse.headers.get('access-control-allow-origin')}`);
        console.log(`  Access-Control-Allow-Methods: ${optionsResponse.headers.get('access-control-allow-methods')}`);
        console.log(`  Access-Control-Allow-Headers: ${optionsResponse.headers.get('access-control-allow-headers')}`);
        console.log(`  Access-Control-Allow-Credentials: ${optionsResponse.headers.get('access-control-allow-credentials')}`);
        
        if (optionsResponse.ok) {
            console.log('✅ OPTIONS request successful\n');
        } else {
            console.log('❌ OPTIONS request failed\n');
        }
        
        // Test 3: POST request with JSON
        console.log('Test 3: Testing POST request with JSON...');
        const postResponse = await fetch(`${backendUrl}/api/test-cors`, {
            method: 'POST',
            headers: {
                'Origin': frontendOrigin,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({ test: 'data' })
        });
        
        console.log(`Status: ${postResponse.status}`);
        console.log('CORS Headers:');
        console.log(`  Access-Control-Allow-Origin: ${postResponse.headers.get('access-control-allow-origin')}`);
        
        if (postResponse.ok) {
            const data = await postResponse.json();
            console.log('✅ POST request successful');
            console.log(`Response: ${data.message}\n`);
        } else {
            console.log('❌ POST request failed');
            const errorText = await postResponse.text();
            console.log(`Error: ${errorText}\n`);
        }
        
        // Test 4: Simulate file upload request (multipart/form-data)
        console.log('Test 4: Testing multipart/form-data simulation...');
        const FormData = require('form-data');
        const form = new FormData();
        form.append('test', 'file-upload-simulation');
        
        const uploadResponse = await fetch(`${backendUrl}/api/test-cors`, {
            method: 'POST',
            headers: {
                'Origin': frontendOrigin,
                ...form.getHeaders()
            },
            body: form
        });
        
        console.log(`Status: ${uploadResponse.status}`);
        console.log('CORS Headers:');
        console.log(`  Access-Control-Allow-Origin: ${uploadResponse.headers.get('access-control-allow-origin')}`);
        
        if (uploadResponse.ok) {
            const data = await uploadResponse.json();
            console.log('✅ Multipart request successful');
            console.log(`Response: ${data.message}\n`);
        } else {
            console.log('❌ Multipart request failed');
            const errorText = await uploadResponse.text();
            console.log(`Error: ${errorText}\n`);
        }
        
        console.log('🎉 CORS testing completed!');
        
    } catch (error) {
        console.error('❌ CORS test failed:', error.message);
    }
}

// Run the test
testCORS();
