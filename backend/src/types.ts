export interface Source {
  id: number;
  name: string;
  url: string;
  category: string;
  fetch_interval: number;
  enabled: number;
  created_at: string;
}

export interface Site {
  id: number;
  name: string;
  site_url: string;
  category: string;
  enabled: number;
  created_at: string;
  cookie?: string;
  cookies?: Record<string, string>;
  groups?: string[];
  is_offline?: number;
  allow_search?: number;
  allow_query_user_info?: number;
  allow_content_script?: number;
  custom_name?: string | null;
  timezone_offset?: string | null;
  passkey?: string | null;
  download_link_appendix?: string | null;
  request_timeout?: number;
  download_interval?: number;
  upload_speed_limit?: number;
}

export interface Resource {
  id: number;
  source_id: number;
  title: string;
  translated_name?: string | null;
  link: string;
  guid: string | null;
  pub_date: string | null;
  seeders: number;
  leechers: number;
  downloads: number;
  free_tag: string | null;
  size: string | null;
  created_at: string;
  subtitle?: string | null;
  poster_url?: string | null;
  category?: string | null;
  description?: string | null;
  description_html?: string | null;
}

export interface Setting {
  key: string;
  value: string;
}

export interface Stats {
  total_sources: number;
  total_resources: number;
  sources_by_category: Record<string, number>;
  resources_today: number;
}

export interface UserData {
  id: number;
  site_id: number;
  username: string | null;
  user_id: string | null;
  level_name: string | null;
  uploaded: number;
  downloaded: number;
  ratio: number | null;
  true_uploaded: number | null;
  true_downloaded: number | null;
  true_ratio: number | null;
  uploads: number;
  seeding: number;
  seeding_size: number;
  bonus: number;
  bonus_per_hour: number;
  invites: number;
  join_time: string | null;
  last_access_at: string | null;
  message_count: number;
  status: string;
  updated_at: string;
}

export interface UserDataHistory extends UserData {
  history_id: number;
  snapshot_at: string;
}

export interface User {
  id: number;
  username: string;
  password_hash: string;
  is_system: number;
  created_at: string;
  updated_at: string;
}

export interface AuthSession {
  token: string;
  user_id: number;
  created_at: string;
  expires_at: string;
}
