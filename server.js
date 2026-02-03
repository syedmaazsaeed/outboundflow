import express from 'express';
import nodemailer from 'nodemailer';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';

// Use native fetch (Node 18+)
// Node.js 18+ has native fetch support, so we don't need node-fetch
const fetch = globalThis.fetch;

if (!fetch) {
  console.warn('Warning: fetch not available. Please use Node.js 18+ for native fetch support.');
}

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

// Proxy endpoint for n8n webhooks (workaround for CORS issues)
app.post('/proxy-n8n-webhook', async (req, res) => {
  const { webhookUrl, payload } = req.body;

  if (!webhookUrl) {
    return res.status(400).json({ error: 'Missing webhookUrl' });
  }

  if (!payload) {
    return res.status(400).json({ error: 'Missing payload' });
  }

  if (!fetch) {
    return res.status(500).json({ 
      error: 'Fetch not available',
      message: 'Please install node-fetch: npm install node-fetch@2'
    });
  }

  try {
    console.log(`[Proxy] Forwarding request to: ${webhookUrl}`);
    const startTime = Date.now();

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      timeout: 120000 // 2 minute timeout (if supported)
    });

    const duration = Date.now() - startTime;
    console.log(`[Proxy] Response received: ${response.status} (${duration}ms)`);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unable to read error response');
      return res.status(response.status).json({ 
        error: `n8n returned error: ${response.statusText}`,
        details: errorText.substring(0, 500)
      });
    }

    const data = await response.json().catch(async () => {
      // If not JSON, return as text
      const text = await response.text();
      return { raw: text };
    });

    // Response already has CORS headers from our middleware
    res.json(data);
  } catch (error) {
    console.error('[Proxy] Error:', error);
    res.status(500).json({ 
      error: 'Proxy request failed',
      message: error.message,
      code: error.code || 'UNKNOWN'
    });
  }
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

// Unsubscribe endpoint - handle unsubscribe requests
app.get('/unsubscribe', async (req, res) => {
  const { token, lead, campaign } = req.query;

  // Initialize Supabase client if credentials available
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head><title>Unsubscribe Error</title></head>
      <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
        <h1>Configuration Error</h1>
        <p>Unsubscribe service is not properly configured. Please contact support.</p>
      </body>
      </html>
    `);
  }

  const supabaseClient = createClient(supabaseUrl, supabaseKey);

  try {
    // If token is provided, decode it (format: base64(leadId-campaignId-secret))
    // Otherwise, use direct lead and campaign IDs
    let leadId = lead;
    let campaignId = campaign;

    if (token) {
      try {
        const decoded = Buffer.from(token, 'base64').toString('utf-8');
        const parts = decoded.split('-');
        if (parts.length >= 2) {
          leadId = parts[0];
          campaignId = parts[1];
        }
      } catch (e) {
        console.error('[Unsubscribe] Error decoding token:', e);
      }
    }

    if (!leadId) {
      return res.status(400).send(`
        <!DOCTYPE html>
        <html>
        <head><title>Unsubscribe Error</title></head>
        <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
          <h1>Invalid Request</h1>
          <p>Missing lead information. Please use the unsubscribe link from your email.</p>
        </body>
        </html>
      `);
    }

    // Update lead to mark as unsubscribed
    const { error: updateError } = await supabaseClient
      .from('leads')
      .update({ 
        unsubscribed_at: new Date().toISOString(),
        status: 'BOUNCED' // Mark as bounced to stop sequence
      })
      .eq('id', leadId);

    if (updateError) {
      console.error('[Unsubscribe] Error updating lead:', updateError);
      return res.status(500).send(`
        <!DOCTYPE html>
        <html>
        <head><title>Unsubscribe Error</title></head>
        <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
          <h1>Error</h1>
          <p>Failed to process unsubscribe request. Please try again later.</p>
        </body>
        </html>
      `);
    }

    console.log(`[Unsubscribe] Lead ${leadId} unsubscribed successfully`);

    // Return success page
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Unsubscribed Successfully</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px; background: #f5f5f5;">
        <div style="max-width: 500px; margin: 0 auto; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <h1 style="color: #4CAF50;">✓ Unsubscribed Successfully</h1>
          <p style="color: #666; line-height: 1.6;">You have been successfully unsubscribed from this email list.</p>
          <p style="color: #999; font-size: 14px; margin-top: 30px;">You will no longer receive emails from this campaign.</p>
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    console.error('[Unsubscribe] Error:', error);
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head><title>Unsubscribe Error</title></head>
      <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
        <h1>Error</h1>
        <p>An unexpected error occurred. Please contact support.</p>
      </body>
      </html>
    `);
  }
});

