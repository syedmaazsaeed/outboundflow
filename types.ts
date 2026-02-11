
export enum CampaignStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  COMPLETED = 'COMPLETED'
}

export interface LeadFolder {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
}

export interface SmtpAccount {
  id: string;
  label: string;
  host: string;
  port: number;
  user: string;
  pass: string;
  secure: boolean;
  fromEmail: string;
  warmupEnabled: boolean;
  warmupSentToday: number;
  dailySendLimit: number;
  sentToday: number;
  lastResetDate: string;
}

export interface Lead {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  company: string;
  website?: string;
  customVariable?: string; 
  customFields?: Record<string, string>; // Support for any extra columns from CSV
  verificationStatus: 'VERIFIED' | 'CATCHALL' | 'INVALID' | 'UNVERIFIED';
  status: 'PENDING' | 'CONTACTED' | 'REPLIED' | 'BOUNCED' | 'INTERESTED';
  folderId?: string; // Optional folder assignment
  assignedInboxId?: string; // Track which inbox is assigned to this lead
  unsubscribedAt?: string; // Timestamp when lead unsubscribed (ISO string)
}

export interface SequenceStep {
  id: string;
  order: number;
  delayDays: number;
  delayHours: number;
  delayMinutes: number;
  webhookUrl: string; 
  promptHint?: string; 
}

export interface CampaignSchedule {
  days: number[]; // 0-6
  startTime: string; // "HH:mm"
  endTime: string;
  timezone: string;
  enabled: boolean; // Enable/disable automated scheduling
  type: 'DAILY' | 'ONCE' | 'WEEKLY'; // Schedule type
  startDate?: string; // For 'ONCE' or 'WEEKLY' schedules (ISO date string)
}

export interface Campaign {
  id: string;
  name: string;
  status: CampaignStatus;
  leads: Lead[];
  steps: SequenceStep[];
  schedule: CampaignSchedule;
  senderAccountId?: string; // Deprecated: use senderAccountIds instead
  senderAccountIds?: string[]; // Multiple SMTP account IDs for rotation
  createdAt: string;
}

export interface ExecutionLog {
  id: string;
  campaignId: string;
  leadId: string;
  stepId: string;
  smtpAccountId?: string; // Track which SMTP account was used
  timestamp: string;
  subject: string;
  body: string;
  status: 'SUCCESS' | 'ERROR';
  errorDetails?: string;
  type: 'WEBHOOK' | 'SEND';
}

export interface CampaignAnalytics {
  id: string;
  campaignId: string;
  date: string;
  emailsSent: number;
  emailsDelivered: number;
  emailsOpened: number;
  emailsClicked: number;
  emailsReplied: number;
  emailsBounced: number;
  createdAt: string;
  updatedAt: string;
}

export interface EmailMessage {
  id: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  date: string;
  isRead: boolean;
  campaignId?: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
}
