export type Role = "user" | "admin";
export type Status =
  | "active"
  | "under_review"
  | "confirmed"
  | "contested"
  | "resolved"
  | "inactive"
  | "spam"
  | "deleted";
export type Risk = 1 | 2 | 3 | 4;
export type Vote = "confirm" | "contest" | "spam";
export interface Contribution {
  opinion: Vote | null;
  resolution_reported: boolean;
}
export interface Position {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  captured_at: string;
}
export interface Profile {
  id: string;
  name: string;
  role: Role;
  status: "active" | "suspended" | "deletion_requested";
  anonymous_default: boolean;
  created_at: string;
}
export interface Category {
  id: string;
  name: string;
  icon: string;
  default_risk: Risk;
  active: boolean;
}
export interface Incident {
  id: string;
  title: string;
  description: string;
  category_id: string;
  latitude: number;
  longitude: number;
  region: string;
  risk: Risk;
  status: Status;
  score: number;
  anonymous: boolean;
  public_author_name: string | null;
  occurred_at: string;
  created_at: string;
  updated_at: string;
  expires_at: string;
  evidence_count: number;
  confirmations: number;
  contests: number;
  spam_votes: number;
  resolved_votes: number;
  moderated: boolean;
}
export interface Report {
  title: string;
  description: string;
  category_id: string;
  risk: Risk;
  anonymous: boolean;
  location: Position;
  region: string;
  occurred_at: string;
}
export interface Evidence {
  id: string;
  alert_id: string;
  kind: "image" | "video";
  path: string;
  anonymized: boolean;
  created_at: string;
}
export interface Comment {
  id: string;
  alert_id: string;
  body: string;
  created_at: string;
}
export interface History {
  id: string;
  alert_id: string;
  from_status: Status | null;
  to_status: Status;
  reason: string;
  created_at: string;
}
export interface Preferences {
  user_id?: string;
  enabled: boolean;
  radius_m: number;
  categories: string[];
  sound: boolean;
  latitude: number | null;
  longitude: number | null;
  zone_name: string;
  quiet_start: number | null;
  quiet_end: number | null;
  timezone: string;
}
export interface SafePlace {
  id: string;
  name: string;
  description: string;
  latitude: number;
  longitude: number;
  verified_at: string | null;
}
export interface Media {
  uri: string;
  name: string;
  mime: string;
  size: number;
}
