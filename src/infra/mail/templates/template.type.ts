// src/infra/emails/email.types.ts

export interface BaseEmailProps {
  title: string;
  content: string;
}

export interface OTPEmailProps {
  name: string;
  otp: string;
  email: string;
}

export interface ContactEmailProps {
  fullName: string;
  email: string;
  phoneNumber?: string;
  subject?: string;
  message: string;
  submittedAt?: Date;
}

export interface AccountStatusProps {
  name: string;
  email: string;
}

export interface VerificationStatusProps {
  name: string;
  email: string;
  isVerified: boolean;
}

export interface UserMailProps {
  firstName: string;
  lastName: string;
  subject: string;
  message: string;
  sentAt?: Date;
}

export interface DeleteAccountConfirmationProps {
  name: string;
}

export interface SystemDeleteAccountProps {
  name: string;
  reason?: string;
  deletedBy?: string;
  supportEmail: string;
}
