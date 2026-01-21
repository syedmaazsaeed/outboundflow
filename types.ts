
export enum CampaignStatus {
  DRAFT = 'DRAFT',
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  COMPLETED = 'COMPLETED'
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
}

export interface SequenceStep {
  id: string;
  order: number;
  delayDays: number;
  webhookUrl: string; 
  promptHint?: string; 
}

export interface CampaignSchedule {
  days: number[]; // 0-6
  startTime: string; // "HH:mm"
  endTime: string;
  timezone: string;
}

export interface Campaign {
  id: string;
  name: string;
  status: CampaignStatus;
  leads: Lead[];
  steps: SequenceStep[];
  schedule: CampaignSchedule;
  senderAccountId?: string;
  createdAt: string;
}

export interface ExecutionLog {
  id: string;
  campaignId: string;
  leadId: string;
  stepId: string;
  timestamp: string;
  subject: string;
  body: string;
  status: 'SUCCESS' | 'ERROR';
  errorDetails?: string;
  type: 'WEBHOOK' | 'SEND';
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
