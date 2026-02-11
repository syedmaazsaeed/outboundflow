
import React, { useState, useMemo, useEffect } from 'react';
import { Campaign, CampaignStatus, SequenceStep, SmtpAccount, ExecutionLog, Lead } from '../types';
import { logService, supabase, campaignService, analyticsService } from '../lib/supabase';
import { useToastContext } from '../contexts/ToastContext';
import Modal from './Modal';
import { Tooltip } from './Tooltip';
import { LoadingOverlay } from './LoadingOverlay';
import { EmailPreview } from './EmailPreview';
import { ArrowLeft, Save, Plus, Trash2, Webhook, Zap, Loader2, CheckCircle2, AlertCircle, History, Play, Calendar, List, Settings as SettingsIcon, Code, Info, Terminal, Mail, Server, Clock, Pause, StopCircle, Eye } from 'lucide-react';

interface CampaignEditorProps {
  campaign: Campaign;
  smtpAccounts: SmtpAccount[];
  onSave: (campaign: Campaign) => void | Promise<void>;
  onBack: () => void;
}

const CampaignEditor: React.FC<CampaignEditorProps> = ({ campaign, smtpAccounts, onSave, onBack }) => {
  const toast = useToastContext();
  const [localCampaign, setLocalCampaign] = useState<Campaign>({
    ...campaign,
    schedule: campaign.schedule || { days: [1,2,3,4,5], startTime: "09:00", endTime: "17:00", timezone: "UTC", enabled: false, type: 'DAILY' },
    senderAccountIds: campaign.senderAccountIds || (campaign.senderAccountId ? [campaign.senderAccountId] : [])
  });
  const [logs, setLogs] = useState<ExecutionLog[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [activeTab, setActiveTab] = useState<'sequence' | 'schedule' | 'logs'>('sequence');
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [backendUrl, setBackendUrl] = useState('http://localhost:3001');
  const [sendDelay, setSendDelay] = useState(3); // Default 3 seconds between leads
  const [currentProcessingLeadId, setCurrentProcessingLeadId] = useState<string | null>(null);
  const [testingWebhook, setTestingWebhook] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<{[stepId: string]: {success: boolean, message: string}}>({});
  const [confirmModal, setConfirmModal] = useState<{isOpen: boolean; onConfirm: () => void; title: string; message: string; type?: 'confirm' | 'alert' | 'info' | 'success' | 'warning'}>({isOpen: false, onConfirm: () => {}, title: '', message: ''});
  const [previewStep, setPreviewStep] = useState<{isOpen: boolean; step: SequenceStep | null}>({isOpen: false, step: null});
  const [previewData, setPreviewData] = useState<{subject: string; body: string; html?: string}>({subject: '', body: ''});
  const [isSaving, setIsSaving] = useState(false);

  // Load execution logs from database on mount
  useEffect(() => {
    const loadLogs = async () => {
      try {
        const logs = await logService.getByCampaign(localCampaign.id);
        setLogs(logs);
      } catch (error) {
        console.error('Error loading execution logs:', error);
      }
    };
    
    if (localCampaign.id) {
      loadLogs();
    }
  }, [localCampaign.id]);

  // Load execution logs from database on mount
  useEffect(() => {
    const loadLogs = async () => {
      try {
        const logs = await logService.getByCampaign(localCampaign.id);
        setLogs(logs);
      } catch (error) {
        console.error('Error loading execution logs:', error);
      }
    };
    
    if (localCampaign.id) {
      loadLogs();
    }
  }, [localCampaign.id]);

  const wait = (seconds: number) => new Promise(resolve => setTimeout(resolve, seconds * 1000));

  // Helper to validate webhook URL accessibility
  const validateWebhookUrl = async (url: string): Promise<{ valid: boolean; error?: string }> => {
    try {
      new URL(url);
      // Try a HEAD request to check if the endpoint exists (some servers don't support HEAD, so we'll catch that)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      try {
        await fetch(url, { method: 'HEAD', signal: controller.signal, mode: 'no-cors' });
        clearTimeout(timeoutId);
      } catch (e) {
        clearTimeout(timeoutId);
        // HEAD might fail, but that's okay - we'll try the actual request anyway
      }
      return { valid: true };
    } catch (e: any) {
      return { valid: false, error: `Invalid URL format: ${e.message}` };
    }
  };

  const testWebhook = async (step: SequenceStep) => {
    if (!step.webhookUrl) {
      setTestResults({
        ...testResults,
        [step.id]: { success: false, message: 'Please enter a webhook URL first' }
      });
      return;
    }

    setTestingWebhook(step.id);

    // Create a test lead data object
    const testLeadData = {
      lead_data: {
        id: 'test-lead-123',
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
        company: 'Test Company',
        website: 'https://example.com'
      },
      step: {
        id: step.id,
        promptHint: step.promptHint || 'Test prompt'
      },
      timestamp: new Date().toISOString()
    };

    try {
      // Create AbortController for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 1 minute timeout for test

      let response;
      let useProxy = false;
      
      try {
        // Try direct fetch first
        response = await fetch(step.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(testLeadData),
          signal: controller.signal
        });
        clearTimeout(timeoutId);
      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        
        // Check if it's a CORS error that we can retry via proxy
        const isCorsError = (
          fetchError.message?.includes('Failed to fetch') || 
          fetchError.name === 'TypeError' ||
          String(fetchError).includes('Failed to fetch')
        );
        
        if (isCorsError && backendUrl) {
          // Retry via proxy endpoint
          console.warn(`[Test Webhook] CORS error detected, retrying via proxy...`);
          
          try {
            const proxyController = new AbortController();
            const proxyTimeoutId = setTimeout(() => proxyController.abort(), 60000);
            
            const proxyResponse = await fetch(`${backendUrl}/proxy-n8n-webhook`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                webhookUrl: step.webhookUrl,
                payload: testLeadData
              }),
              signal: proxyController.signal
            });
            
            clearTimeout(proxyTimeoutId);
            
            if (!proxyResponse.ok) {
              const errorText = await proxyResponse.text().catch(() => 'Unable to read error response');
              throw new Error(`Proxy error: ${proxyResponse.status} ${proxyResponse.statusText}: ${errorText.substring(0, 200)}`);
            }
            
            response = proxyResponse;
            useProxy = true;
            console.log(`[Test Webhook] Success via proxy`);
          } catch (proxyError: any) {
            // Proxy also failed
            throw new Error(
              `Network/CORS Error: Failed to connect to webhook.\n\n` +
              `Direct request failed: ${fetchError.message}\n` +
              `Proxy retry also failed: ${proxyError.message}\n\n` +
              `Solutions:\n` +
              `1. Enable CORS in n8n: Set N8N_CORS_ORIGIN=http://localhost:3000 in n8n environment\n` +
              `2. Ensure backend server (${backendUrl}) is running for proxy fallback\n` +
              `3. Check n8n instance is accessible\n` +
              `4. Verify webhook URL is correct`
            );
          }
        } else {
          // Not a CORS error or no proxy available
          if (fetchError.name === 'AbortError') {
            throw new Error(`Request timeout after 60 seconds. The n8n workflow may be taking too long.`);
          } else if (isCorsError) {
            throw new Error(
              `Network/CORS Error: Failed to connect to webhook.\n\n` +
              `This is likely a CORS issue. To fix:\n` +
              `1. Set N8N_CORS_ORIGIN=http://localhost:3000 in n8n environment variables\n` +
              `2. Or ensure backend server (${backendUrl}) is running for proxy fallback\n\n` +
              `Also check: URL is correct, n8n instance is accessible, network is stable.`
            );
          } else {
            throw new Error(`Fetch error: ${fetchError.message || String(fetchError) || 'Unknown network error'}`);
          }
        }
      }

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unable to read error response');
        throw new Error(`HTTP ${response.status} ${response.statusText}: ${errorText.substring(0, 200)}`);
      }

      // Get response text first to handle empty or malformed JSON
      const responseText = await response.text();
      
      if (!responseText || responseText.trim() === '') {
        throw new Error('n8n returned empty response. Make sure your "Respond to Webhook" node is configured and returns JSON with "subject" and "body" fields.');
      }

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        throw new Error(`Invalid JSON response: "${responseText.substring(0, 100)}..."`);
      }
      
      if (!data || typeof data !== 'object') {
        throw new Error(`Invalid data format. Expected object, got: ${typeof data}`);
      }

      if (!data.subject || !data.body) {
        throw new Error(`Missing required fields. Expected 'subject' and 'body'. Received: ${JSON.stringify(Object.keys(data))}`);
      }

      setTestResults({
        ...testResults,
        [step.id]: { 
          success: true, 
          message: `✓ Success! Received subject: "${data.subject.substring(0, 50)}..."` 
        }
      });
    } catch (error: any) {
      console.error('[Webhook Test Error]', {
        error: error,
        webhookUrl: step.webhookUrl,
        errorMessage: error.message
      });
      
      setTestResults({
        ...testResults,
        [step.id]: { 
          success: false, 
          message: `✗ Error: ${error.message}` 
        }
      });
    } finally {
      setTestingWebhook(null);
    }
  };

  const updateStep = (id: string, updates: Partial<SequenceStep>) => {
    setLocalCampaign({
      ...localCampaign,
      steps: localCampaign.steps.map(s => s.id === id ? { ...s, ...updates } : s)
    });
  };

  const addStep = () => {
    const newOrder = localCampaign.steps.length + 1;
    const newStep: SequenceStep = {
      id: 's' + Date.now(),
      order: newOrder,
      delayDays: 2,
      delayHours: 0,
      delayMinutes: 0,
      webhookUrl: '',
    };
    setLocalCampaign({
      ...localCampaign,
      steps: [...localCampaign.steps, newStep]
    });
  };

  const removeStep = (id: string) => {
    if (localCampaign.steps.length <= 1) return;
    const filtered = localCampaign.steps.filter(s => s.id !== id);
    // Re-order
    const reordered = filtered.map((s, i) => ({ ...s, order: i + 1 }));
    setLocalCampaign({ ...localCampaign, steps: reordered });
  };

  const runCampaignExecution = async () => {
    console.log('[Launch Sequence] Button clicked, starting validation...');
    
    // Validation checks with detailed logging
    if (localCampaign.leads.length === 0) {
      console.warn('[Launch Sequence] Validation failed: No leads in campaign');
      toast.warning('No leads in campaign. Please add leads before executing.');
      return;
    }
    console.log(`[Launch Sequence] ✓ Leads check passed: ${localCampaign.leads.length} leads`);
    
    // Get selected accounts (prefer multiple accounts, fallback to single account for backward compatibility)
    const selectedAccountIds = localCampaign.senderAccountIds && localCampaign.senderAccountIds.length > 0 
      ? localCampaign.senderAccountIds 
      : (localCampaign.senderAccountId ? [localCampaign.senderAccountId] : []);
    
    if (selectedAccountIds.length === 0) {
      console.warn('[Launch Sequence] Validation failed: No SMTP accounts selected');
      toast.warning('Please select at least one Sender Account in Infrastructure tab');
      return;
    }
    console.log(`[Launch Sequence] ✓ SMTP accounts check passed: ${selectedAccountIds.length} account(s) selected`);
    
    const selectedAccounts = smtpAccounts.filter(a => selectedAccountIds.includes(a.id));
    
    if (selectedAccounts.length === 0) {
      console.warn('[Launch Sequence] Validation failed: Selected account IDs not found in SMTP accounts list');
      toast.error('Selected SMTP accounts not found. Please check your account configuration.');
      return;
    }
    
    // Check daily limits
    const accountsAtLimit = selectedAccounts.filter(a => (a.sentToday || 0) >= (a.dailySendLimit || 100));
    if (accountsAtLimit.length === selectedAccounts.length) {
      console.warn('[Launch Sequence] Validation failed: All accounts at daily limit');
      toast.error('All selected accounts have reached their daily send limit. Please wait until tomorrow or increase limits.');
      return;
    }
    
    // Filter out accounts that have reached their limit
    const availableAccounts = selectedAccounts.filter(a => (a.sentToday || 0) < (a.dailySendLimit || 100));
    if (availableAccounts.length === 0) {
      console.warn('[Launch Sequence] Validation failed: No available accounts after filtering');
      toast.error('No accounts available - all have reached their daily send limit.');
      return;
    }
    console.log(`[Launch Sequence] ✓ Account limits check passed: ${availableAccounts.length} account(s) available`);
    

    // Validate webhook URL
    const firstStep = localCampaign.steps[0];
    if (!firstStep || !firstStep.webhookUrl || firstStep.webhookUrl.trim() === '') {
      console.warn('[Launch Sequence] Validation failed: No webhook URL configured');
      toast.warning('Please configure a webhook URL in the Sequence & Config tab');
      return;
    }
    console.log(`[Launch Sequence] ✓ Webhook URL check passed: ${firstStep.webhookUrl.substring(0, 50)}...`);

    // Validate webhook URL format
    try {
      new URL(firstStep.webhookUrl);
    } catch (e) {
      console.warn('[Launch Sequence] Validation failed: Invalid webhook URL format', e);
      toast.error('Please enter a valid webhook URL (e.g., https://your-n8n.com/webhook/...)');
      return;
    }
    console.log('[Launch Sequence] ✓ All validations passed, proceeding with launch...');


    // Ensure campaign is saved to database before execution (for proper UUIDs and foreign keys)
    let campaignToUse = localCampaign;
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (supabaseUrl && supabase) {
      try {
        // Get current user
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          // Check if campaign exists in database by trying to fetch it
          const existingCampaign = await campaignService.getById(localCampaign.id);
          
          // If campaign doesn't exist or has different structure, save it first
          if (!existingCampaign || existingCampaign.leads.length !== localCampaign.leads.length) {
            console.log('[Campaign Execution] Saving campaign to database before execution...');
            const savedCampaign = await campaignService.update(localCampaign);
            if (savedCampaign) {
              // Use saved campaign with database IDs
              campaignToUse = savedCampaign;
              setLocalCampaign(savedCampaign);
              console.log('[Campaign Execution] Campaign saved, using database IDs:', {
                campaignId: savedCampaign.id,
                leadIds: savedCampaign.leads.map(l => l.id).slice(0, 3),
                stepIds: savedCampaign.steps.map(s => s.id)
              });
            } else {
              console.warn('[Campaign Execution] Failed to save campaign to database, execution may fail for logs');
            }
          } else {
            // Campaign exists, use database version with proper UUIDs
            campaignToUse = existingCampaign;
            setLocalCampaign(existingCampaign);
            console.log('[Campaign Execution] Using existing campaign from database:', {
              campaignId: existingCampaign.id,
              leadIds: existingCampaign.leads.map(l => l.id).slice(0, 3),
              stepIds: existingCampaign.steps.map(s => s.id)
            });
          }
        }
      } catch (saveError: any) {
        console.error('[Campaign Execution] Error ensuring campaign is saved:', saveError);
        // Continue anyway - execution logs might fail but campaign can still run
      }
    }
    
    // Start execution IMMEDIATELY - don't wait for save
    // Save can happen in background, but execution should start right away
    let campaignToUse = localCampaign;
    
    console.log('[Launch Sequence] ===== STARTING EXECUTION IMMEDIATELY =====');
    console.log(`[Launch Sequence] Campaign: ${campaignToUse.name}`);
    console.log(`[Launch Sequence] Leads: ${campaignToUse.leads.length}`);
    console.log(`[Launch Sequence] Steps: ${campaignToUse.steps.length}`);
    console.log(`[Launch Sequence] Available accounts: ${availableAccounts.length}`);
    console.log(`[Launch Sequence] Backend URL: ${backendUrl}`);
    
    // Set execution state IMMEDIATELY - don't wait for anything
    setIsExecuting(true);
    setActiveTab('logs');

    
    const totalEmails = campaignToUse.steps.length * campaignToUse.leads.length;
    setProgress({ current: 0, total: totalEmails });
    setLogs([]); // Clear previous logs
    

    setProgress({ current: 0, total: campaignToUse.leads.length });
    setLogs([]); // Clear previous logs
    
    // Try to save in background (non-blocking) - fire and forget
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (supabaseUrl && supabase) {
      // Start save in background - don't await it, don't block execution
      (async () => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            console.log('[Launch Sequence] Starting background save (non-blocking)...');
            const savePromise = campaignService.update(localCampaign);
            const timeoutPromise = new Promise<null>((_, reject) => 
              setTimeout(() => reject(new Error('Save timeout')), 10000)
            );
            
            try {
              const savedCampaign = await Promise.race([savePromise, timeoutPromise]);
              if (savedCampaign) {
                campaignToUse = savedCampaign;
                setLocalCampaign(savedCampaign);
                console.log('[Launch Sequence] ✓ Background save completed');
              }
            } catch (saveError: any) {
              console.warn('[Launch Sequence] Background save failed (non-critical):', saveError.message);
            }
          }
        } catch (saveError: any) {
          console.warn('[Launch Sequence] Background save error (non-critical):', saveError.message);
        }
      })(); // Fire and forget - don't await
    }
    
    console.log('[Launch Sequence] Execution state set, starting lead processing NOW...');
    

    const updatedLeads = [...campaignToUse.leads];
    const newLogs: ExecutionLog[] = [];
    let accountRotationIndex = 0; // Track rotation across leads

    // Wrap execution in try-catch to handle any errors
    try {
      console.log(`[Launch Sequence] ===== ENTERING EXECUTION LOOP =====`);
      console.log(`[Launch Sequence] Processing ${updatedLeads.length} leads...`);

      
      if (!campaignToUse.steps || campaignToUse.steps.length === 0) {
        throw new Error('No sequence steps configured. Please add at least one step in Sequence & Config tab.');
      }
      
      const firstStep = campaignToUse.steps[0];
      console.log(`[Launch Sequence] Using step:`, {
        id: firstStep.id,
        order: firstStep.order,
        webhookUrl: firstStep.webhookUrl?.substring(0, 50) + '...'
      });
      
      for (let i = 0; i < updatedLeads.length; i++) {
        console.log(`[Launch Sequence] ===== PROCESSING LEAD ${i + 1}/${updatedLeads.length} =====`);
        const lead = updatedLeads[i];
        const step = campaignToUse.steps[0];
        
        if (!step) {
          console.error(`[Launch Sequence] ERROR: No step found for lead ${i + 1}`);
          continue;
        }
        
        console.log(`[Launch Sequence] Lead ${i + 1}: ${lead.email}, Step order: ${step.order}`);
        setCurrentProcessingLeadId(lead.id);
      
      // Get or assign inbox for this lead (for consistency - same lead uses same inbox)
      let sender: SmtpAccount;
      if (lead.assignedInboxId) {
        // Lead already has an assigned inbox, try to use it
        const assigned = availableAccounts.find(a => a.id === lead.assignedInboxId);
        if (assigned && (assigned.sentToday || 0) < (assigned.dailySendLimit || 100)) {
          sender = assigned;
        } else {
          // Assigned inbox is at limit or not available, rotate to next available
          sender = availableAccounts[accountRotationIndex % availableAccounts.length];
          updatedLeads[i] = { ...lead, assignedInboxId: sender.id };
          accountRotationIndex++;
        }
      } else {
        // No assigned inbox, rotate through available accounts (round-robin)
        sender = availableAccounts[accountRotationIndex % availableAccounts.length];
        updatedLeads[i] = { ...lead, assignedInboxId: sender.id };
        accountRotationIndex++;
      }
      
      // Check if this account has reached its limit
      if ((sender.sentToday || 0) >= (sender.dailySendLimit || 100)) {
        // Skip this lead - account limit reached
        const errorLog: ExecutionLog = {
          id: Math.random().toString(),
          campaignId: campaignToUse.id,
          leadId: lead.id,
          stepId: step.id,
          smtpAccountId: sender.id,
          timestamp: new Date().toISOString(),
          subject: '',
          body: '',
          status: 'ERROR',
          type: 'SEND',
          errorDetails: `Account ${sender.label} has reached daily send limit (${sender.sentToday}/${sender.dailySendLimit})`
        };
        newLogs.unshift(errorLog);
        setLogs([...newLogs]);
        setProgress(prev => ({ ...prev, current: i + 1 }));
        continue;
      }

      // Check if lead has unsubscribed
      if (lead.unsubscribedAt) {
        const skipLog: ExecutionLog = {
          id: Math.random().toString(),
          campaignId: campaignToUse.id,
          leadId: lead.id,
          stepId: step.id,
          smtpAccountId: sender.id,
          timestamp: new Date().toISOString(),
          subject: '',
          body: '',
          status: 'ERROR',
          type: 'SEND',
          errorDetails: `Lead ${lead.email} has unsubscribed - skipping email`
        };
        newLogs.unshift(skipLog);
        setLogs([...newLogs]);
        setProgress(prev => ({ ...prev, current: i + 1 }));
        continue;
      }

      // Check if lead has replied
      if (lead.status === 'REPLIED') {
        const skipLog: ExecutionLog = {
          id: Math.random().toString(),
          campaignId: campaignToUse.id,
          leadId: lead.id,
          stepId: step.id,
          smtpAccountId: sender.id,
          timestamp: new Date().toISOString(),
          subject: '',
          body: '',
          status: 'ERROR',
          type: 'SEND',
          errorDetails: `Lead ${lead.email} has replied - stopping sequence`
        };
        newLogs.unshift(skipLog);
        setLogs([...newLogs]);
        setProgress(prev => ({ ...prev, current: i + 1 }));
        continue;
      }
      
      try {
        // 1. CALL N8N WEBHOOK FOR AI CONTENT (SEQUENTIAL)
        const requestPayload = {
          lead_data: { ...lead.customFields, id: lead.id, email: lead.email, firstName: lead.firstName, lastName: lead.lastName, company: lead.company },
          step: { id: step.id, promptHint: step.promptHint },
          timestamp: new Date().toISOString()
        };

        // Debug logging
        console.log(`[Webhook Request] Lead ${i + 1}/${updatedLeads.length}`, {
          url: step.webhookUrl,
          leadEmail: lead.email,
          payloadSize: JSON.stringify(requestPayload).length,
          hasLinkedInUrl: !!requestPayload.lead_data.linkedin_url
        });

        // Create AbortController for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minute timeout

        const requestStartTime = Date.now();
        let webhookResponse;
        let useProxy = false;
        
        try {
          // Try direct fetch first
          webhookResponse = await fetch(step.webhookUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestPayload),
            signal: controller.signal
          });
          clearTimeout(timeoutId);
          const requestDuration = Date.now() - requestStartTime;
          console.log(`[Webhook Response] Lead ${i + 1}/${updatedLeads.length}`, {
            status: webhookResponse.status,
            statusText: webhookResponse.statusText,
            duration: `${requestDuration}ms`,
            ok: webhookResponse.ok,
            via: 'direct'
          });
        } catch (fetchError: any) {
          clearTimeout(timeoutId);
          const requestDuration = Date.now() - requestStartTime;
          
          const errorMessage = fetchError?.message || String(fetchError) || 'Unknown error';
          const errorName = fetchError?.name || 'Error';
          
          // Check if it's a CORS/network error that we can retry via proxy
          const isCorsError = (
            errorMessage.includes('Failed to fetch') || 
            errorName === 'TypeError' ||
            errorMessage === 'Failed to fetch'
          );
          
          if (isCorsError && backendUrl) {
            // Retry via proxy endpoint
            console.warn(`[Webhook] CORS error detected, retrying via proxy...`, {
              error: errorMessage,
              proxyUrl: `${backendUrl}/proxy-n8n-webhook`
            });
            
            try {
              const proxyController = new AbortController();
              const proxyTimeoutId = setTimeout(() => proxyController.abort(), 120000);
              
              const proxyStartTime = Date.now();
              const proxyResponse = await fetch(`${backendUrl}/proxy-n8n-webhook`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  webhookUrl: step.webhookUrl,
                  payload: requestPayload
                }),
                signal: proxyController.signal
              });
              
              clearTimeout(proxyTimeoutId);
              const proxyDuration = Date.now() - proxyStartTime;
              
              if (!proxyResponse.ok) {
                const errorText = await proxyResponse.text().catch(() => 'Unable to read error response');
                throw new Error(`Proxy error: ${proxyResponse.status} ${proxyResponse.statusText}: ${errorText.substring(0, 200)}`);
              }
              
              webhookResponse = proxyResponse;
              useProxy = true;
              
              console.log(`[Webhook Response] Lead ${i + 1}/${updatedLeads.length} (via proxy)`, {
                status: webhookResponse.status,
                statusText: webhookResponse.statusText,
                duration: `${proxyDuration}ms`,
                ok: webhookResponse.ok,
                via: 'proxy'
              });
            } catch (proxyError: any) {
              // Proxy also failed, throw original error with helpful message
              throw new Error(
                `Network/CORS Error: Failed to connect to ${step.webhookUrl}\n\n` +
                `Direct request failed: ${errorMessage}\n` +
                `Proxy retry also failed: ${proxyError.message}\n\n` +
                `Solutions:\n` +
                `1. Enable CORS in n8n: Set N8N_CORS_ORIGIN=http://localhost:3000 in n8n environment\n` +
                `2. Ensure backend server (${backendUrl}) is running for proxy fallback\n` +
                `3. Check n8n instance is accessible\n` +
                `4. Verify webhook URL is correct`
              );
            }
          } else {
            // Not a CORS error or no proxy available, throw original error
            console.error(`[Webhook Fetch Error] Lead ${i + 1}/${updatedLeads.length}`, {
              error: fetchError,
              errorName: errorName,
              errorMessage: errorMessage,
              errorType: typeof fetchError,
              duration: `${requestDuration}ms`,
              url: step.webhookUrl,
              stack: fetchError?.stack
            });
            
            if (errorName === 'AbortError' || fetchError.name === 'AbortError') {
              throw new Error(`Request timeout after 120 seconds. The n8n workflow may be taking too long. Check your workflow execution time.`);
            } else {
              throw new Error(`Fetch error (${errorName}): ${errorMessage || 'Unknown network error'}`);
            }
          }
        }
        
        if (!webhookResponse.ok) {
          const errorText = await webhookResponse.text().catch(() => 'Unable to read error response');
          throw new Error(`n8n HTTP ${webhookResponse.status} ${webhookResponse.statusText}: ${errorText.substring(0, 200)}`);
        }

        // Get response text first to handle empty or malformed JSON
        const responseText = await webhookResponse.text();
        
        if (!responseText || responseText.trim() === '') {
          throw new Error('n8n returned empty response. Check your "Respond to Webhook" node configuration.');
        }

        let data;
        try {
          data = JSON.parse(responseText);
        } catch (parseError) {
          throw new Error(`n8n returned invalid JSON. Response: "${responseText.substring(0, 100)}..."`);
        }
        
        if (!data || typeof data !== 'object') {
          throw new Error(`n8n returned invalid data format. Expected object, got: ${typeof data}`);
        }

        if (!data.subject || !data.body) {
          throw new Error(`n8n returned missing content. Expected 'subject' and 'body' fields. Received: ${JSON.stringify(Object.keys(data))}`);
        }

        // Prepare email body with unsubscribe link and tracking pixel
        let emailBody = data.body;
        let emailHtml = emailBody.replace(/\n/g, '<br>');

        // Generate unsubscribe token (base64 encoded: leadId-campaignId)
        // Use browser-compatible btoa instead of Node.js Buffer
        const unsubscribeToken = btoa(`${lead.id}-${campaignToUse.id}`);
        const unsubscribeUrl = `${backendUrl}/unsubscribe?token=${encodeURIComponent(unsubscribeToken)}&lead=${encodeURIComponent(lead.id)}&campaign=${encodeURIComponent(campaignToUse.id)}`;
        
        // Add unsubscribe link to email (both text and HTML versions)
        const unsubscribeText = `\n\n---\nTo unsubscribe from these emails, click here: ${unsubscribeUrl}`;
        const unsubscribeHtml = `<br><br><hr><p style="font-size: 12px; color: #999;"><a href="${unsubscribeUrl}" style="color: #999;">Unsubscribe</a></p>`;
        
        emailBody += unsubscribeText;
        emailHtml += unsubscribeHtml;

        // Add tracking pixel only for second email step (step.order === 2)
        if (step.order === 2) {
          const trackingUrl = `${backendUrl}/track/open?c=${encodeURIComponent(campaignToUse.id)}&l=${encodeURIComponent(lead.id)}&s=${encodeURIComponent(step.id)}`;
          const trackingPixel = `<img src="${trackingUrl}" width="1" height="1" style="display:none; width:1px; height:1px; border:0;" alt="">`;
          emailHtml += trackingPixel;
        }

        // 2. CALL REAL BACKEND FOR SMTP DISPATCH
        console.log(`[Launch Sequence] Calling backend to send email for lead ${i + 1}...`);
        console.log(`[Launch Sequence] Backend URL: ${backendUrl}/send-email`);
        
        // Add timeout to backend call (30 seconds)
        const backendController = new AbortController();
        const backendTimeoutId = setTimeout(() => backendController.abort(), 30000);
        
        const backendStartTime = Date.now();
        let dispatchResponse;
        
        try {
          dispatchResponse = await fetch(`${backendUrl}/send-email`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              smtp: sender,
              mailOptions: {
                to: lead.email,
                subject: data.subject,
                body: emailBody,
                html: emailHtml
              }
            }),
            signal: backendController.signal
          });
          
          clearTimeout(backendTimeoutId);
          const backendDuration = Date.now() - backendStartTime;
          console.log(`[Launch Sequence] Backend response received in ${backendDuration}ms:`, {
            status: dispatchResponse.status,
            ok: dispatchResponse.ok
          });
        } catch (backendError: any) {
          clearTimeout(backendTimeoutId);
          const backendDuration = Date.now() - backendStartTime;
          
          if (backendError.name === 'AbortError') {
            throw new Error(`Backend request timed out after 30 seconds. Check if server.js is running on ${backendUrl}`);
          }
          throw new Error(`Backend request failed: ${backendError.message || 'Unknown error'}. Check if server.js is running.`);
        }

        const dispatchResult = await dispatchResponse.json();
        if (!dispatchResponse.ok) {
          throw new Error(`Backend Error: ${dispatchResult.error || dispatchResult.message || 'Unknown backend error'}`);
        }
        
        console.log(`[Launch Sequence] ✓ Email sent successfully for lead ${i + 1}: ${lead.email}`);

        // Update local lead state immediately
        updatedLeads[i] = { ...lead, status: 'CONTACTED' };

        // Update analytics - increment emails sent (with timeout, non-blocking)
        // Don't let analytics slow down execution
        (async () => {
          try {
            const today = new Date().toISOString().split('T')[0];
            const analyticsPromise = analyticsService.getByCampaign(campaignToUse.id);
            const analyticsTimeout = new Promise<null>((_, reject) => 
              setTimeout(() => reject(new Error('Analytics timeout')), 5000)
            );
            
            const existingAnalytics = await Promise.race([analyticsPromise, analyticsTimeout]);
            const todayAnalytics = existingAnalytics?.find((a: any) => a.date === today);
            
            if (todayAnalytics) {
              await analyticsService.upsert({
                campaignId: campaignToUse.id,
                date: today,
                emailsSent: (todayAnalytics.emailsSent || 0) + 1,
                emailsDelivered: (todayAnalytics.emailsDelivered || 0) + 1,
                emailsOpened: todayAnalytics.emailsOpened || 0,
                emailsClicked: todayAnalytics.emailsClicked || 0,
                emailsReplied: todayAnalytics.emailsReplied || 0,
                emailsBounced: todayAnalytics.emailsBounced || 0,
              });
            } else {
              await analyticsService.upsert({
                campaignId: campaignToUse.id,
                date: today,
                emailsSent: 1,
                emailsDelivered: 1,
                emailsOpened: 0,
                emailsClicked: 0,
                emailsReplied: 0,
                emailsBounced: 0,
              });
            }
            console.log(`[Launch Sequence] Analytics updated for lead ${i + 1}`);
          } catch (analyticsError) {
            console.warn('[Launch Sequence] Analytics update failed (non-critical):', analyticsError);
            // Don't fail execution if analytics update fails
          }
        })(); // Fire and forget - don't await

        // Increment sent count for the account (in memory only - would need backend update for persistence)
        sender.sentToday = (sender.sentToday || 0) + 1;
        
        const logEntry: ExecutionLog = {
          id: Math.random().toString(), // Temporary ID, will be replaced by database
          campaignId: campaignToUse.id,
          leadId: lead.id,
          stepId: step.id,
          smtpAccountId: sender.id,
          timestamp: new Date().toISOString(),
          subject: data.subject,
          body: data.body,
          status: 'SUCCESS',
          type: 'SEND'
        };
        

        // Save log to database
        try {
          const { id, ...logWithoutId } = logEntry;
          const savedLog = await logService.create(logWithoutId);
          if (savedLog) {
            logEntry.id = savedLog.id; // Update with database ID
            console.log(`[Execution Log] Saved to database: ${savedLog.id}`, {
              campaignId: logEntry.campaignId,
              leadId: logEntry.leadId,
              stepId: logEntry.stepId
            });
          } else {
            console.warn('[Execution Log] Failed to save to database, keeping in memory only', {
              campaignId: logEntry.campaignId,
              leadId: logEntry.leadId,
              stepId: logEntry.stepId,
              reason: 'logService.create returned null - check foreign key constraints and database connection'
            });
          }
        } catch (logError: any) {
          console.error('[Execution Log] Error saving to database:', {
            error: logError,
            message: logError?.message,
            campaignId: logEntry.campaignId,
            leadId: logEntry.leadId,
            stepId: logEntry.stepId,
            hint: 'Check if campaign/lead/step IDs exist in database (must be UUIDs, not random strings)'
          });
          // Continue even if log save fails
        }
        
        newLogs.unshift(logEntry); // Add to top of log list
        setLogs([...newLogs]);
        setProgress(prev => ({ ...prev, current: stepIdx * updatedLeads.length + i + 1 }));

        // Update UI immediately - don't wait for log save
        newLogs.unshift(logEntry); // Add to top of log list
        setLogs([...newLogs]);
        setProgress(prev => ({ ...prev, current: i + 1 }));
        console.log(`[Launch Sequence] ✓ Lead ${i + 1} completed, progress: ${i + 1}/${updatedLeads.length}`);
        
        // Save log to database in background (non-blocking)
        (async () => {
          try {
            const { id, ...logWithoutId } = logEntry;
            const logPromise = logService.create(logWithoutId);
            const logTimeout = new Promise<null>((_, reject) => 
              setTimeout(() => reject(new Error('Log save timeout')), 5000)
            );
            
            const savedLog = await Promise.race([logPromise, logTimeout]);
            if (savedLog) {
              logEntry.id = savedLog.id;
              console.log(`[Launch Sequence] Log saved to database: ${savedLog.id}`);
            }
          } catch (logError: any) {
            console.warn('[Launch Sequence] Log save failed (non-critical):', logError.message);
            // Continue - log is already in UI
          }
        })(); // Fire and forget - don't await


        // 3. WAIT BEFORE NEXT LEAD (MANDATORY SEQUENTIAL DELAY)
        if (i < updatedLeads.length - 1) {
            await wait(sendDelay);
        }

      } catch (e: any) {
        // Enhanced error logging with more context
        const errorMessage = e?.message || String(e) || 'Unknown error occurred';
        const errorName = e?.name || 'Error';
        const errorStack = e?.stack ? `\nStack: ${e.stack.substring(0, 500)}` : '';
        
        // Clean up error message - remove stack trace from message if it's already in errorDetails
        let cleanErrorMessage = errorMessage;
        if (errorMessage.includes('Stack:')) {
          cleanErrorMessage = errorMessage.split('Stack:')[0].trim();
        }
        
        const errorDetails = `${cleanErrorMessage}${errorStack}`;
        
        console.error(`[Campaign Execution Error] Lead: ${lead.email}`, {
          error: e,
          errorName: errorName,
          errorMessage: errorMessage,
          webhookUrl: step.webhookUrl,
          leadId: lead.id,
          timestamp: new Date().toISOString(),
          stack: e?.stack
        });

        const errorLog: ExecutionLog = {
          id: Math.random().toString(), // Temporary ID, will be replaced by database
          campaignId: campaignToUse.id,
          leadId: lead.id,
          stepId: step.id,
          timestamp: new Date().toISOString(),
          subject: '',
          body: '',
          status: 'ERROR',
          type: 'WEBHOOK',
          errorDetails: errorDetails
        };
        
        // Save error log to database
        try {
          const { id, ...logWithoutId } = errorLog;
          const savedLog = await logService.create(logWithoutId);
          if (savedLog) {
            errorLog.id = savedLog.id; // Update with database ID
            console.log(`[Execution Log] Error saved to database: ${savedLog.id}`, {
              campaignId: errorLog.campaignId,
              leadId: errorLog.leadId,
              stepId: errorLog.stepId
            });
          } else {
            console.warn('[Execution Log] Failed to save error to database, keeping in memory only', {
              campaignId: errorLog.campaignId,
              leadId: errorLog.leadId,
              stepId: errorLog.stepId,
              reason: 'logService.create returned null - check foreign key constraints and database connection'
            });
          }
        } catch (logError: any) {
          console.error('[Execution Log] Error saving error log to database:', {
            error: logError,
            message: logError?.message,
            campaignId: errorLog.campaignId,
            leadId: errorLog.leadId,
            stepId: errorLog.stepId,
            hint: 'Check if campaign/lead/step IDs exist in database (must be UUIDs, not random strings)'
          });
          // Continue even if log save fails
        }
        
        newLogs.unshift(errorLog);
        setLogs([...newLogs]);
        setProgress(prev => ({ ...prev, current: stepIdx * updatedLeads.length + i + 1 }));
        
        // Even on error, we wait before trying the next lead to avoid spamming
        await wait(sendDelay);
      }
    }

      // Execution completed successfully
      setCurrentProcessingLeadId(null);
      setIsExecuting(false);
      
      const finalCampaign = { ...campaignToUse, leads: updatedLeads, status: CampaignStatus.ACTIVE };
      setLocalCampaign(finalCampaign);
      
      const contactedCount = updatedLeads.filter(l => l.status === 'CONTACTED').length;
      console.log(`[Launch Sequence] Execution completed: ${contactedCount} emails sent`);
      console.log(`[Launch Sequence] Updated leads:`, updatedLeads.map(l => ({ email: l.email, status: l.status })));
      
      // CRITICAL: Update parent campaigns state IMMEDIATELY so Dashboard updates
      // This ensures the UI updates even if database save fails
      try {
        console.log('[Launch Sequence] Updating parent campaigns state immediately...');
        await onSave(finalCampaign);
        console.log('[Launch Sequence] ✓ Campaign state updated in parent component');
      } catch (saveError: any) {
        console.error('[Launch Sequence] Error updating campaign state:', saveError);
        // Even if save fails, the localCampaign state is updated, so the CampaignEditor will show correct data
        // But Dashboard won't update until campaigns state in App.tsx is updated
        // Try to update parent state directly as fallback
        toast.warning(`Emails sent (${contactedCount}) but save failed. Dashboard may not update until you refresh or navigate away and back.`);
      }
      
      toast.success(`Campaign execution completed! ${contactedCount} email(s) sent successfully.`);
      
    } catch (error: any) {
      // Catch any unexpected errors during execution
      console.error('[Launch Sequence] Fatal error in campaign execution:', error);
      toast.error(`Campaign execution failed: ${error.message || 'Unknown error'}`);
      
      // Add error log
      const errorLog: ExecutionLog = {
        id: Math.random().toString(),
        campaignId: campaignToUse.id,
        leadId: '',
        stepId: '',
        smtpAccountId: '',
        timestamp: new Date().toISOString(),
        subject: '',
        body: '',
        status: 'ERROR',
        type: 'SEND',
        errorDetails: `Execution failed: ${error.message || 'Unknown error'}`
      };
      setLogs(prev => [errorLog, ...prev]);
      setCurrentProcessingLeadId(null);
      setIsExecuting(false);
    }

  };

  return (
    <>
      <LoadingOverlay isVisible={isExecuting} message={`Sending emails... ${progress.current} of ${progress.total}`} />
      <Modal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        type={confirmModal.type || 'confirm'}
      />
      <EmailPreview
        isOpen={previewStep.isOpen}
        onClose={() => setPreviewStep({ isOpen: false, step: null })}
        subject={previewData.subject}
        body={previewData.body}
        html={previewData.html}
        fromEmail={smtpAccounts.find(a => localCampaign.senderAccountIds?.includes(a.id))?.fromEmail || smtpAccounts[0]?.fromEmail}
        toEmail="preview@example.com"
      />
      <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-white dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm transition-all">
            <ArrowLeft size={20} className="text-slate-700 dark:text-slate-300" />
          </button>
          <div className="flex-1">
             <input
               type="text"
               value={localCampaign.name}
               onChange={(e) => setLocalCampaign({ ...localCampaign, name: e.target.value })}
               className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight bg-transparent border-none outline-none focus:ring-2 focus:ring-blue-500 rounded-lg px-2 -ml-2 w-full max-w-md"
               placeholder="Campaign Name"
             />
             <div className="flex items-center gap-2 mt-1">
                 <span className={`w-2 h-2 rounded-full ${isExecuting ? 'bg-emerald-500 dark:bg-emerald-400 animate-pulse' : 'bg-slate-300 dark:bg-slate-600'}`}></span>
                 <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-widest">
                    {isExecuting ? `Processing Lead ${progress.current + 1} of ${progress.total}` : localCampaign.status}
                 </span>
             </div>
          </div>
        </div>
        <div className="flex gap-3">
          <Tooltip content="Save campaign changes">
            <button 
              onClick={async () => {
                if (isSaving) return; // Prevent double-clicks
                setIsSaving(true);
                console.log('[Save Button] Save clicked, starting save operation...');
                
                // Use a timeout to ensure button state is always reset
                const resetTimeout = setTimeout(() => {
                  console.warn('[Save Button] Force resetting save state after 2 minutes');
                  setIsSaving(false);
                }, 120000); // 2 minute absolute maximum
                
                try {
                  // Call onSave and await it
                  const savePromise = onSave(localCampaign);
                  
                  // Calculate timeout based on lead count
                  // For campaigns with 0 leads, use shorter timeout (20 seconds)
                  // For campaigns with leads: 100ms per lead + 10 seconds base time
                  const estimatedTime = localCampaign.leads.length === 0 
                    ? 20000  // 20 seconds for campaigns with no leads
                    : Math.max(60000, (localCampaign.leads.length * 100) + 10000); // Minimum 60 seconds for campaigns with leads
                  console.log(`[Save Button] Estimated save time: ${estimatedTime}ms for ${localCampaign.leads.length} leads`);
                  
                  // Add timeout to prevent infinite loading
                  const timeoutPromise = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error(`Save operation timed out after ${Math.floor(estimatedTime/1000)} seconds. Large campaigns may take longer.`)), estimatedTime)
                  );
                  
                  await Promise.race([savePromise, timeoutPromise]);
                  clearTimeout(resetTimeout);
                  console.log('[Save Button] Save completed successfully');
                  // Success toast is shown in onSave handler
                } catch (error: any) {
                  clearTimeout(resetTimeout);
                  console.error('[Save Button] Error saving campaign:', error);
                  toast.error(`Failed to save campaign: ${error.message || 'Unknown error'}`);
                } finally {
                  // Always reset the saving state, even if something goes wrong
                  clearTimeout(resetTimeout);
                  setIsSaving(false);
                  console.log('[Save Button] Save operation finished, button state reset');
                }
              }}
              disabled={isSaving}
              className={`px-5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2 shadow-sm transition-all ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />} {isSaving ? 'Saving...' : 'Save'}
            </button>
          </Tooltip>
          <Tooltip content={isExecuting ? "Campaign is currently executing" : "Start sending emails to all leads in this campaign"}>
            <button 
              onClick={runCampaignExecution} 
              disabled={isExecuting} 
              className={`px-5 py-2.5 text-white font-black rounded-xl flex items-center gap-2 shadow-md transition-all ${isExecuting ? 'bg-slate-400 dark:bg-slate-600 cursor-not-allowed' : 'bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600'}`}
            >
              {isExecuting ? <Loader2 className="animate-spin" size={18} /> : <Play className="fill-white" size={18} />}
              {isExecuting ? 'Sending Sequence...' : 'Launch Sequence'}
            </button>
          </Tooltip>
        </div>
      </div>

      <div className="flex gap-1 border-b border-slate-200 dark:border-slate-700">
        <TabButton active={activeTab === 'sequence'} onClick={() => setActiveTab('sequence')} icon={<List size={16} />} label="Sequence & Config" />
        <TabButton active={activeTab === 'schedule'} onClick={() => setActiveTab('schedule')} icon={<Calendar size={16} />} label="Schedule" />
        <TabButton active={activeTab === 'logs'} onClick={() => setActiveTab('logs')} icon={<History size={16} />} label="Live Terminal" />
      </div>

      {activeTab === 'sequence' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl p-6 shadow-sm overflow-hidden relative">
                <div className="absolute right-0 top-0 p-8 opacity-5 dark:opacity-10">
                    <Server size={80} className="text-slate-900 dark:text-slate-100" />
                </div>
                <h3 className="font-bold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2"><Server size={18} className="text-blue-600 dark:text-blue-400" /> Dispatch Engine</h3>
                <div className="space-y-4 relative z-10">
                    <div>
                        <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1 block">Local SMTP Node URL</label>
                        <input 
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="http://localhost:3001"
                            value={backendUrl}
                            onChange={e => setBackendUrl(e.target.value)}
                        />
                    </div>
                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block">Send Delay (Seconds between leads)</label>
                            <span className="text-xs font-bold text-blue-600 dark:text-blue-400">{sendDelay}s</span>
                        </div>
                        <input 
                            type="range" min="1" max="60" step="1"
                            className="w-full h-2 bg-slate-100 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-600 dark:accent-blue-500"
                            value={sendDelay}
                            onChange={e => setSendDelay(parseInt(e.target.value))}
                        />
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-2 flex items-center gap-1"><Clock size={10} /> Helps avoid n8n timeout and SMTP rate limits.</p>
                    </div>
                </div>
            </div>

            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <List size={18} className="text-blue-600 dark:text-blue-400" />
                Email Sequence & Follow-ups
              </h3>
              <button
                onClick={addStep}
                className="px-4 py-2 text-sm font-bold bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-xl flex items-center gap-2 transition-all border border-blue-200 dark:border-blue-800"
              >
                <Plus size={18} />
                Add Follow-up
              </button>
            </div>

            {localCampaign.steps.map((step, idx) => (
                <div key={step.id} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl overflow-hidden shadow-sm">
                    <div className="p-4 bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700 font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xs">{idx + 1}</div>
                          {idx === 0 ? 'Initial Email' : `Follow-up ${idx}`}
                        </div>
                        {localCampaign.steps.length > 1 && (
                          <button
                            onClick={() => removeStep(step.id)}
                            className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 text-slate-400 hover:text-red-600 dark:hover:text-red-400 rounded-lg transition-all"
                            title="Remove step"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                    </div>
                    <div className="p-6 space-y-4">
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block">n8n Webhook Endpoint</label>
                                <button
                                    onClick={() => testWebhook(step)}
                                    disabled={testingWebhook === step.id}
                                    className="px-3 py-1.5 text-[10px] font-bold bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 rounded-lg flex items-center gap-1.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {testingWebhook === step.id ? (
                                        <>
                                            <Loader2 size={12} className="animate-spin" />
                                            Testing...
                                        </>
                                    ) : (
                                        <>
                                            <Zap size={12} />
                                            Test Webhook
                                        </>
                                    )}
                                </button>
                            </div>
                            <input 
                                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-xs font-mono focus:ring-2 focus:ring-blue-500 outline-none" 
                                placeholder="https://your-n8n.com/webhook/..." 
                                value={step.webhookUrl} 
                                onChange={e => {
                                    updateStep(step.id, { webhookUrl: e.target.value });
                                    // Clear test result when URL changes
                                    const newResults = { ...testResults };
                                    delete newResults[step.id];
                                    setTestResults(newResults);
                                }} 
                            />
                            {testResults[step.id] && (
                                <div className={`mt-2 p-3 rounded-lg text-xs font-medium ${
                                    testResults[step.id].success 
                                        ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800' 
                                        : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800'
                                }`}>
                                    {testResults[step.id].message}
                                    {testResults[step.id].success && (
                                        <div className="mt-2 text-[10px] text-emerald-600 dark:text-emerald-400 font-normal">
                                            Check your n8n "Executions" tab to see the execution details.
                                        </div>
                                    )}
                                    {!testResults[step.id].success && testResults[step.id].message.includes('CORS') && (
                                        <div className="mt-2 text-[10px] text-red-600 dark:text-red-400 font-normal">
                                            💡 Quick fix: Enable CORS in n8n Settings → Security → Add "{window.location.origin}" to allowed origins
                                        </div>
                                    )}
                                </div>
                            )}
                            {step.webhookUrl && step.webhookUrl.trim() !== '' && (
                                <div className="mt-2 p-3 rounded-lg text-[10px] bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                                    <div className="flex items-start gap-2">
                                        <Info size={12} className="mt-0.5 shrink-0" />
                                        <div>
                                            <div className="font-bold mb-1">CORS Configuration Required</div>
                                            <div className="font-normal opacity-90">
                                                Make sure CORS is enabled in your n8n instance. Go to n8n Settings → Security → Enable CORS and add <code className="bg-blue-100 dark:bg-blue-900/40 px-1 rounded">{window.location.origin}</code> to allowed origins.
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 block">
                              <Clock size={12} className="inline mr-1" />
                              Send After (wait before this step)
                            </label>
                            <div className="flex gap-3 flex-wrap">
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  min={0}
                                  className="w-16 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm font-mono"
                                  value={step.delayDays ?? 0}
                                  onChange={e => updateStep(step.id, { delayDays: Math.max(0, parseInt(e.target.value) || 0) })}
                                />
                                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">days</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  min={0}
                                  max={23}
                                  className="w-16 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm font-mono"
                                  value={step.delayHours ?? 0}
                                  onChange={e => updateStep(step.id, { delayHours: Math.min(23, Math.max(0, parseInt(e.target.value) || 0)) })}
                                />
                                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">hours</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <input
                                  type="number"
                                  min={0}
                                  max={59}
                                  className="w-16 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm font-mono"
                                  value={step.delayMinutes ?? 0}
                                  onChange={e => updateStep(step.id, { delayMinutes: Math.min(59, Math.max(0, parseInt(e.target.value) || 0)) })}
                                />
                                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">min</span>
                              </div>
                            </div>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1.5">
                              {idx === 0 ? 'Initial email sends immediately (0 delay).' : `Follow-up sends ${((step.delayDays ?? 0) * 24 * 60) + ((step.delayHours ?? 0) * 60) + (step.delayMinutes ?? 0)} minutes after previous step.`}
                            </p>

                            {testResults[step.id]?.success && (
                                <button
                                    onClick={async () => {
                                        // Test webhook to get preview data
                                        try {
                                            const testLeadData = {
                                                lead_data: {
                                                    id: 'preview-lead',
                                                    email: 'preview@example.com',
                                                    firstName: 'John',
                                                    lastName: 'Doe',
                                                    company: 'Example Company',
                                                    website: 'https://example.com'
                                                },
                                                step: {
                                                    id: step.id,
                                                    promptHint: step.promptHint || 'Preview prompt'
                                                },
                                                timestamp: new Date().toISOString()
                                            };
                                            
                                            const response = await fetch(step.webhookUrl, {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify(testLeadData)
                                            });
                                            
                                            const data = await response.json();
                                            if (data.subject && data.body) {
                                                setPreviewData({
                                                    subject: data.subject,
                                                    body: data.body,
                                                    html: data.body.replace(/\n/g, '<br>')
                                                });
                                                setPreviewStep({ isOpen: true, step });
                                            }
                                        } catch (error) {
                                            toast.error('Failed to load preview. Please test the webhook first.');
                                        }
                                    }}
                                    className="mt-2 px-3 py-1.5 bg-indigo-600 dark:bg-indigo-500 text-white rounded-lg text-xs font-bold hover:bg-indigo-700 dark:hover:bg-indigo-600 flex items-center gap-1.5"
                                >
                                    <Eye size={12} />
                                    Preview Email
                                </button>
                            )}

                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1 block">Persona / Prompt Hint</label>
                            <div className="mb-2 text-[10px] text-slate-500 dark:text-slate-400">
                                Available variables: <code className="bg-slate-100 dark:bg-slate-700 px-1 rounded">{'{{firstName}}'}</code>, <code className="bg-slate-100 dark:bg-slate-700 px-1 rounded">{'{{lastName}}'}</code>, <code className="bg-slate-100 dark:bg-slate-700 px-1 rounded">{'{{company}}'}</code>, <code className="bg-slate-100 dark:bg-slate-700 px-1 rounded">{'{{email}}'}</code>, <code className="bg-slate-100 dark:bg-slate-700 px-1 rounded">{'{{website}}'}</code>
                            </div>
                            <textarea 
                                rows={3} 
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-blue-500 outline-none" 
                                placeholder="Example: Write a casual, friendly 2-sentence intro about their company {{company}}..." 
                                value={step.promptHint} 
                                onChange={e => updateStep(step.id, { promptHint: e.target.value })} 
                            />
                        </div>
                    </div>
                </div>
            ))}
          </div>

          <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm h-fit">
              <h3 className="font-black mb-4 text-slate-900 dark:text-slate-100 text-sm flex items-center gap-2 uppercase tracking-tight"><SettingsIcon size={18} className="text-slate-400 dark:text-slate-500" /> Infrastructure</h3>
              <div className="space-y-4">
                  <div>
                      <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1 block">Sender Accounts (Multiple Selection)</label>
                      <div className="space-y-2 max-h-48 overflow-y-auto border border-slate-200 dark:border-slate-600 rounded-xl p-2 bg-slate-50 dark:bg-slate-700">
                          {smtpAccounts.map(a => {
                              const isSelected = localCampaign.senderAccountIds?.includes(a.id) || false;
                              return (
                                  <label key={a.id} className="flex items-center gap-2 p-2 hover:bg-white dark:hover:bg-slate-600 rounded-lg cursor-pointer">
                                      <input 
                                          type="checkbox" 
                                          checked={isSelected}
                                          onChange={(e) => {
                                              const currentIds = localCampaign.senderAccountIds || [];
                                              if (e.target.checked) {
                                                  setLocalCampaign({...localCampaign, senderAccountIds: [...currentIds, a.id]});
                                              } else {
                                                  setLocalCampaign({...localCampaign, senderAccountIds: currentIds.filter(id => id !== a.id)});
                                              }
                                          }}
                                          className="rounded border-slate-300 dark:border-slate-600"
                                      />
                                      <div className="flex-1">
                                          <div className="text-xs font-bold text-slate-900 dark:text-slate-100">{a.label}</div>
                                          <div className="text-[10px] text-slate-400 dark:text-slate-500">{a.fromEmail} • {a.sentToday || 0}/{a.dailySendLimit || 100} today</div>
                                      </div>
                                  </label>
                              );
                          })}
                          {smtpAccounts.length === 0 && (
                              <div className="text-xs text-slate-400 dark:text-slate-500 text-center py-4">No SMTP accounts available. Add accounts in Settings.</div>
                          )}
                      </div>
                      <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-2">Select multiple accounts for domain rotation. All emails for a lead will use the same inbox.</p>
                  </div>
                  {/* Legacy single account selector (hidden but kept for backward compatibility) */}
                  <div className="hidden">
                      <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1 block">Sender Identity (Legacy)</label>
                      <select className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 text-sm font-medium outline-none bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-slate-100" value={localCampaign.senderAccountId || ''} onChange={e => setLocalCampaign({...localCampaign, senderAccountId: e.target.value})}>
                          <option value="">Select Account...</option>
                          {smtpAccounts.map(a => <option key={a.id} value={a.id}>{a.label} ({a.fromEmail})</option>)}
                      </select>
                  </div>
                  <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-2xl border border-amber-100 dark:border-amber-800 flex gap-3">
                      <AlertCircle className="text-amber-600 dark:text-amber-400 shrink-0" size={16} />
                      <p className="text-[10px] text-amber-800 dark:text-amber-300 leading-relaxed font-medium">
                          Ensure your <code className="bg-amber-100 dark:bg-amber-900/40 px-1 rounded">server.js</code> is running on the specified port. The process is strictly <strong>sequential</strong>: n8n finishes → SMTP sends → Wait {sendDelay}s → Next lead.
                      </p>
                  </div>
              </div>
          </div>
        </div>
      )}

      {activeTab === 'schedule' && (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl p-6 shadow-sm">
          <h3 className="font-bold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2"><Calendar size={18} className="text-blue-600 dark:text-blue-400" /> Automated Scheduling</h3>
          <div className="space-y-6">
            <div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={localCampaign.schedule.enabled || false}
                  onChange={(e) => setLocalCampaign({
                    ...localCampaign,
                    schedule: { ...localCampaign.schedule, enabled: e.target.checked }
                  })}
                  className="w-5 h-5 rounded border-slate-300 dark:border-slate-600"
                />
                <span className="text-sm font-bold text-slate-900 dark:text-slate-100">Enable Automated Scheduling</span>
              </label>
              <p className="text-xs text-slate-400 dark:text-slate-500 mt-2 ml-8">Campaign will run automatically based on schedule settings</p>
            </div>

            {localCampaign.schedule.enabled && (
              <>
                <div>
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1 block">Schedule Type</label>
                  <select
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 text-sm font-medium outline-none bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                    value={localCampaign.schedule.type || 'DAILY'}
                    onChange={(e) => setLocalCampaign({
                      ...localCampaign,
                      schedule: { ...localCampaign.schedule, type: e.target.value as 'DAILY' | 'ONCE' | 'WEEKLY' }
                    })}
                  >
                    <option value="DAILY">Daily (Recurring)</option>
                    <option value="ONCE">Once (Specific Date)</option>
                    <option value="WEEKLY">Weekly (Recurring)</option>
                  </select>
                </div>

                {(localCampaign.schedule.type === 'ONCE' || localCampaign.schedule.type === 'WEEKLY') && (
                  <div>
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1 block">Start Date</label>
                    <input
                      type="date"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 text-sm font-medium outline-none bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                      value={localCampaign.schedule.startDate || ''}
                      onChange={(e) => setLocalCampaign({
                        ...localCampaign,
                        schedule: { ...localCampaign.schedule, startDate: e.target.value }
                      })}
                    />
                  </div>
                )}

                <div>
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1 block">Days of Week</label>
                  <div className="grid grid-cols-7 gap-2">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
                      <label key={index} className="flex flex-col items-center gap-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={localCampaign.schedule.days.includes(index)}
                          onChange={(e) => {
                            const days = [...localCampaign.schedule.days];
                            if (e.target.checked) {
                              if (!days.includes(index)) days.push(index);
                            } else {
                              const idx = days.indexOf(index);
                              if (idx > -1) days.splice(idx, 1);
                            }
                            setLocalCampaign({
                              ...localCampaign,
                              schedule: { ...localCampaign.schedule, days: days.sort() }
                            });
                          }}
                          className="w-4 h-4 rounded border-slate-300 dark:border-slate-600"
                        />
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-400">{day}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1 block">Start Time</label>
                    <input
                      type="time"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 text-sm font-medium outline-none bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                      value={localCampaign.schedule.startTime}
                      onChange={(e) => setLocalCampaign({
                        ...localCampaign,
                        schedule: { ...localCampaign.schedule, startTime: e.target.value }
                      })}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1 block">End Time</label>
                    <input
                      type="time"
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 text-sm font-medium outline-none bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                      value={localCampaign.schedule.endTime}
                      onChange={(e) => setLocalCampaign({
                        ...localCampaign,
                        schedule: { ...localCampaign.schedule, endTime: e.target.value }
                      })}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1 block">Timezone</label>
                  <select
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 text-sm font-medium outline-none bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                    value={localCampaign.schedule.timezone}
                    onChange={(e) => setLocalCampaign({
                      ...localCampaign,
                      schedule: { ...localCampaign.schedule, timezone: e.target.value }
                    })}
                  >
                    <option value="UTC">UTC</option>
                    <option value="America/New_York">Eastern Time</option>
                    <option value="America/Chicago">Central Time</option>
                    <option value="America/Denver">Mountain Time</option>
                    <option value="America/Los_Angeles">Pacific Time</option>
                    <option value="Europe/London">London</option>
                    <option value="Europe/Paris">Paris</option>
                    <option value="Asia/Tokyo">Tokyo</option>
                  </select>
                </div>

                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl border border-blue-100 dark:border-blue-800">
                  <p className="text-xs text-blue-800 dark:text-blue-300 leading-relaxed font-medium">
                    <strong>Note:</strong> Automated scheduling requires a backend cron job or scheduled function to check and execute campaigns. The schedule settings are saved but execution must be triggered by your backend service.
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {activeTab === 'logs' && (
          <div className="bg-slate-900 dark:bg-slate-950 rounded-3xl p-8 border border-slate-800 dark:border-slate-800 shadow-2xl min-h-[500px] flex flex-col">
              <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-800 dark:border-slate-700">
                  <div className="flex items-center gap-3">
                      <div className="w-3 h-3 bg-emerald-500 dark:bg-emerald-400 rounded-full animate-pulse"></div>
                      <span className="text-xs font-black uppercase text-slate-400 dark:text-slate-500 tracking-widest">Active Sequence Stream</span>
                  </div>
                  <div className="flex items-center gap-4">
                      <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 uppercase">
                          Progress: {progress.current} / {progress.total}
                      </div>
                      <div className="h-4 w-[100px] bg-slate-800 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500 dark:bg-blue-400 transition-all duration-500" style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }}></div>
                      </div>
                  </div>
              </div>
              
              <div className="flex-1 space-y-4 font-mono text-[11px] overflow-y-auto max-h-[600px] scrollbar-hide">
                  {isExecuting && currentProcessingLeadId && (
                      <div className="border-l-2 border-blue-500 dark:border-blue-400 pl-4 py-3 bg-blue-500/5 dark:bg-blue-400/10 rounded-r-xl animate-in fade-in slide-in-from-left-2 mb-4">
                          <div className="flex items-center gap-3 text-blue-400 dark:text-blue-300 font-bold mb-1">
                              <Loader2 className="animate-spin" size={12} />
                              <span>PROCESSING NEXT LEAD</span>
                          </div>
                          <div className="text-slate-300 dark:text-slate-400">
                              Target: {localCampaign.leads.find(l => l.id === currentProcessingLeadId)?.email}
                          </div>
                          <div className="text-slate-500 dark:text-slate-500 italic text-[10px] mt-1">
                              Triggering Webhook at {localCampaign.steps[0]?.webhookUrl?.substring(0, 40) || '...'}...
                          </div>
                      </div>
                  )}

                  {logs.length === 0 && !isExecuting ? (
                      <div className="text-slate-700 dark:text-slate-500 flex flex-col items-center justify-center h-full gap-4 py-20">
                          <Terminal size={40} className="opacity-20 dark:opacity-30" />
                          <p className="italic uppercase tracking-widest font-black text-[10px]">Ready for initial dispatch</p>
                      </div>
                  ) : logs.map(log => (
                    <div key={log.id} className={`border-l-2 ${log.status === 'SUCCESS' ? 'border-emerald-500 dark:border-emerald-400' : 'border-red-500 dark:border-red-400'} pl-4 py-2 transition-all hover:bg-slate-800/50 dark:hover:bg-slate-800/70 rounded-r-lg`}>
                        <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                                <span className="text-slate-600 dark:text-slate-400">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                                <span className={log.status === 'SUCCESS' ? 'text-emerald-500 dark:text-emerald-400 font-bold' : 'text-red-500 dark:text-red-400 font-bold'}>
                                    {!log.leadId ? 'WAITING' : log.status === 'SUCCESS' ? 'REAL_SEND_SUCCESS' : 'SEQUENCE_FAILED'}
                                </span>
                                <span className="text-slate-500 dark:text-slate-500">→</span>
                                <span className="text-blue-400 dark:text-blue-300 font-bold">{log.leadId ? localCampaign.leads.find(l => l.id === log.leadId)?.email : log.subject}</span>
                            </div>
                            <span className="text-[9px] text-slate-700 dark:text-slate-500 font-bold uppercase tracking-tighter">ID: {log.id.substring(0, 6)}</span>
                        </div>
                        {log.status === 'SUCCESS' ? (
                            <div className="space-y-1 mt-2 pl-2 border-l border-slate-800 dark:border-slate-700">
                                {log.leadId ? (
                                  <>
                                    <div className="text-purple-400/80 dark:text-purple-300/80 flex items-center gap-2">
                                        <CheckCircle2 size={10} /> Webhook: AI Content Received (Subject: {log.subject})
                                    </div>
                                    <div className="text-blue-400/80 dark:text-blue-300/80 flex items-center gap-2">
                                        <Mail size={10} /> SMTP Dispatch: Accepted by Local Relay
                                    </div>
                                  </>
                                ) : (
                                    <div className="text-amber-400/80 dark:text-amber-300/80 flex items-center gap-2">
                                        <Clock size={10} /> {log.subject}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="text-red-400/80 dark:text-red-300/80 bg-red-950/20 dark:bg-red-900/30 p-2 rounded border border-red-900/30 dark:border-red-800/50 mt-2 text-[10px]">
                                <span className="font-black mr-2">TRACE:</span> {log.errorDetails}
                            </div>
                        )}
                    </div>
                  ))}
              </div>
          </div>
      )}
    </div>
    </>
  );
};

const TabButton: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string }> = ({ active, onClick, icon, label }) => (
    <button onClick={onClick} className={`px-4 py-4 text-xs font-black uppercase tracking-widest flex items-center gap-2 border-b-2 transition-all ${active ? 'border-blue-600 dark:border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
        {icon} {label}
    </button>
);

export default CampaignEditor;
