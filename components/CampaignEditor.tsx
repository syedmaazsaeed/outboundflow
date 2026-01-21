
import React, { useState, useMemo, useEffect } from 'react';
import { Campaign, CampaignStatus, SequenceStep, SmtpAccount, ExecutionLog, Lead } from '../types';
import { ArrowLeft, Save, Plus, Trash2, Webhook, Zap, Loader2, CheckCircle2, AlertCircle, History, Play, Calendar, List, Settings as SettingsIcon, Code, Info, Terminal, Mail, Server, Clock, Pause, StopCircle } from 'lucide-react';

interface CampaignEditorProps {
  campaign: Campaign;
  smtpAccounts: SmtpAccount[];
  onSave: (campaign: Campaign) => void;
  onBack: () => void;
}

const CampaignEditor: React.FC<CampaignEditorProps> = ({ campaign, smtpAccounts, onSave, onBack }) => {
  const [localCampaign, setLocalCampaign] = useState<Campaign>({
    ...campaign,
    schedule: campaign.schedule || { days: [1,2,3,4,5], startTime: "09:00", endTime: "17:00", timezone: "UTC" }
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

  const wait = (seconds: number) => new Promise(resolve => setTimeout(resolve, seconds * 1000));

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
      const response = await fetch(step.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testLeadData)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
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

  const runCampaignExecution = async () => {
    if (localCampaign.leads.length === 0) return alert('No leads in campaign');
    const sender = smtpAccounts.find(a => a.id === localCampaign.senderAccountId);
    if (!sender) return alert('Please select a Sender Account in Infrastructure tab first');
    
    // Validate webhook URL
    const firstStep = localCampaign.steps[0];
    if (!firstStep || !firstStep.webhookUrl || firstStep.webhookUrl.trim() === '') {
      return alert('Please configure a webhook URL in the Sequence & Config tab');
    }
    
    // Validate webhook URL format
    try {
      new URL(firstStep.webhookUrl);
    } catch (e) {
      return alert('Please enter a valid webhook URL (e.g., https://your-n8n.com/webhook/...)');
    }
    
    setIsExecuting(true);
    setActiveTab('logs');
    setProgress({ current: 0, total: localCampaign.leads.length });
    setLogs([]); // Clear previous logs
    
    const updatedLeads = [...localCampaign.leads];
    const newLogs: ExecutionLog[] = [];

    for (let i = 0; i < updatedLeads.length; i++) {
      const lead = updatedLeads[i];
      const step = localCampaign.steps[0];
      
      setCurrentProcessingLeadId(lead.id);
      
      try {
        // 1. CALL N8N WEBHOOK FOR AI CONTENT (SEQUENTIAL)
        const webhookResponse = await fetch(step.webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lead_data: { ...lead.customFields, id: lead.id, email: lead.email, firstName: lead.firstName, lastName: lead.lastName, company: lead.company },
            step: { id: step.id, promptHint: step.promptHint },
            timestamp: new Date().toISOString()
          })
        });
        
        if (!webhookResponse.ok) {
          throw new Error(`n8n HTTP Error: ${webhookResponse.status} ${webhookResponse.statusText}`);
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

        // 2. CALL REAL BACKEND FOR SMTP DISPATCH
        const dispatchResponse = await fetch(`${backendUrl}/send-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            smtp: sender,
            mailOptions: {
              to: lead.email,
              subject: data.subject,
              body: data.body
            }
          })
        });

        const dispatchResult = await dispatchResponse.json();
        if (!dispatchResponse.ok) throw new Error(`Backend Error: ${dispatchResult.error}`);

        // Update local lead state
        updatedLeads[i] = { ...lead, status: 'CONTACTED' };

        const logEntry: ExecutionLog = {
          id: Math.random().toString(),
          campaignId: localCampaign.id,
          leadId: lead.id,
          stepId: step.id,
          timestamp: new Date().toISOString(),
          subject: data.subject,
          body: data.body,
          status: 'SUCCESS',
          type: 'SEND'
        };
        
        newLogs.unshift(logEntry); // Add to top of log list
        setLogs([...newLogs]);
        setProgress(prev => ({ ...prev, current: i + 1 }));

        // 3. WAIT BEFORE NEXT LEAD (MANDATORY SEQUENTIAL DELAY)
        if (i < updatedLeads.length - 1) {
            await wait(sendDelay);
        }

      } catch (e: any) {
        const errorLog: ExecutionLog = {
          id: Math.random().toString(),
          campaignId: localCampaign.id,
          leadId: lead.id,
          stepId: step.id,
          timestamp: new Date().toISOString(),
          subject: '',
          body: '',
          status: 'ERROR',
          type: 'WEBHOOK',
          errorDetails: e.message
        };
        newLogs.unshift(errorLog);
        setLogs([...newLogs]);
        setProgress(prev => ({ ...prev, current: i + 1 }));
        
        // Even on error, we wait before trying the next lead to avoid spamming
        await wait(sendDelay);
      }
    }

    setCurrentProcessingLeadId(null);
    setIsExecuting(false);
    onSave({ ...localCampaign, leads: updatedLeads, status: CampaignStatus.ACTIVE });
  };

  return (
    <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="p-2 hover:bg-white dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm transition-all">
            <ArrowLeft size={20} className="text-slate-700 dark:text-slate-300" />
          </button>
          <div>
             <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight">{localCampaign.name}</h1>
             <div className="flex items-center gap-2 mt-1">
                 <span className={`w-2 h-2 rounded-full ${isExecuting ? 'bg-emerald-500 dark:bg-emerald-400 animate-pulse' : 'bg-slate-300 dark:bg-slate-600'}`}></span>
                 <span className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-widest">
                    {isExecuting ? `Processing Lead ${progress.current + 1} of ${progress.total}` : localCampaign.status}
                 </span>
             </div>
          </div>
        </div>
        <div className="flex gap-3">
          <button onClick={() => onSave(localCampaign)} className="px-5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2 shadow-sm transition-all">
            <Save size={18} /> Save
          </button>
          <button 
            onClick={runCampaignExecution} 
            disabled={isExecuting} 
            className={`px-5 py-2.5 text-white font-black rounded-xl flex items-center gap-2 shadow-md transition-all ${isExecuting ? 'bg-slate-400 dark:bg-slate-600 cursor-not-allowed' : 'bg-blue-600 dark:bg-blue-500 hover:bg-blue-700 dark:hover:bg-blue-600'}`}
          >
            {isExecuting ? <Loader2 className="animate-spin" size={18} /> : <Play className="fill-white" size={18} />}
            {isExecuting ? 'Sending Sequence...' : 'Launch Sequence'}
          </button>
        </div>
      </div>

      <div className="flex gap-1 border-b border-slate-200 dark:border-slate-700">
        <TabButton active={activeTab === 'sequence'} onClick={() => setActiveTab('sequence')} icon={<List size={16} />} label="Sequence & Config" />
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

            {localCampaign.steps.map((step, idx) => (
                <div key={step.id} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-3xl overflow-hidden shadow-sm">
                    <div className="p-4 bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700 font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xs">{idx + 1}</div>
                        AI Generation via n8n
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
                                </div>
                            )}
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1 block">Persona / Prompt Hint</label>
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
                      <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1 block">Sender Identity</label>
                      <select className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 text-sm font-medium outline-none bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-slate-100" value={localCampaign.senderAccountId} onChange={e => setLocalCampaign({...localCampaign, senderAccountId: e.target.value})}>
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
                          <div className="h-full bg-blue-500 dark:bg-blue-400 transition-all duration-500" style={{ width: `${(progress.current / progress.total) * 100}%` }}></div>
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
                              Step 1/2: Triggering Webhook at {localCampaign.steps[0].webhookUrl.substring(0, 40)}...
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
                                    {log.status === 'SUCCESS' ? 'REAL_SEND_SUCCESS' : 'SEQUENCE_FAILED'}
                                </span>
                                <span className="text-slate-500 dark:text-slate-500">→</span>
                                <span className="text-blue-400 dark:text-blue-300 font-bold">{localCampaign.leads.find(l => l.id === log.leadId)?.email}</span>
                            </div>
                            <span className="text-[9px] text-slate-700 dark:text-slate-500 font-bold uppercase tracking-tighter">ID: {log.id.substring(0, 6)}</span>
                        </div>
                        {log.status === 'SUCCESS' ? (
                            <div className="space-y-1 mt-2 pl-2 border-l border-slate-800 dark:border-slate-700">
                                <div className="text-purple-400/80 dark:text-purple-300/80 flex items-center gap-2">
                                    <CheckCircle2 size={10} /> Webhook: AI Content Received (Subject: {log.subject})
                                </div>
                                <div className="text-blue-400/80 dark:text-blue-300/80 flex items-center gap-2">
                                    <Mail size={10} /> SMTP Dispatch: Accepted by Local Relay
                                </div>
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
  );
};

const TabButton: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string }> = ({ active, onClick, icon, label }) => (
    <button onClick={onClick} className={`px-4 py-4 text-xs font-black uppercase tracking-widest flex items-center gap-2 border-b-2 transition-all ${active ? 'border-blue-600 dark:border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}>
        {icon} {label}
    </button>
);

export default CampaignEditor;
