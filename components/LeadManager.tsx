
import React, { useState, useEffect } from 'react';
import { Campaign, Lead, LeadFolder } from '../types';
import { UserPlus, Upload, Trash2, Search, Filter, ShieldCheck, Loader2, Table as TableIcon, CheckCircle, AlertCircle, X, Folder, FolderPlus, Edit2, FolderOpen, Download, Copy, CheckSquare, Square, MoreVertical } from 'lucide-react';
import { folderService, supabase } from '../lib/supabase';
import { useToastContext } from '../contexts/ToastContext';
import Modal from './Modal';
import { exportLeadsToCSV } from '../utils/export';

interface LeadManagerProps {
  campaigns: Campaign[];
  onUpdateLeads: (campaignId: string, leads: Lead[]) => void;
  userId?: string;
}

const LeadManager: React.FC<LeadManagerProps> = ({ campaigns, onUpdateLeads, userId }) => {
  const toast = useToastContext();
  const [selectedId, setSelectedId] = useState<string>(campaigns[0]?.id || '');
  const [search, setSearch] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [folders, setFolders] = useState<LeadFolder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [deleteFolderModal, setDeleteFolderModal] = useState<{isOpen: boolean; folderId: string | null; folderName: string}>({isOpen: false, folderId: null, folderName: ''});
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [showBulkActions, setShowBulkActions] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterVerification, setFilterVerification] = useState<string>('all');

  // Load folders on mount
  useEffect(() => {
    if (userId) {
      const loadFolders = async () => {
        try {
          const loadedFolders = await folderService.getAll(userId);
          setFolders(loadedFolders);
        } catch (error) {
          console.error('Error loading folders:', error);
        }
      };
      loadFolders();
    }
  }, [userId]);

  const currentCampaign = campaigns.find(c => c.id === selectedId);
  
  // Filter leads by folder, search, status, and verification
  const filteredLeads = currentCampaign?.leads.filter(l => {
    // Filter by folder
    if (selectedFolderId === null) {
      // Show all leads (no folder filter)
    } else if (selectedFolderId === 'none') {
      // Show only leads without folder
      if (l.folderId) return false;
    } else {
      // Show only leads in selected folder
      if (l.folderId !== selectedFolderId) return false;
    }
    
    // Filter by status
    if (filterStatus !== 'all' && l.status !== filterStatus) return false;
    
    // Filter by verification status
    if (filterVerification !== 'all' && l.verificationStatus !== filterVerification) return false;
    
    // Filter by search
    return l.email.toLowerCase().includes(search.toLowerCase()) || 
           l.firstName.toLowerCase().includes(search.toLowerCase()) ||
           l.lastName.toLowerCase().includes(search.toLowerCase()) ||
           l.company.toLowerCase().includes(search.toLowerCase());
  }) || [];

  // Deduplicate leads by email
  const deduplicateLeads = () => {
    if (!currentCampaign) return;
    
    const seen = new Set<string>();
    const uniqueLeads: Lead[] = [];
    const duplicates: Lead[] = [];
    
    currentCampaign.leads.forEach(lead => {
      const emailLower = lead.email.toLowerCase();
      if (seen.has(emailLower)) {
        duplicates.push(lead);
      } else {
        seen.add(emailLower);
        uniqueLeads.push(lead);
      }
    });
    
    if (duplicates.length > 0) {
      onUpdateLeads(currentCampaign.id, uniqueLeads);
      toast.success(`Removed ${duplicates.length} duplicate lead(s)`);
    } else {
      toast.info('No duplicates found');
    }
  };

  // Bulk operations
  const handleBulkDelete = () => {
    if (!currentCampaign || selectedLeads.size === 0) return;
    const updatedLeads = currentCampaign.leads.filter(l => !selectedLeads.has(l.id));
    onUpdateLeads(currentCampaign.id, updatedLeads);
    setSelectedLeads(new Set());
    setShowBulkActions(false);
    toast.success(`Deleted ${selectedLeads.size} lead(s)`);
  };

  const handleBulkStatusUpdate = (status: Lead['status']) => {
    if (!currentCampaign || selectedLeads.size === 0) return;
    const updatedLeads = currentCampaign.leads.map(l => 
      selectedLeads.has(l.id) ? { ...l, status } : l
    );
    onUpdateLeads(currentCampaign.id, updatedLeads);
    setSelectedLeads(new Set());
    setShowBulkActions(false);
    toast.success(`Updated ${selectedLeads.size} lead(s) status to ${status}`);
  };

  const handleBulkFolderAssign = (folderId: string | undefined) => {
    if (!currentCampaign || selectedLeads.size === 0) return;
    const updatedLeads = currentCampaign.leads.map(l => 
      selectedLeads.has(l.id) ? { ...l, folderId } : l
    );
    onUpdateLeads(currentCampaign.id, updatedLeads);
    setSelectedLeads(new Set());
    setShowBulkActions(false);
    toast.success(`Assigned ${selectedLeads.size} lead(s) to folder`);
  };

  const toggleLeadSelection = (leadId: string) => {
    const newSelected = new Set(selectedLeads);
    if (newSelected.has(leadId)) {
      newSelected.delete(leadId);
    } else {
      newSelected.add(leadId);
    }
    setSelectedLeads(newSelected);
    setShowBulkActions(newSelected.size > 0);
  };

  const selectAllLeads = () => {
    if (selectedLeads.size === filteredLeads.length) {
      setSelectedLeads(new Set());
      setShowBulkActions(false);
    } else {
      setSelectedLeads(new Set(filteredLeads.map(l => l.id)));
      setShowBulkActions(true);
    }
  };

  const exportLeads = () => {
    try {
      exportLeadsToCSV(filteredLeads);
      toast.success('Leads exported successfully');
    } catch (error: any) {
      toast.error(`Export failed: ${error.message}`);
    }
  };

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
                  status: 'PENDING' as const,
                  folderId: selectedFolderId && selectedFolderId !== 'none' ? selectedFolderId : undefined
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
            console.log(`[Lead Import] Starting import of ${newLeads.length} leads (total will be ${updatedLeads.length})`);
            
            // Calculate timeout based on lead count (more leads = more time needed)
            // Base time: 10 seconds + 50ms per lead
            const estimatedTime = Math.max(30000, (updatedLeads.length * 50) + 10000);
            console.log(`[Lead Import] Estimated save time: ${estimatedTime}ms for ${updatedLeads.length} leads`);
            
            // Add timeout to prevent hanging
            const updatePromise = onUpdateLeads(currentCampaign.id, updatedLeads);
            const timeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error(`Import timeout - operation took longer than ${Math.floor(estimatedTime/1000)} seconds. Large lead lists may take longer.`)), estimatedTime)
            );
            
            await Promise.race([updatePromise, timeoutPromise]);
            console.log('[Lead Import] Import completed successfully');
            
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

  const createFolder = async () => {
    if (!userId || !newFolderName.trim()) return;
    
    try {
      const folder = await folderService.create(userId, { name: newFolderName.trim() });
      if (folder) {
        setFolders([...folders, folder]);
        setNewFolderName('');
        setIsCreatingFolder(false);
        toast.success(`Folder "${folder.name}" created successfully`);
      }
    } catch (error: any) {
      toast.error(`Failed to create folder: ${error.message}`);
    }
  };

  const handleDeleteFolder = async () => {
    if (!deleteFolderModal.folderId) return;
    
    try {
      const success = await folderService.delete(deleteFolderModal.folderId);
      if (success) {
        setFolders(folders.filter(f => f.id !== deleteFolderModal.folderId));
        if (selectedFolderId === deleteFolderModal.folderId) setSelectedFolderId(null);
        // Update leads to remove folder assignment
        if (currentCampaign) {
          const updatedLeads = currentCampaign.leads.map(l => 
            l.folderId === deleteFolderModal.folderId ? { ...l, folderId: undefined } : l
          );
          onUpdateLeads(currentCampaign.id, updatedLeads);
        }
        toast.success(`Folder "${deleteFolderModal.folderName}" deleted successfully`);
        setDeleteFolderModal({ isOpen: false, folderId: null, folderName: '' });
      }
    } catch (error: any) {
      toast.error(`Failed to delete folder: ${error.message}`);
    }
  };

  const deleteFolder = (folderId: string) => {
    const folder = folders.find(f => f.id === folderId);
    if (folder) {
      setDeleteFolderModal({ isOpen: true, folderId, folderName: folder.name });
    }
  };

  const assignLeadToFolder = async (leadId: string, folderId: string | undefined) => {
    if (!currentCampaign) return;
    
    const updatedLeads = currentCampaign.leads.map(l => 
      l.id === leadId ? { ...l, folderId } : l
    );
    onUpdateLeads(currentCampaign.id, updatedLeads);
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
    <>
      <Modal
        isOpen={deleteFolderModal.isOpen}
        onClose={() => setDeleteFolderModal({ isOpen: false, folderId: null, folderName: '' })}
        onConfirm={handleDeleteFolder}
        title="Delete Folder"
        message={`Delete "${deleteFolderModal.folderName}"? Leads in this folder will not be deleted, but will no longer be assigned to a folder.`}
        type="confirm"
        confirmText="Delete"
      />
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
          <p className="text-slate-500 dark:text-slate-400 mt-1 font-medium">Organize leads into folders and manage multiple lead lists.</p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <select className="px-4 py-2 border border-slate-200 dark:border-slate-600 rounded-xl text-sm font-bold outline-none bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow-sm" value={selectedId} onChange={(e) => { setSelectedId(e.target.value); setSelectedLeads(new Set()); setShowBulkActions(false); }}>
            {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button onClick={verifyLeads} disabled={isVerifying || !currentCampaign} className="px-4 py-2 bg-slate-800 dark:bg-slate-700 text-white font-bold rounded-xl text-sm flex items-center gap-2 hover:bg-slate-900 dark:hover:bg-slate-600 shadow-md transition-all disabled:opacity-50">
            {isVerifying ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={18} />}
            Verify List
          </button>
          <button onClick={deduplicateLeads} disabled={!currentCampaign || currentCampaign.leads.length === 0} className="px-4 py-2 bg-purple-600 dark:bg-purple-500 text-white font-bold rounded-xl text-sm flex items-center gap-2 hover:bg-purple-700 dark:hover:bg-purple-600 shadow-md transition-all disabled:opacity-50" title="Remove duplicate leads">
            <Copy size={18} />
            Remove Duplicates
          </button>
          <button onClick={exportLeads} disabled={!currentCampaign || filteredLeads.length === 0} className="px-4 py-2 bg-emerald-600 dark:bg-emerald-500 text-white font-bold rounded-xl text-sm flex items-center gap-2 hover:bg-emerald-700 dark:hover:bg-emerald-600 shadow-md transition-all disabled:opacity-50" title="Export leads to CSV">
            <Download size={18} />
            Export CSV
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

      {/* Folder Management Section */}
      {currentCampaign && userId && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Folder className="text-blue-600 dark:text-blue-400" size={20} />
              Lead Folders
            </h2>
            {!isCreatingFolder && (
              <button 
                onClick={() => setIsCreatingFolder(true)}
                className="px-3 py-1.5 bg-blue-600 dark:bg-blue-500 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 hover:bg-blue-700 dark:hover:bg-blue-600 transition-all"
              >
                <FolderPlus size={14} />
                New Folder
              </button>
            )}
          </div>

          {isCreatingFolder && (
            <div className="mb-4 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl border border-slate-200 dark:border-slate-600 flex items-center gap-2">
              <input
                type="text"
                placeholder="Folder name..."
                className="flex-1 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && createFolder()}
                autoFocus
              />
              <button
                onClick={createFolder}
                disabled={!newFolderName.trim()}
                className="px-3 py-2 bg-emerald-600 dark:bg-emerald-500 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 dark:hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Create
              </button>
              <button
                onClick={() => { setIsCreatingFolder(false); setNewFolderName(''); }}
                className="px-3 py-2 bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-300 rounded-lg text-xs font-bold hover:bg-slate-300 dark:hover:bg-slate-500 transition-all"
              >
                Cancel
              </button>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedFolderId(null)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                selectedFolderId === null
                  ? 'bg-blue-600 dark:bg-blue-500 text-white'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
              }`}
            >
              <FolderOpen size={14} />
              All Leads ({currentCampaign.leads.length})
            </button>
            <button
              onClick={() => setSelectedFolderId('none')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                selectedFolderId === 'none'
                  ? 'bg-blue-600 dark:bg-blue-500 text-white'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
              }`}
            >
              Unassigned ({currentCampaign.leads.filter(l => !l.folderId).length})
            </button>
            {folders.map(folder => {
              const folderLeadsCount = currentCampaign.leads.filter(l => l.folderId === folder.id).length;
              return (
                <div key={folder.id} className="flex items-center gap-1">
                  <button
                    onClick={() => setSelectedFolderId(folder.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                      selectedFolderId === folder.id
                        ? 'bg-blue-600 dark:bg-blue-500 text-white'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                    }`}
                  >
                    <Folder size={14} />
                    {folder.name} ({folderLeadsCount})
                  </button>
                  <button
                    onClick={() => deleteFolder(folder.id)}
                    className="p-1 text-slate-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 transition-all"
                    title="Delete folder"
                  >
                    <X size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

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
        {/* Bulk Actions Bar */}
        {showBulkActions && selectedLeads.size > 0 && (
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-200 dark:border-blue-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm font-bold text-blue-900 dark:text-blue-100">{selectedLeads.size} selected</span>
              <div className="flex gap-2">
                <select 
                  onChange={(e) => e.target.value && handleBulkStatusUpdate(e.target.value as Lead['status'])}
                  className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-xs font-bold outline-none"
                  defaultValue=""
                >
                  <option value="">Update Status</option>
                  <option value="PENDING">Pending</option>
                  <option value="CONTACTED">Contacted</option>
                  <option value="REPLIED">Replied</option>
                  <option value="INTERESTED">Interested</option>
                  <option value="BOUNCED">Bounced</option>
                </select>
                {userId && folders.length > 0 && (
                  <select 
                    onChange={(e) => handleBulkFolderAssign(e.target.value || undefined)}
                    className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg text-xs font-bold outline-none"
                    defaultValue=""
                  >
                    <option value="">Assign Folder</option>
                    <option value="">No Folder</option>
                    {folders.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                )}
                <button 
                  onClick={handleBulkDelete}
                  className="px-3 py-1.5 bg-red-600 dark:bg-red-500 text-white rounded-lg text-xs font-bold hover:bg-red-700 dark:hover:bg-red-600"
                >
                  Delete Selected
                </button>
              </div>
            </div>
            <button onClick={() => { setSelectedLeads(new Set()); setShowBulkActions(false); }} className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300">
              <X size={18} />
            </button>
          </div>
        )}

        <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50/30 dark:bg-slate-700/30 flex gap-4 flex-wrap">
           <div className="relative flex-1 min-w-[200px]">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" size={18} />
             <input type="text" placeholder="Search by name, email, company..." className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 outline-none focus:ring-2 focus:ring-blue-500 transition-all" value={search} onChange={(e) => setSearch(e.target.value)} />
           </div>
           <select 
             value={filterStatus} 
             onChange={(e) => setFilterStatus(e.target.value)}
             className="px-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl text-sm font-bold text-slate-900 dark:text-slate-100 outline-none"
           >
             <option value="all">All Status</option>
             <option value="PENDING">Pending</option>
             <option value="CONTACTED">Contacted</option>
             <option value="REPLIED">Replied</option>
             <option value="INTERESTED">Interested</option>
             <option value="BOUNCED">Bounced</option>
           </select>
           <select 
             value={filterVerification} 
             onChange={(e) => setFilterVerification(e.target.value)}
             className="px-3 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl text-sm font-bold text-slate-900 dark:text-slate-100 outline-none"
           >
             <option value="all">All Verification</option>
             <option value="VERIFIED">Verified</option>
             <option value="UNVERIFIED">Unverified</option>
             <option value="INVALID">Invalid</option>
             <option value="CATCHALL">Catchall</option>
           </select>
        </div>

        <table className="w-full text-left">
          <thead className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
            <tr>
              <th className="px-6 py-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest w-12">
                <button onClick={selectAllLeads} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded">
                  {selectedLeads.size === filteredLeads.length && filteredLeads.length > 0 ? (
                    <CheckSquare size={18} className="text-blue-600 dark:text-blue-400" />
                  ) : (
                    <Square size={18} className="text-slate-400 dark:text-slate-500" />
                  )}
                </button>
              </th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Prospect</th>
              <th className="px-6 py-4 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">Status</th>
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
                <tr key={l.id} className={`hover:bg-slate-50/50 dark:hover:bg-slate-700/30 group transition-colors ${selectedLeads.has(l.id) ? 'bg-blue-50/50 dark:bg-blue-900/20' : ''}`}>
                  <td className="px-6 py-4">
                    <button onClick={() => toggleLeadSelection(l.id)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded">
                      {selectedLeads.has(l.id) ? (
                        <CheckSquare size={18} className="text-blue-600 dark:text-blue-400" />
                      ) : (
                        <Square size={18} className="text-slate-400 dark:text-slate-500" />
                      )}
                    </button>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-900 dark:text-slate-100">{l.firstName} {l.lastName}</div>
                    <div className="text-xs text-slate-400 dark:text-slate-500 font-medium">{l.email}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                        l.status === 'REPLIED' ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800' :
                        l.status === 'CONTACTED' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-800' :
                        l.status === 'BOUNCED' ? 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-800' :
                        l.status === 'INTERESTED' ? 'bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border border-purple-100 dark:border-purple-800' :
                        'bg-slate-50 dark:bg-slate-700 text-slate-400 dark:text-slate-500 border border-slate-100 dark:border-slate-600'
                    }`}>
                        {l.status}
                    </span>
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
                    {l.folderId && (
                      <div className="mt-2">
                        <span className="text-[9px] bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-full font-bold flex items-center gap-1 w-fit">
                          <Folder size={10} />
                          {folders.find(f => f.id === l.folderId)?.name || 'Unknown Folder'}
                        </span>
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      {userId && (
                        <select
                          value={l.folderId || ''}
                          onChange={(e) => assignLeadToFolder(l.id, e.target.value || undefined)}
                          className="text-xs px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 opacity-0 group-hover:opacity-100 transition-all focus:ring-2 focus:ring-blue-500 outline-none"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <option value="">No Folder</option>
                          {folders.map(f => (
                            <option key={f.id} value={f.id}>{f.name}</option>
                          ))}
                        </select>
                      )}
                      <button onClick={() => onUpdateLeads(currentCampaign!.id, currentCampaign!.leads.filter(lead => lead.id !== l.id))} className="p-2 text-slate-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            }
          </tbody>
        </table>
      </div>
      )}
    </div>
    </>
  );
};

export default LeadManager;
