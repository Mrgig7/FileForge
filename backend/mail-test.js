require('dotenv').config();
const nodemailer = require('nodemailer');

async function testMail() {
    // Log environment variables for debugging
    console.log('Environment variables:');
    console.log('SMTP_HOST:', process.env.SMTP_HOST);
    console.log('SMTP_PORT:', process.env.SMTP_PORT);
    console.log('MAIL_USER:', process.env.MAIL_USER);
    console.log('MAIL_PASS length:', process.env.MAIL_PASS ? process.env.MAIL_PASS.length : 0);

    try {
        // Create transporter
        console.log('\nCreating transporter...');
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT),
            secure: false,
            auth: {
                user: process.env.MAIL_USER,
                pass: process.env.MAIL_PASS
            },
            debug: true
        });

        // Verify connection
        console.log('\nVerifying connection...');
        await transporter.verify();
        console.log('✓ SMTP connection verified successfully');

        // Send test email
        console.log('\nSending test email...');
        const info = await transporter.sendMail({
            from: '"FileForge Test" <' + process.env.MAIL_USER + '>',
            to: "jnitesh1406@gmail.com",
            subject: "FileForge Email Test ✅",
            text: "This is a test email from FileForge. If you received this, email sending is working correctly!",
            html: "<b>This is a test email from FileForge.</b><p>If you received this, email sending is working correctly!</p>"
        });

        console.log('\nEmail sent successfully:');
        console.log('Message ID:', info.messageId);
        console.log('Response:', info.response);
        console.log('Accepted:', info.accepted);
        console.log('Rejected:', info.rejected);
        console.log('\nCheck your inbox (and spam folder) for the test email.');

    } catch (error) {
        console.error('\n❌ Error sending email:');
        console.error(error);

        // Provide more specific troubleshooting based on error code
        if (error.code === 'EAUTH') {
            console.error('\nAuthentication Error: Your username or password is incorrect.');
            console.error('- Check your MAIL_USER and MAIL_PASS in the .env file');
            console.error('- Verify that your Brevo API key is still active');
            console.error('- Make sure you\'re using the correct SMTP credentials');
        } else if (error.code === 'ESOCKET') {
            console.error('\nConnection Error: Could not connect to the SMTP server.');
            console.error('- Check your SMTP_HOST and SMTP_PORT in the .env file');
            console.error('- Verify that your network allows connections to the SMTP server');
            console.error('- Check if there are any firewall or proxy issues');
        } else if (error.code === 'ETIMEDOUT') {
            console.error('\nTimeout Error: Connection to the SMTP server timed out.');
            console.error('- Check your network connection');
            console.error('- The SMTP server might be down or blocking your requests');
        }

        console.error('\nBrief summary of potential issues:');
        console.error('1. Incorrect SMTP configuration (host, port)');
        console.error('2. Invalid authentication credentials');
        console.error('3. Network or firewall issues');
        console.error('4. Rate limiting or IP blocking by the email provider');
        console.error('5. Recipient email might be on a blocklist');
    }
}

// Run the test
testMail().catch(err => {
    console.error('Unexpected error in test function:', err);
}); 