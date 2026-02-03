
import React, { useState, useEffect } from 'react';
import { Users, Mail, Play, Settings, BarChart3, Plus, LogOut, Inbox as InboxIcon, Sun, Moon } from 'lucide-react';
import Dashboard from './components/Dashboard';
import CampaignList from './components/CampaignList';
import CampaignEditor from './components/CampaignEditor';
import LeadManager from './components/LeadManager';
import SettingsView from './components/SettingsView';
import Inbox from './components/Inbox';
import Login from './components/Login';
import ResetPassword from './components/ResetPassword';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { ToastProvider, useToastContext } from './contexts/ToastContext';
import { Campaign, CampaignStatus, SmtpAccount, EmailMessage, User } from './types';
import { authService, campaignService, smtpService, emailService, supabase } from './lib/supabase';

const AppContent: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const toast = useToastContext();
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'campaigns' | 'leads' | 'inbox' | 'settings'>('dashboard');
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [smtpAccounts, setSmtpAccounts] = useState<SmtpAccount[]>([]);
  const [receivedEmails, setReceivedEmails] = useState<EmailMessage[]>([]);

  // Check authentication on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Try Supabase authentication first
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        if (supabaseUrl) {
          // Handle email confirmation and password reset callbacks
          const hashParams = new URLSearchParams(window.location.hash.substring(1));
          const accessToken = hashParams.get('access_token');
          const type = hashParams.get('type');
          
          if (accessToken) {
            if (type === 'signup') {
              // User confirmed their email via the link
              // Set the session first
              if (supabase) {
                const hashParams = new URLSearchParams(window.location.hash.substring(1));
                const refreshToken = hashParams.get('refresh_token');
                
                if (refreshToken) {
                  await supabase.auth.setSession({
                    access_token: accessToken,
                    refresh_token: refreshToken,
                  });
                }
              }
              
              // Clear the hash and reload to get authenticated state
              window.location.hash = '';
              // Small delay to ensure session is set and profile can be created
              setTimeout(() => {
                window.location.reload();
              }, 500);
              return;
            } else if (type === 'recovery') {
              // Password reset link clicked
              // The ResetPassword component will handle this
              // Just ensure we're not authenticated yet
              return;
            }
          }

          // Supabase is configured
          const currentUser = await authService.getCurrentUser();
          if (currentUser) {
            setUser(currentUser);
            setIsAuthenticated(true);
          }
          setIsLoading(false);
          
          // Listen for auth state changes
          const { data: { subscription } } = authService.onAuthStateChange((user) => {
            if (user) {
              setUser(user);
              setIsAuthenticated(true);
            } else {
              setUser(null);
              setIsAuthenticated(false);
              setCampaigns([]);
              setSmtpAccounts([]);
              setReceivedEmails([]);
            }
          });
          
          return () => {
            subscription.unsubscribe();
          };
        } else {
          // Fallback to localStorage for development
          const savedUser = localStorage.getItem('outboundflow_user');
          const savedSession = localStorage.getItem('outboundflow_session');
          
          if (savedUser && savedSession) {
            try {
              const userData = JSON.parse(savedUser);
              const sessionData = JSON.parse(savedSession);
              
              // Check if session is still valid (24 hours)
              const sessionExpiry = new Date(sessionData.expiresAt);
              if (sessionExpiry > new Date()) {
                setUser(userData);
                setIsAuthenticated(true);
              } else {
                // Session expired
                localStorage.removeItem('outboundflow_user');
                localStorage.removeItem('outboundflow_session');
              }
            } catch (error) {
              console.error('Error parsing user data:', error);
              localStorage.removeItem('outboundflow_user');
              localStorage.removeItem('outboundflow_session');
            }
          }
          setIsLoading(false);
        }
      } catch (error) {
        console.error('Error checking authentication:', error);
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  // Load user data only after authentication
  useEffect(() => {
    if (isAuthenticated && user) {
      const loadData = async () => {
        try {
          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
          if (supabaseUrl) {
            // Load from Supabase
            const [campaignsData, smtpData, emailsData] = await Promise.all([
              campaignService.getAll(user.id),
              smtpService.getAll(user.id),
              emailService.getAll(user.id),
            ]);
            
            setCampaigns(campaignsData);
            setSmtpAccounts(smtpData);
            setReceivedEmails(emailsData);
          } else {
            // Fallback to localStorage
            const savedCampaigns = localStorage.getItem(`outboundflow_campaigns_${user.id}`);
            const savedSmtp = localStorage.getItem(`outboundflow_smtp_${user.id}`);
            const savedInbox = localStorage.getItem(`outboundflow_inbox_${user.id}`);

            if (savedCampaigns) setCampaigns(JSON.parse(savedCampaigns));
            if (savedSmtp) setSmtpAccounts(JSON.parse(savedSmtp));
            if (savedInbox) setReceivedEmails(JSON.parse(savedInbox));
          }
        } catch (error) {
          console.error('Error loading user data:', error);
        }
      };

      loadData();
    }
  }, [isAuthenticated, user]);

  // Authentication functions
  const handleLogin = async (email: string, password: string): Promise<boolean> => {
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      
      if (supabaseUrl) {
        // Use Supabase authentication
        const { user: authenticatedUser, error } = await authService.signIn(email, password);
        
        if (error) {
          console.error('Login error:', error);
          return false;
        }
        
        if (authenticatedUser) {
          setUser(authenticatedUser);
          setIsAuthenticated(true);
          return true;
        }
        
        return false;
      } else {
        // No Supabase configured - show error
        console.error('Supabase is not configured. Please set up your .env.local file.');
        return false;
      }
    } catch (error) {
      console.error('Login error:', error);
      return false;
    }
  };

  const handleSignUp = async (email: string, password: string, name: string): Promise<boolean> => {
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      
      if (supabaseUrl) {
        const { user: newUser, error } = await authService.signUp(email, password, name);
        
        if (error) {
          console.error('Sign up error:', error);
          return false;
        }
        
        // Note: User needs to verify email before they can sign in
        // For now, we'll return true to show success message
        return true;
      } else {
        console.error('Supabase is not configured. Please set up your .env.local file.');
        return false;
      }
    } catch (error) {
      console.error('Sign up error:', error);
      return false;
    }
  };

  const handleLogout = async () => {
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      
      if (supabaseUrl) {
        // Sign out from Supabase
        await authService.signOut();
      } else {
        // Clear localStorage
        localStorage.removeItem('outboundflow_user');
        localStorage.removeItem('outboundflow_session');
        
        if (user) {
          localStorage.removeItem(`outboundflow_campaigns_${user.id}`);
          localStorage.removeItem(`outboundflow_smtp_${user.id}`);
          localStorage.removeItem(`outboundflow_inbox_${user.id}`);
        }
      }
    } catch (error) {
      console.error('Logout error:', error);
    }
    
    setUser(null);
    setIsAuthenticated(false);
    setCampaigns([]);
    setSmtpAccounts([]);
    setReceivedEmails([]);
    setActiveTab('dashboard');
    setSelectedCampaignId(null);
  };

  const saveCampaigns = async (updated: Campaign[]) => {
    setCampaigns(updated);
    
    if (!user) return;
    
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      
      if (supabaseUrl) {
        // Save to Supabase - sync each campaign
        for (const campaign of updated) {
          const existing = campaigns.find(c => c.id === campaign.id);
          if (existing) {
            await campaignService.update(campaign);
          } else {
            await campaignService.create(user.id, campaign);
          }
        }
        
        // Delete campaigns that were removed
        const existingIds = updated.map(c => c.id);
        const toDelete = campaigns.filter(c => !existingIds.includes(c.id));
        for (const campaign of toDelete) {
          await campaignService.delete(campaign.id);
        }
      } else {
        // Fallback to localStorage
        localStorage.setItem(`outboundflow_campaigns_${user.id}`, JSON.stringify(updated));
      }
    } catch (error) {
      console.error('Error saving campaigns:', error);
    }
  };

  const saveSmtp = async (updated: SmtpAccount[]) => {
    if (!user) {
      console.error('Cannot save SMTP accounts: No user logged in');
      throw new Error('No user logged in');
    }
    
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    console.log('[saveSmtp] Starting save...', { 
      accountCount: updated.length, 
      hasSupabase: !!supabaseUrl,
      userId: user.id 
    });
    
    try {
      if (supabaseUrl) {
        // Save to Supabase
        const savedAccounts: SmtpAccount[] = [];
        const errors: string[] = [];
        
        for (const account of updated) {
          const existing = smtpAccounts.find(a => a.id === account.id);
          try {
            if (existing) {
              // Update existing account
              console.log(`[saveSmtp] Updating account: ${account.id}`);
              const updatedAccount = await smtpService.update(account);
              if (updatedAccount) {
                savedAccounts.push(updatedAccount);
                console.log(`[saveSmtp] Successfully updated account: ${account.id}`);
              } else {
                const errorMsg = `Failed to update SMTP account: ${account.label}`;
                console.error(`[saveSmtp] ${errorMsg}`);
                errors.push(errorMsg);
                // Keep the account in the list even if update failed
                savedAccounts.push(account);
              }
            } else {
              // Create new account - exclude id as it will be generated by database
              console.log(`[saveSmtp] Creating new account: ${account.label}`);
              const { id, ...accountWithoutId } = account;
              const createdAccount = await smtpService.create(user.id, accountWithoutId);
              if (createdAccount) {
                savedAccounts.push(createdAccount);
                console.log(`[saveSmtp] Successfully created account: ${createdAccount.id}`);
              } else {
                // This shouldn't happen now since create() throws, but keep as safety check
                const errorMsg = `Failed to create SMTP account: ${account.label}`;
                console.error(`[saveSmtp] ${errorMsg}`);
                throw new Error(errorMsg);
              }
            }
          } catch (accountError: any) {
            console.error(`[saveSmtp] Error processing account ${account.label}:`, accountError);
            errors.push(accountError.message || `Error saving ${account.label}`);
            // Re-throw to stop processing
            throw accountError;
          }
        }
        
        // Delete accounts that were removed
        const updatedIds = updated.map(a => a.id);
        const toDelete = smtpAccounts.filter(a => !updatedIds.includes(a.id));
        for (const account of toDelete) {
          try {
            console.log(`[saveSmtp] Deleting account: ${account.id}`);
            const deleted = await smtpService.delete(account.id);
            if (!deleted) {
              console.error(`[saveSmtp] Failed to delete SMTP account: ${account.id}`);
            }
          } catch (deleteError) {
            console.error(`[saveSmtp] Error deleting account ${account.id}:`, deleteError);
          }
        }
        
        // Reload from database to ensure we have the latest data with correct IDs
        try {
          console.log('[saveSmtp] Reloading accounts from database...');
          const reloadedAccounts = await smtpService.getAll(user.id);
          console.log('[saveSmtp] Reloaded accounts:', reloadedAccounts.length);
          setSmtpAccounts(reloadedAccounts);
        } catch (reloadError: any) {
          console.error('[saveSmtp] Error reloading SMTP accounts:', reloadError);
          // Fallback to saved accounts if reload fails
          setSmtpAccounts(savedAccounts);
          throw new Error(`Failed to reload accounts: ${reloadError.message}`);
        }
        
        if (errors.length > 0) {
          console.warn('[saveSmtp] Some errors occurred:', errors);
        }
      } else {
        // Fallback to localStorage
        console.log('[saveSmtp] Using localStorage fallback (Supabase not configured)');
        localStorage.setItem(`outboundflow_smtp_${user.id}`, JSON.stringify(updated));
        setSmtpAccounts(updated);
      }
    } catch (error: any) {
      console.error('[saveSmtp] Error saving SMTP accounts:', error);
      const errorMessage = error.message || 'Unknown error occurred';
      alert(`Error saving SMTP accounts: ${errorMessage}\n\nCheck browser console for details.`);
      throw error; // Re-throw so the UI can handle it
    }
  };

  const currentView = () => {
    if (selectedCampaignId) {
      const campaign = campaigns.find(c => c.id === selectedCampaignId);
      if (!campaign) return         <CampaignList campaigns={campaigns} onSelect={setSelectedCampaignId} onAdd={async () => {
        const newCampaign: Campaign = {
          id: Math.random().toString(36).substr(2, 9),
          name: 'New Campaign',
          status: CampaignStatus.DRAFT,
          leads: [],
          steps: [{ id: 's' + Date.now(), order: 1, delayDays: 0, webhookUrl: '' }],
          schedule: { days: [1, 2, 3, 4, 5], startTime: "09:00", endTime: "17:00", timezone: "UTC", enabled: false, type: 'DAILY' },
          createdAt: new Date().toISOString()
        };
        
        if (user) {
          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
          if (supabaseUrl) {
            const created = await campaignService.create(user.id, newCampaign);
            if (created) {
              setCampaigns([...campaigns, created]);
              setSelectedCampaignId(created.id);
            }
          } else {
            await saveCampaigns([...campaigns, newCampaign]);
            setSelectedCampaignId(newCampaign.id);
          }
        }
      }}           onDelete={async (id) => {
        try {
          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
          if (supabaseUrl && user) {
            await campaignService.delete(id);
            setCampaigns(campaigns.filter(c => c.id !== id));
          } else {
            await saveCampaigns(campaigns.filter(c => c.id !== id));
          }
        } catch (error) {
          toast.error('Failed to delete campaign. Please try again.');
        }
      }} />;
      return (
        <CampaignEditor 
          campaign={campaign} 
          smtpAccounts={smtpAccounts}
          onSave={async (c) => {
            try {
              console.log('[onSave] Saving campaign:', { id: c.id, name: c.name });
              
              if (user) {
                const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
                if (supabaseUrl) {
                  // Update campaign in Supabase with timeout
                  console.log('[onSave] Updating campaign in Supabase...');
                  
                  // Add timeout wrapper - increase timeout for campaigns with many leads
                  // For campaigns with 0 leads, use shorter timeout (20 seconds)
                  // For campaigns with leads: 100ms per lead + 10 seconds base time
                  const estimatedTime = c.leads.length === 0 
                    ? 20000  // 20 seconds for campaigns with no leads
                    : Math.max(60000, (c.leads.length * 100) + 10000); // Minimum 60 seconds for campaigns with leads
                  console.log(`[onSave] Estimated save time: ${estimatedTime}ms for ${c.leads.length} leads`);
                  
                  const updatePromise = campaignService.update(c);
                  const timeoutPromise = new Promise<null>((_, reject) => 
                    setTimeout(() => reject(new Error(`Save operation timed out after ${Math.floor(estimatedTime/1000)} seconds. Large campaigns may take longer.`)), estimatedTime)
                  );
                  
                  const updated = await Promise.race([updatePromise, timeoutPromise]);
                  
                  if (updated) {
                    console.log('[onSave] Campaign updated successfully:', updated.id);
                    console.log('[onSave] Updated campaign leads:', updated.leads.map(l => ({ email: l.email, status: l.status })));
                    // Campaign was saved successfully, use the updated version
                    const index = campaigns.findIndex(existing => existing.id === c.id);
                    const newCampaigns = [...campaigns];
                    
                    if (index >= 0) {
                      newCampaigns[index] = updated;
                      console.log('[onSave] Updated campaign in state at index:', index);
                    } else {
                      // Campaign was created (new UUID), add it
                      newCampaigns.push(updated);
                      console.log('[onSave] Added new campaign to state');
                    }
                    setCampaigns(newCampaigns);
                    console.log('[onSave] Campaigns state updated, total campaigns:', newCampaigns.length);
                    // Update selected campaign ID if it changed (UUID was generated)
                    if (updated.id !== c.id) {
                      console.log('[onSave] Campaign ID changed, updating selected:', updated.id);
                      setSelectedCampaignId(updated.id);
                    }
                    toast.success('Campaign saved successfully');
                  } else {
                    // Even if database save failed, update local state so Dashboard shows correct data
                    console.warn('[onSave] Database save returned null, updating local state anyway');
                    const index = campaigns.findIndex(existing => existing.id === c.id);
                    const newCampaigns = [...campaigns];
                    if (index >= 0) {
                      newCampaigns[index] = c; // Use the campaign passed in (with updated leads)
                    } else {
                      newCampaigns.push(c);
                    }
                    setCampaigns(newCampaigns);
                    throw new Error('Campaign update returned null - check console for details');
                  }
                } else {
                  // Fallback to localStorage
                  console.log('[onSave] Using localStorage fallback');
                  const index = campaigns.findIndex(existing => existing.id === c.id);
                  const newCampaigns = [...campaigns];
                  if (index >= 0) {
                    newCampaigns[index] = c;
                  } else {
                    newCampaigns.push(c);
                  }
                  await saveCampaigns(newCampaigns);
                }
              } else {
                // No user - just update local state
                console.log('[onSave] No user, updating local state only');
                const index = campaigns.findIndex(existing => existing.id === c.id);
                const newCampaigns = [...campaigns];
                if (index >= 0) {
                  newCampaigns[index] = c;
                } else {
                  newCampaigns.push(c);
                }
                setCampaigns(newCampaigns);
              }
            } catch (error: any) {
              console.error('[onSave] Error saving campaign:', error);
              // Even if database save fails, update local state so Dashboard shows correct data
              // This is critical for showing updated lead statuses after execution
              console.log('[onSave] Updating local state as fallback despite save error...');
              const index = campaigns.findIndex(existing => existing.id === c.id);
              const newCampaigns = [...campaigns];
              if (index >= 0) {
                newCampaigns[index] = c; // Use the campaign passed in (with updated leads)
                console.log('[onSave] Updated campaign in state (fallback) at index:', index);
              } else {
                newCampaigns.push(c);
                console.log('[onSave] Added campaign to state (fallback)');
              }
              setCampaigns(newCampaigns);
              console.log('[onSave] Campaigns state updated (fallback), total campaigns:', newCampaigns.length);
              throw error; // Re-throw so CampaignEditor can show error toast
            }
          }}
          onBack={() => setSelectedCampaignId(null)}
        />
      );
    }

    switch (activeTab) {
      case 'dashboard': return <Dashboard campaigns={campaigns} />;
      case 'campaigns': return (
        <CampaignList 
          campaigns={campaigns} 
          onSelect={setSelectedCampaignId}
          onClone={async (clonedCampaign) => {
            try {
              if (user) {
                const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
                if (supabaseUrl) {
                  const created = await campaignService.create(user.id, clonedCampaign);
                  if (created) {
                    setCampaigns([...campaigns, created]);
                    setSelectedCampaignId(created.id);
                    toast.success('Campaign cloned successfully');
                  }
                } else {
                  await saveCampaigns([...campaigns, clonedCampaign]);
                  setSelectedCampaignId(clonedCampaign.id);
                  toast.success('Campaign cloned successfully');
                }
              } else {
                setCampaigns([...campaigns, clonedCampaign]);
                setSelectedCampaignId(clonedCampaign.id);
                toast.success('Campaign cloned successfully');
              }
            } catch (error) {
              toast.error('Failed to clone campaign. Please try again.');
            }
          }}
          onAdd={async () => {
            try {
              const newCampaign: Omit<Campaign, 'id' | 'createdAt'> = {
                name: 'New Campaign',
                status: CampaignStatus.DRAFT,
                leads: [],
                steps: [{ id: 's' + Date.now(), order: 1, delayDays: 0, webhookUrl: '' }],
                schedule: { days: [1, 2, 3, 4, 5], startTime: "09:00", endTime: "17:00", timezone: "UTC", enabled: false, type: 'DAILY' },
              };
            
              if (user) {
                const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
                if (supabaseUrl) {
                  // Create campaign in Supabase first to get proper UUID
                  const created = await campaignService.create(user.id, newCampaign);
                  if (created) {
                    setCampaigns([...campaigns, created]);
                    setSelectedCampaignId(created.id);
                    toast.success('Campaign created successfully');
                  } else {
                    toast.error('Failed to create campaign in database');
                  }
                } else {
                  // Fallback: use temporary ID for localStorage
                  const tempCampaign: Campaign = {
                    ...newCampaign,
                    id: Math.random().toString(36).substr(2, 9),
                    createdAt: new Date().toISOString()
                  };
                  await saveCampaigns([...campaigns, tempCampaign]);
                  setSelectedCampaignId(tempCampaign.id);
                  toast.success('Campaign created successfully');
                }
              } else {
                // No user: use temporary ID
                const tempCampaign: Campaign = {
                  ...newCampaign,
                  id: Math.random().toString(36).substr(2, 9),
                  createdAt: new Date().toISOString()
                };
                setCampaigns([...campaigns, tempCampaign]);
                setSelectedCampaignId(tempCampaign.id);
                toast.success('Campaign created successfully');
              }
            } catch (error: any) {
              console.error('Error creating campaign:', error);
              toast.error(`Failed to create campaign: ${error.message || 'Unknown error'}`);
            }
          }}
          onDelete={(id) => saveCampaigns(campaigns.filter(c => c.id !== id))}
        />
      );
      case 'leads': return <LeadManager campaigns={campaigns} userId={user?.id} onUpdateLeads={async (campaignId, leads) => {
        const updated = campaigns.map(c => c.id === campaignId ? { ...c, leads } : c);
        setCampaigns(updated);
        
        if (user) {
          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
          if (supabaseUrl) {
            try {
              console.log('[onUpdateLeads] Updating leads in database...', { campaignId, leadCount: leads.length });
              
              // Only update leads in database - don't do full campaign update
              // Full campaign update is expensive and causes timeouts
              const leadsUpdated = await campaignService.updateLeads(campaignId, leads);
              if (!leadsUpdated) {
                throw new Error('Failed to update leads in database');
              }
              
              console.log('[onUpdateLeads] Leads updated successfully');
              // Don't call campaignService.update() here - it's redundant and slow
              // The leads are already saved, and full campaign sync happens on explicit save
            } catch (error) {
              console.error('[onUpdateLeads] Error saving leads to database:', error);
              // Re-throw so LeadManager can show error message
              throw error;
            }
          } else {
            // Fallback to localStorage
            await saveCampaigns(updated);
          }
        }
      }} />;
      case 'inbox': return <Inbox 
          emails={receivedEmails} 
          userId={user?.id}
          smtpAccounts={smtpAccounts}
          onUpdateEmails={async (updated) => {
          // If Supabase is configured, reload emails from database
          // Otherwise, update local state
          if (user) {
            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
            if (supabaseUrl) {
              // Reload emails from database to get latest synced emails
              try {
                const refreshedEmails = await emailService.getAll(user.id);
                setReceivedEmails(refreshedEmails);
              } catch (error) {
                console.error('Error reloading emails:', error);
                // Fallback to updated emails if reload fails
                setReceivedEmails(updated);
              }
            } else {
              // Update local state and localStorage
              setReceivedEmails(updated);
              localStorage.setItem(`outboundflow_inbox_${user.id}`, JSON.stringify(updated));
            }
          } else {
            setReceivedEmails(updated);
          }
      }} />;
      case 'settings': return <SettingsView accounts={smtpAccounts} onUpdateAccounts={saveSmtp} />;
      default: return <Dashboard campaigns={campaigns} />;
    }
  };

  // Show loading screen while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-blue-600 dark:bg-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-4 animate-pulse">
            <Mail className="text-white" size={32} />
          </div>
          <p className="text-slate-500 dark:text-slate-400 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  // Check if we're on password reset page (check URL hash for recovery token)
  const hashParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.hash.substring(1)) : new URLSearchParams();
  const accessToken = hashParams.get('access_token');
  const type = hashParams.get('type');
  const isPasswordReset = accessToken && type === 'recovery';

  // Show password reset page if reset token is present
  if (!isAuthenticated && isPasswordReset) {
    return <ResetPassword />;
  }

  // Show login page if not authenticated
  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} onSignUp={handleSignUp} />;
  }

  // Main application
  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-900 font-sans">
      <aside className="w-64 bg-gradient-to-b from-white to-slate-50 dark:from-slate-800 dark:to-slate-900 border-r border-slate-200 dark:border-slate-700 flex flex-col shadow-lg">
        <div className="p-6 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-700 dark:to-blue-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center text-white shadow-lg">
              <Mail size={22} />
            </div>
            <div>
              <span className="font-black text-xl tracking-tight text-white block">OutboundFlow</span>
              <span className="text-xs text-blue-100 font-medium">Email Outreach Platform</span>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          <NavItem icon={<BarChart3 size={20} />} label="Dashboard" active={activeTab === 'dashboard' && !selectedCampaignId} onClick={() => { setActiveTab('dashboard'); setSelectedCampaignId(null); }} />
          <NavItem icon={<Play size={20} />} label="Campaigns" active={activeTab === 'campaigns' || !!selectedCampaignId} onClick={() => { setActiveTab('campaigns'); setSelectedCampaignId(null); }} />
          <NavItem icon={<Users size={20} />} label="Leads" active={activeTab === 'leads'} onClick={() => { setActiveTab('leads'); setSelectedCampaignId(null); }} />
          <NavItem icon={<InboxIcon size={20} />} label="Inbox" active={activeTab === 'inbox'} onClick={() => { setActiveTab('inbox'); setSelectedCampaignId(null); }} />
          <NavItem icon={<Settings size={20} />} label="Settings" active={activeTab === 'settings'} onClick={() => { setActiveTab('settings'); setSelectedCampaignId(null); }} />
        </nav>
        <div className="p-4 border-t border-slate-100 dark:border-slate-700 space-y-3">
          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="w-full flex items-center gap-3 px-3 py-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
            title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
          >
            {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
            <span className="text-sm font-medium">{theme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>
          </button>
          {/* User Info */}
          <div className="px-4 py-3 bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-700 dark:to-slate-800 rounded-xl border border-slate-200 dark:border-slate-600">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-black text-xs shadow-md">
                {user?.email?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">Account</div>
                <div className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{user?.email}</div>
              </div>
            </div>
          </div>
          {/* Logout Button */}
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 text-slate-500 dark:text-slate-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 dark:hover:text-red-400 rounded-lg transition-colors"
          >
            <LogOut size={20} /><span className="text-sm font-medium">Log Out</span>
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900">
        <div className="max-w-6xl mx-auto p-8">{currentView()}</div>
      </main>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </ThemeProvider>
  );
};

const NavItem: React.FC<{ icon: React.ReactNode; label: string; active?: boolean; onClick: () => void; }> = ({ icon, label, active, onClick }) => (
  <button 
    onClick={onClick} 
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-bold ${
      active 
        ? 'bg-gradient-to-r from-blue-600 to-blue-700 dark:from-blue-600 dark:to-blue-700 text-white shadow-lg transform scale-[1.02]' 
        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50 hover:text-slate-900 dark:hover:text-slate-100'
    }`}
  >
    <span className={active ? 'text-white' : ''}>{icon}</span>
    <span className="text-sm">{label}</span>
    {active && <div className="ml-auto w-2 h-2 bg-white rounded-full"></div>}
  </button>
);

export default App;
