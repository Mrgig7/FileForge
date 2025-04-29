const nodemailer = require("nodemailer");

async function sendMail({ from, to, subject, text, html }) {
    // Declare transporter outside the try block so it's available in finally
    let transporter;
    
    try {
        console.log('=== EMAIL SENDING ATTEMPT ===');
        console.log('Request details:', {
            from,
            to,
            subject,
            envHost: process.env.SMTP_HOST,
            envPort: process.env.SMTP_PORT,
            envUser: process.env.MAIL_USER,
            // Not logging password
        });
        
        // Create transporter with more detailed logging
        transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT),
            secure: false, // Use TLS
            auth: {
                user: process.env.MAIL_USER,
                pass: process.env.MAIL_PASS
            },
            // Debugging settings
            logger: true,
            debug: true, // show all logs
            // Turn off SSL verification to troubleshoot
            tls: {
                rejectUnauthorized: false
            }
        });

        // Verify SMTP connection - more detailed
        console.log('Verifying SMTP connection...');
        const verifyResult = await new Promise((resolve, reject) => {
            transporter.verify((error, success) => {
                if (error) {
                    console.log('SMTP config error:', error);
                    reject(error);
                } else {
                    console.log('SMTP server is ready to take messages');
                    resolve(success);
                }
            });
        });
        
        console.log('Verification result:', verifyResult);

        // Construct email with proper headers
        const emailData = {
            from: `"FileForge" <${process.env.MAIL_USER}>`, // Proper format with quotes
            to,
            replyTo: from,
            subject: subject || "File shared with you", // Default subject if missing
            text: text || `A file has been shared with you. Sent by: ${from}`, // Default text if missing
            html: html,
            headers: {
                'X-Priority': '1', // High priority
                'X-Mailer': 'FileForge App'
            }
        };

        console.log('Attempting to send email to:', to);
        console.log('Using auth user:', process.env.MAIL_USER);

        // Send mail with better error handling
        return new Promise((resolve, reject) => {
            transporter.sendMail(emailData, (error, info) => {
                if (error) {
                    console.log('SMTP sending error:', error);
                    reject(error);
                } else {
                    console.log('Email sent successfully. Response:', info.response);
                    console.log('MessageID:', info.messageId);
                    console.log('Preview URL:', nodemailer.getTestMessageUrl(info));
                    console.log('Accepted recipients:', info.accepted);
                    console.log('Rejected recipients:', info.rejected);
                    console.log('Pending responses:', info.pending);
                    resolve(info);
                }
            });
        });
    } catch (error) {
        console.error('==== EMAIL SERVICE ERROR ====');
        console.error('Error type:', error.name);
        console.error('Error message:', error.message);
        console.error('Stack trace:', error.stack);
        
        if (error.code) {
            console.error('Error code:', error.code);
            console.error('Command:', error.command);
            console.error('Response:', error.response);
        }
        
        throw new Error(`Failed to send email: ${error.message}`);
    }
}

module.exports = sendMail;
