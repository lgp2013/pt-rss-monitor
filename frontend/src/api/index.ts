<<<<<<< HEAD
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

  create: (data: { name: string; url: string; category?: string; fetch_interval?: number; enabled?: boolean }) =>
    fetchJson<any>('/sources', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: number, data: Partial<{ name: string; url: string; category: string; fetch_interval: number; enabled: boolean }>) =>
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
};
=======
// API 调用函数

const API_BASE_URL = '/api'

// 通用请求函数
async function request<T>(url: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }

  return response.json()
}

// 格式化日期
export function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
}

// RSS 源相关 API
export async function getSources() {
  return request<any[]>('/sources')
}

export async function addSource(source: {
  name: string
  url: string
  category: string
  fetch_interval: number
  enabled: number
}) {
  return request<any>('/sources', {
    method: 'POST',
    body: JSON.stringify(source)
  })
}

export async function updateSource(id: number, source: {
  name: string
  url: string
  category: string
  fetch_interval: number
  enabled: number
}) {
  return request<any>(`/sources/${id}`, {
    method: 'PUT',
    body: JSON.stringify(source)
  })
}

export async function deleteSource(id: number) {
  return request<{ success: boolean }>(`/sources/${id}`, {
    method: 'DELETE'
  })
}

export async function fetchSource(id: number) {
  return request<{ success: boolean; new_resources: number }>(`/sources/${id}/fetch`, {
    method: 'POST'
  })
}

export async function fetchAllSources() {
  return request<{ success: boolean }>('/sources/fetch-all', {
    method: 'POST'
  })
}

// 资源相关 API
export async function getResources(params: {
  page?: number
  limit?: number
  source_id?: number
  category?: string
  search?: string
  sort_by?: string
  sort_order?: string
}) {
  const queryParams = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) {
      queryParams.append(key, value.toString())
    }
  })
  return request<{
    data: any[]
    pagination: {
      page: number
      limit: number
      total: number
      total_pages: number
    }
  }>(`/resources?${queryParams.toString()}`)
}

export async function deleteResource(id: number) {
  return request<{ success: boolean }>(`/resources/${id}`, {
    method: 'DELETE'
  })
}

export async function cleanResources(days: number) {
  return request<{ success: boolean; deleted: number }>(`/resources/clean?days=${days}`, {
    method: 'POST'
  })
}

export async function cleanAllResources() {
  return request<{ success: boolean; deleted: number }>('/resources/clean-all', {
    method: 'POST'
  })
}

// 设置相关 API
export async function getSettings() {
  return request<any[]>('/settings')
}

export async function updateSettings(settings: { [key: string]: string }) {
  return request<{ success: boolean }>('/settings', {
    method: 'PUT',
    body: JSON.stringify(settings)
  })
}

export async function getStats() {
  return request<any>('/stats')
}
>>>>>>> b3b2b8ce71669aa78e478944f8439346c72c5bd9