// Tracking pixel endpoint - track email opens
app.get('/track/open', async (req, res) => {
  const { c: campaignId, l: leadId, s: stepId } = req.query;

  // Initialize Supabase client if credentials available
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    // Return 1x1 transparent pixel even if tracking fails
    const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
    res.setHeader('Content-Type', 'image/gif');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    return res.send(pixel);
  }

  const supabaseClient = createClient(supabaseUrl, supabaseKey);

  try {
    if (campaignId && leadId) {
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format

      // Upsert analytics - increment emails_opened
      const { data: existingAnalytics } = await supabaseClient
        .from('campaign_analytics')
        .select('*')
        .eq('campaign_id', campaignId)
        .eq('date', today)
        .single();

      if (existingAnalytics) {
        // Update existing record
        await supabaseClient
          .from('campaign_analytics')
          .update({
            emails_opened: (existingAnalytics.emails_opened || 0) + 1,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingAnalytics.id);
      } else {
        // Create new record
        await supabaseClient
          .from('campaign_analytics')
          .insert({
            campaign_id: campaignId,
            date: today,
            emails_sent: 0,
            emails_delivered: 0,
            emails_opened: 1,
            emails_clicked: 0,
            emails_replied: 0,
            emails_bounced: 0
          });
      }

      console.log(`[Track Open] Campaign ${campaignId}, Lead ${leadId}, Step ${stepId} - Email opened`);
    }
  } catch (error) {
    console.error('[Track Open] Error:', error);
    // Don't fail the request - still return pixel
  }

  // Return 1x1 transparent GIF pixel
  const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
  res.setHeader('Content-Type', 'image/gif');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.send(pixel);
});

