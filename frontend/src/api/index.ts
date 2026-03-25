const API_BASE = '/api';
const AUTH_TOKEN_KEY = 'auth_token';
const AUTH_USER_KEY = 'auth_user';

function getAuthToken(): string {
  return localStorage.getItem(AUTH_TOKEN_KEY) || '';
}

export function setAuthSession(token: string, user: AuthUser) {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
  localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
}

export function clearAuthSession() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_USER_KEY);
}

export function getStoredAuthUser(): AuthUser | null {
  const raw = localStorage.getItem(AUTH_USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const token = getAuthToken();
  const response = await fetch(`${API_BASE}${url}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    if (response.status === 401) {
      clearAuthSession();
    }
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

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
  cookie_updated_at?: string | null;
  cookie_sync_mode?: string | null;
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

export interface UserData {
  id: number;
  site_id: number;
  site_name: string;
  site_category: string;
  site_enabled: number;
  site_url: string;
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

export interface AuthUser {
  id: number;
  username: string;
  is_system: number;
}

export interface ResourceListItem {
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
  source_name: string;
}

// Sources API
export const sourcesApi = {
  list: () => fetchJson<Source[]>('/sources'),

  create: (data: Partial<Source> & { name: string; url: string }) =>
    fetchJson<Source>('/sources', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: number, data: Partial<Source>) =>
    fetchJson<Source>(`/sources/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: number) =>
    fetchJson<{ success: boolean }>(`/sources/${id}`, {
      method: 'DELETE',
    }),

  fetch: (id: number) =>
    fetchJson<{ success: boolean; new_resources: number }>(`/sources/${id}/fetch`, {
      method: 'POST',
    }),

  fetchAll: () =>
    fetchJson<{ success: boolean }>('/sources/fetch-all', {
      method: 'POST',
    }),
};

export const userDataApi = {
  list: () => fetchJson<UserData[]>('/user-data'),

  save: (siteId: number, data: Partial<UserData>) =>
    fetchJson<UserData>(`/user-data/${siteId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  history: (siteId: number) => fetchJson<UserDataHistory[]>(`/user-data/${siteId}/history`),

  refresh: (siteId: number) =>
    fetchJson<{
      success: boolean;
      need_login: boolean;
      site_url?: string;
      profile_url?: string;
      warning?: string;
      error?: string;
      data?: UserData;
      parsed_fields?: Record<string, boolean>;
    }>(`/user-data/${siteId}/refresh`, {
      method: 'POST',
    }),
};

export const sitesApi = {
  list: () => fetchJson<Site[]>('/sites'),

  create: (data: Partial<Site> & { name: string; site_url: string }) =>
    fetchJson<Site>('/sites', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: number, data: Partial<Site>) =>
    fetchJson<Site>(`/sites/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: number) =>
    fetchJson<{ success: boolean }>(`/sites/${id}`, {
      method: 'DELETE',
    }),
};

export const authApi = {
  login: (username: string, password: string) =>
    fetchJson<{ token: string; user: AuthUser }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  me: () => fetchJson<AuthUser>('/auth/me'),

  logout: () =>
    fetchJson<{ success: boolean }>('/auth/logout', {
      method: 'POST',
    }),

  changePassword: (data: { current_password: string; new_password: string; confirm_password: string }) =>
    fetchJson<{ success: boolean; token: string }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  resetAdminPassword: () =>
    fetchJson<{ success: boolean; token: string; default_password: string }>('/auth/reset-admin-password', {
      method: 'POST',
    }),
};

// Resources API
export const resourcesApi = {
  list: (params: {
    page?: number;
    limit?: number;
    source_id?: number;
    category?: string;
    search?: string;
    resolution?: string;
    free_tag?: string;
    sort_by?: string;
    sort_order?: string;
  }) => {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set('page', String(params.page));
    if (params.limit) searchParams.set('limit', String(params.limit));
    if (params.source_id) searchParams.set('source_id', String(params.source_id));
    if (params.category) searchParams.set('category', params.category);
    if (params.search) searchParams.set('search', params.search);
    if (params.resolution) searchParams.set('resolution', params.resolution);
    if (params.free_tag) searchParams.set('free_tag', params.free_tag);
    if (params.sort_by) searchParams.set('sort_by', params.sort_by);
    if (params.sort_order) searchParams.set('sort_order', params.sort_order);

    return fetchJson<{ data: ResourceListItem[]; pagination: { page: number; limit: number; total: number; total_pages: number } }>(
      `/resources?${searchParams.toString()}`
    );
  },

  delete: (id: number) =>
    fetchJson<{ success: boolean }>(`/resources/${id}`, {
      method: 'DELETE',
    }),

  clean: (days?: number) =>
    fetchJson<{ success: boolean; deleted: number }>(`/resources/clean${days ? `?days=${days}` : ''}`, {
      method: 'POST',
    }),

  cleanAll: () =>
    fetchJson<{ success: boolean; deleted: number }>('/resources/clean-all', {
      method: 'POST',
    }),
};

// Settings API
export const settingsApi = {
  get: () => fetchJson<Record<string, string>>('/settings'),

  update: (data: Record<string, string>) =>
    fetchJson<{ success: boolean }>('/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  getStats: () =>
    fetchJson<{
      total_sources: number;
      total_resources: number;
      total_sites: number;
      sources_by_category: Record<string, number>;
      resources_today: number;
    }>('/settings/stats'),

  getCategories: () => fetchJson<{ categories: string[] }>('/settings/categories'),

  addCategory: (name: string) =>
    fetchJson<{ categories: string[] }>('/settings/categories', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),

  deleteCategory: (name: string) =>
    fetchJson<{ success: boolean; categories: string[] }>(`/settings/categories/${encodeURIComponent(name)}`, {
      method: 'DELETE',
    }),

  getExtensionSync: () =>
    fetchJson<{
      sync_key: string;
      endpoint_path: string;
      health_path: string;
    }>('/settings/extension-sync'),

  regenerateExtensionSync: () =>
    fetchJson<{
      success: boolean;
      sync_key: string;
      endpoint_path: string;
      health_path: string;
    }>('/settings/extension-sync/regenerate', {
      method: 'POST',
    }),
};
