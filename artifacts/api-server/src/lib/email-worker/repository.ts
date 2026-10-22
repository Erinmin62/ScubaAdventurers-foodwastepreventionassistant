import type { Stored } from "../guard-model";
import type { EmailKind, EmailMessage } from "./rules";
import type { SendResult } from "./sender";

export type EmailStatus = "queued" | "sending" | "accepted" | "failed" | "uncertain" | "cancelled";
export type EmailRecord = {
  id: string; workspaceId: string; recipientHash: string; kind: EmailKind; eventKey: string;
  relatedIds: string[]; scheduledAt: string; observedAt: string; status: EmailStatus;
  message: EmailMessage; attempts: number; acceptedAt?: string;
};
export type WorkspaceRecord = { id: string; data: Stored };
export interface EmailRepository {
  lock(): Promise<boolean>;
  unlock(): Promise<void>;
  recoverInterrupted(): Promise<number>;
  workspaces(ids?: string[]): Promise<WorkspaceRecord[]>;
  workspace(id: string): Promise<WorkspaceRecord | null>;
  records(workspaceId: string, recipientHash: string): Promise<EmailRecord[]>;
  enqueue(record: EmailRecord): Promise<void>;
  cancelInactive(workspaceId: string, recipientHash: string, activeIds: string[]): Promise<number>;
  cancel(id: string): Promise<void>;
  startAttempt(id: string, message: EmailMessage, at: string): Promise<boolean>;
  finishAttempt(id: string, result: SendResult, at: string): Promise<void>;
}
