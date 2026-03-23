export interface Source {
  id: number;
  name: string;
  url: string;
  category: string;
  fetch_interval: number;
  enabled: number;
  created_at: string;
}

export interface Resource {
  id: number;
  source_id: number;
  title: string;
  link: string;
  guid: string | null;
  pub_date: string | null;
  seeders: number;
  leechers: number;
  downloads: number;
  free_tag: string | null;
  size: string | null;
  created_at: string;
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
