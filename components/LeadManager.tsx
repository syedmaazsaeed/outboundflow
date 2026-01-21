
import React, { useState } from 'react';
import { Campaign, Lead } from '../types';
import { UserPlus, Upload, Trash2, Search, Filter, ShieldCheck, Loader2, Table as TableIcon, CheckCircle, AlertCircle, X } from 'lucide-react';

interface LeadManagerProps {
  campaigns: Campaign[];
  onUpdateLeads: (campaignId: string, leads: Lead[]) => void;
}

const LeadManager: React.FC<LeadManagerProps> = ({ campaigns, onUpdateLeads }) => {
  const [selectedId, setSelectedId] = useState<string>(campaigns[0]?.id || '');
  const [search, setSearch] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const currentCampaign = campaigns.find(c => c.id === selectedId);
  const filteredLeads = currentCampaign?.leads.filter(l => 
    l.email.toLowerCase().includes(search.toLowerCase()) || 
    l.firstName.toLowerCase().includes(search.toLowerCase()) ||
    l.lastName.toLowerCase().includes(search.toLowerCase()) ||
    l.company.toLowerCase().includes(search.toLowerCase())
  ) || [];

  const verifyLeads = async () => {
    if (!currentCampaign) return;
    setIsVerifying(true);
    await new Promise(r => setTimeout(r, 2000));
    
    const verifiedLeads = currentCampaign.leads.map(l => ({
        ...l,
        verificationStatus: (Math.random() > 0.1 ? 'VERIFIED' : 'INVALID') as Lead['verificationStatus']
    }));
    
    onUpdateLeads(currentCampaign.id, verifiedLeads);
    setIsVerifying(false);
  };

  // Parse CSV line handling quoted values
  const parseCsvLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];
      
      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote
          current += '"';
          i++; // Skip next quote
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        // End of field
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    // Add last field
    result.push(current.trim());
    return result;
  };

  const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setImportMessage({ type: 'error', text: 'No file selected' });
      setTimeout(() => setImportMessage(null), 3000);
      return;
    }

    // Reset file input so same file can be uploaded again
    e.target.value = '';

    if (!currentCampaign) {
      setImportMessage({ type: 'error', text: 'Please select a campaign first' });
      setTimeout(() => setImportMessage(null), 3000);
      return;
    }

    setIsImporting(true);
    setImportMessage(null);

    const reader = new FileReader();
    let isCompleted = false;
    let safetyTimeout: NodeJS.Timeout | null = null;
    
    // Set a safety timeout to ensure loading state is cleared
    safetyTimeout = setTimeout(() => {
      if (!isCompleted) {
        console.warn('CSV import taking too long, clearing loading state');
        isCompleted = true;
        setIsImporting(false);
        setImportMessage({ 
          type: 'error', 
          text: 'Import is taking too long. Please check your connection and try again.' 
        });
        setTimeout(() => setImportMessage(null), 5000);
      }
    }, 60000); // 60 second safety timeout
    
    const clearSafetyTimeout = () => {
      if (safetyTimeout) {
        clearTimeout(safetyTimeout);
        safetyTimeout = null;
      }
    };
    
    reader.onload = async (event) => {
      try {
          const text = event.target?.result as string;
          if (!text || text.trim().length === 0) {
            throw new Error('File is empty');
          }

          const lines = text.split(/\r?\n/).filter(l => l.trim() !== '');
          if (lines.length < 2) {
            throw new Error('CSV file must have at least a header row and one data row');
          }

          // Parse header
          const headers = parseCsvLine(lines[0]).map(h => h.replace(/^"|"$/g, '').trim());
          
          if (!headers.includes('email') && !headers.includes('Email')) {
            // Check case-insensitive
            const hasEmail = headers.some(h => h.toLowerCase() === 'email');
            if (!hasEmail) {
              throw new Error('CSV file must have an "email" column');
            }
          }

          // Parse rows
          const rows = lines.slice(1);
          const newLeads: Lead[] = [];

          for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            if (!row.trim()) continue; // Skip empty rows

            try {
              const values = parseCsvLine(row).map(v => v.replace(/^"|"$/g, '').trim());
              const data: Record<string, string> = {};
              
              headers.forEach((header, index) => {
                data[header] = values[index] || '';
              });

              // Try to map common headers (case-insensitive)
              const getField = (keys: string[]) => {
                for (const key of keys) {
                  const found = Object.keys(data).find(k => k.toLowerCase() === key.toLowerCase());
                  if (found) return data[found];
                }
                return '';
              };

              const firstName = getField(['firstName', 'first_name', 'First Name', 'firstname', 'fname']);
              const lastName = getField(['lastName', 'last_name', 'Last Name', 'lastname', 'lname']);
              const email = getField(['email', 'Email', 'EMAIL', 'e-mail']);
              const company = getField(['company', 'Company', 'COMPANY', 'organization', 'org']);
              const website = getField(['website', 'Website', 'WEBSITE', 'url', 'web']);

              // Only add if email is valid
              if (email && email.includes('@') && email.includes('.')) {
                newLeads.push({
                  id: Math.random().toString(36).substr(2, 9),
                  firstName: firstName || '',
                  lastName: lastName || '',
                  email: email,
                  company: company || '',
                  website: website || undefined,
                  customFields: data,
                  verificationStatus: 'UNVERIFIED' as const,
                  status: 'PENDING' as const
                });
              }
            } catch (rowError) {
              console.warn(`Error parsing row ${i + 2}:`, rowError);
              // Continue with other rows
            }
          }

          if (newLeads.length === 0) {
            throw new Error('No valid leads found in CSV. Make sure the file has an "email" column with valid email addresses.');
          }

          // Update leads - with timeout to prevent hanging
          const updatedLeads = [...currentCampaign.leads, ...newLeads];
          
          try {
            // Add timeout to prevent hanging
            const updatePromise = onUpdateLeads(currentCampaign.id, updatedLeads);
            const timeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Import timeout - operation took too long')), 30000)
            );
            
            await Promise.race([updatePromise, timeoutPromise]);
            
            setImportMessage({ 
              type: 'success', 
              text: `Successfully imported ${newLeads.length} lead${newLeads.length !== 1 ? 's' : ''}` 
            });
            setTimeout(() => setImportMessage(null), 5000);
          } catch (updateError: any) {
            console.error('Error updating leads:', updateError);
            // Leads were parsed successfully, but saving failed
            // Still show success since leads are in the UI, but warn about save
            if (updateError.message?.includes('timeout')) {
              setImportMessage({ 
                type: 'error', 
                text: `Imported ${newLeads.length} leads but save is taking too long. Leads are visible but may not be saved yet.` 
              });
            } else {
              setImportMessage({ 
                type: 'error', 
                text: `Parsed ${newLeads.length} leads but failed to save to database: ${updateError.message || 'Unknown error'}` 
              });
            }
            setTimeout(() => setImportMessage(null), 5000);
          }

        } catch (error: any) {
          console.error('CSV import error:', error);
          setImportMessage({ 
            type: 'error', 
            text: error.message || 'Failed to import CSV. Please check the file format.' 
          });
          setTimeout(() => setImportMessage(null), 5000);
        } finally {
          isCompleted = true;
          clearSafetyTimeout();
          setIsImporting(false);
        }
      };

      reader.onerror = () => {
        isCompleted = true;
        clearSafetyTimeout();
        setImportMessage({ type: 'error', text: 'Failed to read file' });
        setIsImporting(false);
        setTimeout(() => setImportMessage(null), 5000);
      };

      reader.readAsText(file);
  };

  if (campaigns.length === 0) {
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">Lead Database</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium">Verified lists with custom fields for n8n automation.</p>
        </div>
        <div className="bg-white dark:bg-slate-800 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-3xl p-20 flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-slate-50 dark:bg-slate-700 rounded-full flex items-center justify-center mb-4">
            <TableIcon className="text-slate-300 dark:text-slate-600" size={32} />
          </div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">No Campaigns Available</h3>
          <p className="text-slate-500 dark:text-slate-400 max-w-xs mt-2">Create a campaign first to manage leads.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Import Success/Error Message */}
      {importMessage && (
        <div className={`rounded-xl p-4 flex items-start gap-3 shadow-lg animate-in slide-in-from-top-2 ${
          importMessage.type === 'success' 
            ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' 
            : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
        }`}>
          {importMessage.type === 'success' ? (
            <CheckCircle className="text-green-600 dark:text-green-400 shrink-0 mt-0.5" size={20} />
          ) : (
            <AlertCircle className="text-red-600 dark:text-red-400 shrink-0 mt-0.5" size={20} />
          )}
          <p className={`text-sm font-medium flex-1 ${
            importMessage.type === 'success' 
              ? 'text-green-800 dark:text-green-300' 
              : 'text-red-800 dark:text-red-300'
          }`}>
            {importMessage.text}
          </p>
          <button
            onClick={() => setImportMessage(null)}
            className={`shrink-0 ${
              importMessage.type === 'success' 
                ? 'text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300' 
                : 'text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300'
            }`}
          >
            <X size={18} />
          </button>
        </div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight">Lead Database</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium">Verified lists with custom fields for n8n automation.</p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <select className="px-4 py-2 border border-slate-200 dark:border-slate-600 rounded-xl text-sm font-bold outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm" value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
            {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button onClick={verifyLeads} disabled={isVerifying || !currentCampaign} className="px-4 py-2 bg-slate-800 dark:bg-slate-700 text-white font-bold rounded-xl text-sm flex items-center gap-2 hover:bg-slate-900 dark:hover:bg-slate-600 shadow-md transition-all disabled:opacity-50">
            {isVerifying ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
            Verify List
          </button>
          <label className={`bg-blue-600 dark:bg-blue-500 text-white px-4 py-2 rounded-xl font-black text-sm flex items-center gap-2 cursor-pointer hover:bg-blue-700 dark:hover:bg-blue-600 shadow-md transition-all ${!currentCampaign || isImporting ? 'opacity-50 cursor-not-allowed' : ''}`}>
            {isImporting ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
            {isImporting ? 'Importing...' : 'Import CSV'}
            <input 
              type="file" 
              accept=".csv" 
              className="hidden" 
              onChange={handleCsvUpload} 
              disabled={!currentCampaign || isImporting} 
            />
          </label>
        </div>
      </div>

      {!currentCampaign ? (
        <div className="bg-white dark:bg-slate-800 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-3xl p-20 flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-slate-50 dark:bg-slate-700 rounded-full flex items-center justify-center mb-4">
            <TableIcon className="text-slate-300 dark:text-slate-600" size={32} />
          </div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">No Campaign Selected</h3>
          <p className="text-slate-500 dark:text-slate-400 max-w-xs mt-2">Please select a campaign from the dropdown above to manage leads.</p>
        </div>
      ) : (
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50/30 dark:bg-slate-700/30 flex gap-4">
           <div className="relative flex-1">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={18} />
             <input type="text" placeholder="Search by name, email, company or custom attributes..." className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:ring-2 focus:ring-blue-500 transition-all" value={search} onChange={(e) => setSearch(e.target.value)} />
           </div>
        </div>

        <table className="w-full text-left">
          <thead className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
            <tr>
              <th className="px-6 py-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Prospect</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Verification</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Company & Fields</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {filteredLeads.length === 0 ? (
                <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-400 dark:text-slate-500 italic">No leads match your search.</td>
                </tr>
            ) : filteredLeads.map((l) => (
                <tr key={l.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-700/30 group transition-colors">
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-900 dark:text-slate-100">{l.firstName} {l.lastName}</div>
                    <div className="text-xs text-slate-400 dark:text-slate-500 font-medium">{l.email}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                        l.verificationStatus === 'VERIFIED' ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800' : 
                        l.verificationStatus === 'INVALID' ? 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-800' : 
                        'bg-slate-50 dark:bg-slate-700 text-slate-400 dark:text-slate-500 border border-slate-100 dark:border-slate-600'
                    }`}>
                        {l.verificationStatus}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-bold text-slate-700 dark:text-slate-300">{l.company}</div>
                    {l.customFields && Object.keys(l.customFields).length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                            {Object.entries(l.customFields).slice(0, 3).map(([k, v]) => (
                                <span key={k} className="text-[9px] bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-slate-500 dark:text-slate-400 font-bold border border-slate-200 dark:border-slate-600">
                                    {k}: {v}
                                </span>
                            ))}
                            {Object.keys(l.customFields).length > 3 && <span className="text-[9px] text-slate-400 dark:text-slate-500">+{Object.keys(l.customFields).length - 3} more</span>}
                        </div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => onUpdateLeads(currentCampaign!.id, currentCampaign!.leads.filter(lead => lead.id !== l.id))} className="p-2 text-slate-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>
      )}
    </div>
  );
};

export default LeadManager;
