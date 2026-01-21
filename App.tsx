
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
import { Campaign, CampaignStatus, SmtpAccount, EmailMessage, User } from './types';
import { authService, campaignService, smtpService, emailService, supabase } from './lib/supabase';

const AppContent: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
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
    setSmtpAccounts(updated);
    
    if (!user) return;
    
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      
      if (supabaseUrl) {
        // Save to Supabase
        for (const account of updated) {
          const existing = smtpAccounts.find(a => a.id === account.id);
          if (existing) {
            await smtpService.update(account);
          } else {
            await smtpService.create(user.id, account);
          }
        }
        
        // Delete accounts that were removed
        const existingIds = updated.map(a => a.id);
        const toDelete = smtpAccounts.filter(a => !existingIds.includes(a.id));
        for (const account of toDelete) {
          await smtpService.delete(account.id);
        }
      } else {
        // Fallback to localStorage
        localStorage.setItem(`outboundflow_smtp_${user.id}`, JSON.stringify(updated));
      }
    } catch (error) {
      console.error('Error saving SMTP accounts:', error);
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
          schedule: { days: [1, 2, 3, 4, 5], startTime: "09:00", endTime: "17:00", timezone: "UTC" },
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
      }} onDelete={async (id) => {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        if (supabaseUrl && user) {
          await campaignService.delete(id);
          setCampaigns(campaigns.filter(c => c.id !== id));
        } else {
          await saveCampaigns(campaigns.filter(c => c.id !== id));
        }
      }} />;
      return (
        <CampaignEditor 
          campaign={campaign} 
          smtpAccounts={smtpAccounts}
          onSave={async (c) => {
            const index = campaigns.findIndex(existing => existing.id === c.id);
            const newCampaigns = [...campaigns];
            newCampaigns[index] = c;
            setCampaigns(newCampaigns);
            
            if (user) {
              const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
              if (supabaseUrl) {
                const updated = await campaignService.update(c);
                if (updated) {
                  newCampaigns[index] = updated;
                  setCampaigns([...newCampaigns]);
                }
              } else {
                await saveCampaigns(newCampaigns);
              }
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
          onAdd={async () => {
            const newCampaign: Campaign = {
              id: Math.random().toString(36).substr(2, 9),
              name: 'New Campaign',
              status: CampaignStatus.DRAFT,
              leads: [],
              steps: [{ id: 's' + Date.now(), order: 1, delayDays: 0, webhookUrl: '' }],
              schedule: { days: [1, 2, 3, 4, 5], startTime: "09:00", endTime: "17:00", timezone: "UTC" },
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
          }}
          onDelete={(id) => saveCampaigns(campaigns.filter(c => c.id !== id))}
        />
      );
      case 'leads': return <LeadManager campaigns={campaigns} onUpdateLeads={async (campaignId, leads) => {
        const updated = campaigns.map(c => c.id === campaignId ? { ...c, leads } : c);
        setCampaigns(updated);
        
        if (user) {
          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
          if (supabaseUrl) {
            try {
              // Update leads in database
              const leadsUpdated = await campaignService.updateLeads(campaignId, leads);
              if (!leadsUpdated) {
                throw new Error('Failed to update leads in database');
              }
              
              // Also update the full campaign to sync everything
              const campaign = updated.find(c => c.id === campaignId);
              if (campaign) {
                await campaignService.update(campaign);
              }
            } catch (error) {
              console.error('Error saving leads to database:', error);
              // Re-throw so LeadManager can show error message
              throw error;
            }
          } else {
            // Fallback to localStorage
            await saveCampaigns(updated);
          }
        }
      }} />;
      case 'inbox': return <Inbox emails={receivedEmails} onUpdateEmails={async (updated) => {
          setReceivedEmails(updated);
          
          if (user) {
            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
            if (supabaseUrl) {
              // Sync each email update to Supabase
              for (const email of updated) {
                await emailService.update(email);
              }
            } else {
              localStorage.setItem(`outboundflow_inbox_${user.id}`, JSON.stringify(updated));
            }
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
      <aside className="w-64 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex flex-col shadow-sm">
        <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 dark:bg-blue-500 rounded-lg flex items-center justify-center text-white">
            <Mail size={18} />
          </div>
          <span className="font-bold text-xl tracking-tight text-slate-900 dark:text-slate-100">OutboundFlow</span>
        </div>
        <nav className="flex-1 p-4 space-y-2">
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
          <div className="px-3 py-2 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
            <div className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1">Signed in as</div>
            <div className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">{user?.email}</div>
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
      <AppContent />
    </ThemeProvider>
  );
};

const NavItem: React.FC<{ icon: React.ReactNode; label: string; active?: boolean; onClick: () => void; }> = ({ icon, label, active, onClick }) => (
  <button onClick={onClick} className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-200 ${active ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-semibold shadow-sm' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-slate-100'}`}>
    {icon}<span className="text-sm">{label}</span>
  </button>
);

export default App;
