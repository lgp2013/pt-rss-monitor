const API_BASE = '/api';

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${url}`, {
    headers: {
      'Content-Type': 'application/json',
    },
    ...options,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || `HTTP ${response.status}`);
  }

  return response.json();
}

// Sources API
export const sourcesApi = {
  list: () => fetchJson<any[]>('/sources'),

  create: (data: { name: string; url: string; category?: string; fetch_interval?: number; enabled?: boolean; cookie?: string }) =>
    fetchJson<any>('/sources', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: number, data: Partial<{ name: string; url: string; category: string; fetch_interval: number; enabled: boolean; cookie: string }>) =>
    fetchJson<any>(`/sources/${id}`, {
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

  batchDelete: (ids: number[]) =>
    Promise.all(ids.map(id => sourcesApi.delete(id))).then(() => ({ success: true })),

  batchUpdate: (ids: number[], updates: Partial<{ enabled: boolean }>) =>
    Promise.all(ids.map(id => sourcesApi.update(id, updates))).then(() => ({ success: true })),
};

// Resources API
export const resourcesApi = {
  list: (params: {
    page?: number;
    limit?: number;
    source_id?: number;
    category?: string;
    search?: string;
    sort_by?: string;
    sort_order?: string;
  }) => {
    const searchParams = new URLSearchParams();
    if (params.page) searchParams.set('page', String(params.page));
    if (params.limit) searchParams.set('limit', String(params.limit));
    if (params.source_id) searchParams.set('source_id', String(params.source_id));
    if (params.category) searchParams.set('category', params.category);
    if (params.search) searchParams.set('search', params.search);
    if (params.sort_by) searchParams.set('sort_by', params.sort_by);
    if (params.sort_order) searchParams.set('sort_order', params.sort_order);

    return fetchJson<{ data: any[]; pagination: { page: number; limit: number; total: number; total_pages: number } }>(
      `/resources?${searchParams.toString()}`
    );
  },

  delete: (id: number) =>
    fetchJson<{ success: boolean }>(`/resources/${id}`, {
      method: 'DELETE',
    }),

  batchDelete: (ids: number[]) =>
    Promise.all(ids.map(id => resourcesApi.delete(id))).then(() => ({ success: true })),

  clean: (days?: number) =>
    fetchJson<{ success: boolean; deleted: number }>(`/resources/clean${days ? `?days=${days}` : ''}`, {
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
      sources_by_category: Record<string, number>;
      resources_today: number;
    }>('/settings/stats'),

  getCategories: () =>
    fetchJson<{ categories: string[] }>('/settings/categories'),
};

// Search Snapshots API
export const snapshotsApi = {
  list: () =>
    fetchJson<{ data: any[] }>('/snapshots').then(res => res.data),

  get: (id: number) =>
    fetchJson<{ data: any }>(`/snapshots/${id}`).then(res => res.data),

  create: (data: { name: string; query: string; filters?: any; result_ids: number[]; source_ids: number[] }) =>
    fetchJson<{ data: any }>('/snapshots', {
      method: 'POST',
      body: JSON.stringify(data),
    }).then(res => res.data),

  delete: (id: number) =>
    fetchJson<{ success: boolean }>(`/snapshots/${id}`, {
      method: 'DELETE',
    }),
};

// Fetch History API
export const fetchlogApi = {
  list: () =>
    fetchJson<{ data: any[] }>('/fetchlog').then(res => res.data),
};
