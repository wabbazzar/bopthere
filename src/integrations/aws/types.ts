export interface RSVPRequest {
  name: string;
  email: string;
  phone?: string;
  attendance: 'yes' | 'no';
  notifications?: boolean;
  dietary_restrictions?: string;
  song_request?: string;
  message_for_couple?: string;
}

export interface RSVPResponse {
  id: string;
  name: string;
  email: string;
  phone: string;
  attendance: string;
  notifications: boolean;
  dietary_restrictions: string;
  song_request: string;
  message_for_couple: string;
  created_at: string;
  updated_at: string;
}

export interface APIResponse<T> {
  message?: string;
  data?: T;
  error?: string;
}