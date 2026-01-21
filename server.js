
const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const app = express();

// Middleware
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || '*',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'OutboundFlow Backend'
  });
});

// Test SMTP connection endpoint
app.post('/test-smtp', async (req, res) => {
  const { smtp } = req.body;

  if (!smtp) {
    return res.status(400).json({ error: 'Missing SMTP credentials' });
  }

  if (!smtp.host || !smtp.user || !smtp.pass) {
    return res.status(400).json({ error: 'Missing required SMTP fields: host, user, or pass' });
  }

  try {
    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port || 587,
      secure: smtp.port === 465,
      auth: {
        user: smtp.user,
        pass: smtp.pass,
      },
      // Add timeout
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000,
    });

    // Verify connection
    await transporter.verify();
    
    res.json({ 
      success: true, 
      message: 'SMTP connection successful',
      host: smtp.host,
      port: smtp.port || 587
    });
  } catch (error) {
    console.error('SMTP Test Error:', error);
    res.status(500).json({ 
      error: 'SMTP connection failed',
      message: error.message,
      code: error.code || 'UNKNOWN'
    });
  }
});

// Endpoint to handle real email dispatch
app.post('/send-email', async (req, res) => {
  const { smtp, mailOptions } = req.body;

  // Validation
  if (!smtp || !mailOptions) {
    return res.status(400).json({ 
      error: 'Missing required fields',
      details: !smtp ? 'SMTP credentials missing' : 'Mail options missing'
    });
  }

  if (!smtp.host || !smtp.user || !smtp.fromEmail) {
    return res.status(400).json({ 
      error: 'Missing required SMTP fields',
      required: ['host', 'user', 'fromEmail']
    });
  }

  if (!mailOptions.to || !mailOptions.subject || !mailOptions.body) {
    return res.status(400).json({ 
      error: 'Missing required mail options',
      required: ['to', 'subject', 'body']
    });
  }

  // Email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(mailOptions.to)) {
    return res.status(400).json({ error: 'Invalid recipient email address' });
  }
  if (!emailRegex.test(smtp.fromEmail)) {
    return res.status(400).json({ error: 'Invalid sender email address' });
  }

  try {
    // Create transporter dynamically using lead's SMTP settings
    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port || 587,
      secure: smtp.port === 465, // true for 465, false for other ports
      auth: {
        user: smtp.user,
        pass: smtp.pass || '',
      },
      // Connection timeouts
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000,
    });

    // Verify connection before sending
    try {
      await transporter.verify();
    } catch (verifyError) {
      console.error('SMTP Verification Error:', verifyError);
      return res.status(500).json({ 
        error: 'SMTP connection verification failed',
        message: verifyError.message
      });
    }

    // Send email
    const info = await transporter.sendMail({
      from: `"${smtp.label || 'OutboundFlow'}" <${smtp.fromEmail}>`,
      to: mailOptions.to,
      subject: mailOptions.subject,
      text: mailOptions.body,
      html: mailOptions.html || mailOptions.body.replace(/\n/g, '<br>'), // Simple text to html conversion
      // Add reply-to if provided
      replyTo: mailOptions.replyTo || smtp.fromEmail,
    });

    console.log(`[${new Date().toISOString()}] Message sent successfully: ${info.messageId} to ${mailOptions.to}`);
    
    res.json({ 
      success: true, 
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error(`[${new Date().toISOString()}] SMTP Error:`, error);
    
    // Provide more detailed error information
    let errorMessage = error.message;
    let errorCode = error.code || 'UNKNOWN';
    
    if (error.responseCode) {
      errorCode = error.responseCode;
    }
    
    // Common error handling
    if (error.code === 'EAUTH') {
      errorMessage = 'Authentication failed. Please check your SMTP credentials.';
    } else if (error.code === 'ECONNECTION') {
      errorMessage = 'Connection failed. Please check your SMTP host and port.';
    } else if (error.code === 'ETIMEDOUT') {
      errorMessage = 'Connection timeout. Please check your network connection.';
    }
    
    res.status(500).json({ 
      error: 'Email sending failed',
      message: errorMessage,
      code: errorCode,
      timestamp: new Date().toISOString()
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Endpoint not found',
    path: req.path,
    method: req.method
  });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`\n🚀 OutboundFlow Backend running on http://localhost:${PORT}`);
  console.log(`📧 Email dispatch service ready`);
  console.log(`🔍 Health check: http://localhost:${PORT}/health\n`);
  console.log('To run this: "node server.js" (Requires express, nodemailer, and cors installed)');
});