// Sync inbox endpoint - fetch emails from Gmail via IMAP
app.post('/sync-inbox', async (req, res) => {
  const { smtp, userId, supabaseUrl, supabaseKey } = req.body;

  if (!smtp || !userId) {
    return res.status(400).json({ 
      error: 'Missing required fields',
      required: ['smtp', 'userId']
    });
  }

  if (!smtp.host || !smtp.user || !smtp.pass) {
    return res.status(400).json({ 
      error: 'Missing SMTP credentials',
      required: ['host', 'user', 'pass']
    });
  }

  let connection = null;
  
  try {
    // Dynamically import IMAP libraries
    let imaps, simpleParser;
    try {
      const imapModule = await import('imap-simple');
      imaps = imapModule.default;
      const mailparserModule = await import('mailparser');
      simpleParser = mailparserModule.simpleParser;
    } catch (importError) {
      return res.status(500).json({ 
        error: 'IMAP libraries not installed',
        message: 'Please install required packages: npm install imap-simple mailparser',
        hint: 'Run this command in your project directory and restart the server',
        details: importError.message
      });
    }

    // Determine IMAP host based on SMTP host
    let imapHost = smtp.host;
    if (smtp.host === 'smtp.gmail.com') {
      imapHost = 'imap.gmail.com';
    } else if (smtp.host.includes('smtp')) {
      imapHost = smtp.host.replace('smtp', 'imap');
    }
    
    const imapConfig = {
      imap: {
        user: smtp.user,
        password: smtp.pass,
        host: imapHost,
        port: 993,
        tls: true,
        tlsOptions: { rejectUnauthorized: false },
        authTimeout: 10000
      }
    };

    console.log(`[Sync Inbox] Connecting to IMAP server: ${imapHost} for ${smtp.user}...`);
    
    // Connect to IMAP server
    connection = await imaps.connect(imapConfig);
    console.log('[Sync Inbox] Connected successfully');
    
    // Open INBOX mailbox
    await connection.openBox('INBOX');
    
    // Search for unread emails or recent emails (last 7 days)
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - 7); // Last 7 days
    
    const searchCriteria = ['UNSEEN', ['SINCE', sinceDate]];
    const fetchOptions = {
      bodies: '',
      struct: true
    };
    
    const messages = await connection.search(searchCriteria, fetchOptions);
    console.log(`[Sync Inbox] Found ${messages.length} new emails`);
    
    const fetchedEmails = [];
    
    // Initialize Supabase client if credentials provided
    let supabaseClient = null;
    if (supabaseUrl && supabaseKey) {
      supabaseClient = createClient(supabaseUrl, supabaseKey);
    }
    
    // Process each message
    for (let i = 0; i < Math.min(messages.length, 50); i++) { // Limit to 50 emails per sync
      try {
        const message = messages[i];
        const all = message.parts.find(part => part.which === '');
        const id = message.attributes.uid;
        const idHeader = "Imap-Id: " + id + "\r\n";
        
        const source = idHeader + all.body;
        const parsed = await simpleParser(source);
        
        // Extract email data
        const emailData = {
          from: parsed.from?.text || parsed.from?.value?.[0]?.address || 'unknown@example.com',
          to: parsed.to?.text || parsed.to?.value?.[0]?.address || smtp.user,
          subject: parsed.subject || '(No Subject)',
          body: parsed.text || parsed.html || '',
          date: parsed.date || new Date(),
          messageId: parsed.messageId || `imap-${id}`,
          isRead: false
        };
        
        // Save to Supabase if client is available
        if (supabaseClient) {
          try {
            const { data, error } = await supabaseClient
              .from('email_messages')
              .insert({
                user_id: userId,
                from_email: emailData.from,
                to_email: emailData.to,
                subject: emailData.subject,
                body: emailData.body,
                date: emailData.date.toISOString(),
                is_read: false
              })
              .select()
              .single();
            
            if (error && !error.message.includes('duplicate')) {
              console.error(`[Sync Inbox] Error saving email ${i + 1}:`, error);
            } else if (data) {
              fetchedEmails.push({
                id: data.id,
                ...emailData
              });

              // Automatic Reply Detection: Match incoming email to leads and update status
              try {
                // Extract email address from from_email (handle "Name <email>" format)
                const fromEmailAddress = emailData.from.includes('<') 
                  ? emailData.from.match(/<(.+)>/)?.[1] || emailData.from
                  : emailData.from.split(' ').pop() || emailData.from;
                
                // Find leads with matching email address
                const { data: matchingLeads, error: leadError } = await supabaseClient
                  .from('leads')
                  .select('id, email, status, campaign_id')
                  .eq('email', fromEmailAddress.toLowerCase().trim())
                  .neq('status', 'REPLIED'); // Only update if not already marked as replied
                
                if (!leadError && matchingLeads && matchingLeads.length > 0) {
                  // Update all matching leads to REPLIED status
                  const leadIds = matchingLeads.map(l => l.id);
                  const { error: updateError } = await supabaseClient
                    .from('leads')
                    .update({ status: 'REPLIED' })
                    .in('id', leadIds);
                  
                  if (!updateError) {
                    console.log(`[Sync Inbox] Auto-detected reply from ${fromEmailAddress}. Updated ${matchingLeads.length} lead(s) to REPLIED status.`);
                  } else {
                    console.error(`[Sync Inbox] Error updating lead status:`, updateError);
                  }
                }
              } catch (replyDetectionError) {
                console.error(`[Sync Inbox] Error in reply detection:`, replyDetectionError);
                // Don't fail the sync if reply detection fails
              }
            }
          } catch (dbError) {
            console.error(`[Sync Inbox] Database error for email ${i + 1}:`, dbError);
          }
        } else {
          // If no Supabase, just return the email data
          fetchedEmails.push({
            id: `temp-${id}`,
            ...emailData
          });
        }
        
        // Mark as read (optional - you might want to keep unread)
        // await connection.addFlags(id, '\\Seen');
        
      } catch (emailError) {
        console.error(`[Sync Inbox] Error processing email ${i + 1}:`, emailError);
        // Continue with next email
      }
    }
    
    // Close connection
    await connection.end();
    
    console.log(`[Sync Inbox] Successfully fetched ${fetchedEmails.length} emails`);
    
    res.json({ 
      success: true,
      message: `Fetched ${fetchedEmails.length} new emails`,
      fetched: fetchedEmails.length,
      emails: fetchedEmails
    });
    
  } catch (error) {
    console.error('[Sync Inbox] Error:', error);
    
    // Close connection if still open
    if (connection) {
      try {
        await connection.end();
      } catch (closeError) {
        // Ignore close errors
      }
    }
    
    res.status(500).json({ 
      error: 'Failed to sync inbox',
      message: error.message,
      code: error.code || 'UNKNOWN',
      hint: error.message.includes('ENOTFOUND') 
        ? 'Check IMAP host configuration. For Gmail, ensure IMAP is enabled in account settings.'
        : error.message.includes('EAUTH')
        ? 'Invalid email credentials. Check username and password.'
        : 'Check server logs for more details'
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
  console.log(`🔍 Health check: http://localhost:${PORT}/health`);
  console.log(`📬 Sync inbox: POST http://localhost:${PORT}/sync-inbox`);
  console.log(`📤 Send email: POST http://localhost:${PORT}/send-email`);
  console.log(`🔄 Proxy webhook: POST http://localhost:${PORT}/proxy-n8n-webhook`);
  console.log(`🚫 Unsubscribe: GET http://localhost:${PORT}/unsubscribe?token=xxx`);
  console.log(`📊 Track opens: GET http://localhost:${PORT}/track/open?c=campaignId&l=leadId&s=stepId\n`);
  console.log('To run this: "node server.js" (Requires express, nodemailer, and cors installed)');
  console.log('Note: For email syncing, also install: npm install imap-simple mailparser\n');
});
