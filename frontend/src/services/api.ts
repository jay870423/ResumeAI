const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1';

interface ApiResponse<T = any> {
  code: number;
  message: string;
  data: T;
}

function getToken(): string {
  return localStorage.getItem('resume_token') || '';
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      ...options.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!res.ok && res.status >= 500) {
    throw new Error(`服务器错误: ${res.status}`);
  }

  const json: ApiResponse<T> = await res.json();
  if (json.code !== 0 && json.code !== 200) {
    throw new Error(json.message || '请求失败');
  }
  return json.data;
}

// ─── 注册 ───────────────────────────────────────────────

export interface RegisterData {
  token: string;
  username: string;
  name: string;
}

export async function register(username: string, password: string, name: string): Promise<RegisterData> {
  return request<RegisterData>('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, name }),
  });
}

// ─── 登录 ───────────────────────────────────────────────

export interface LoginData {
  token: string;
  username: string;
  name: string;
}

export async function login(username: string, password: string): Promise<LoginData> {
  const data = await request<LoginData>('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  // 登录成功后把 token 存到 localStorage
  localStorage.setItem('resume_token', data.token);
  localStorage.setItem('resume_user', JSON.stringify({ token: data.token, username: data.username, name: data.name }));
  return data;
}

export function logout(): void {
  localStorage.removeItem('resume_token');
  localStorage.removeItem('resume_user');
}

export function getStoredUser(): { username: string; name: string } | null {
  const raw = localStorage.getItem('resume_user');
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

// ─── 简历上传 ───────────────────────────────────────────────

export interface UploadResponse {
  resume_id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  page_count: number;
}

export async function uploadResume(file: File): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append('file', file);
  return request<UploadResponse>('/resume/upload', {
    method: 'POST',
    body: formData,
  });
}

// ─── 简历解析 ───────────────────────────────────────────────

export interface ParseResponse {
  resume_id: string;
  raw_text: string;
  word_count: number;
  page_count: number;
}

export async function parseResume(resumeId: string): Promise<ParseResponse> {
  return request<ParseResponse>(`/resume/${resumeId}/parse`, {
    method: 'POST',
  });
}

// ─── 简历分析 ───────────────────────────────────────────────

export interface BasicInfo {
  name: string;
  education: string;
  major: string;
  experience_years: number;
  current_industry: string;
}

export interface Score {
  completeness: number;
  structure: number;
  keywords: number;
}

export interface Strength { title: string; evidence: string }
export interface Weakness { title: string; detail: string; risk: string }
export interface Suggestion { section: string; current: string; suggestion: string }

export interface AnalyzeResponse {
  resume_id: string;
  basic_info: BasicInfo;
  score: Score;
  strengths: Strength[];
  weaknesses: Weakness[];
  optimization_suggestions: Suggestion[];
  analyzed_at: string;
}

export async function analyzeResume(
  resumeId: string,
  targetIndustry?: string,
  keywords?: string[],
): Promise<AnalyzeResponse> {
  // 后端 optimize?optimize_type=analyze 现在返回完整的 AnalyzeResponse 格式
  const params = new URLSearchParams({ resume_id: resumeId, optimize_type: 'analyze' });
  if (targetIndustry) params.set('target_industry', targetIndustry);
  if (keywords?.length) params.set('keywords', keywords.join(','));
  return request<AnalyzeResponse>(`/resume/optimize?${params}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
}

// ─── 职场人格画像 ───────────────────────────────────────────

export interface PersonaDimension {
  label: string;
  value: string;
  detail: string;
  icon?: string;
}

export interface PersonaDimensions {
  communication_style: PersonaDimension;
  decision_mode: PersonaDimension;
  collaboration: PersonaDimension;
  motivation: PersonaDimension;
}

export interface PersonaResponse {
  resume_id: string;
  mbti_type: string;
  type_label: string;
  type_description: string;
  dimensions: PersonaDimensions;
  strengths: string[];
  weaknesses: string[];
  ideal_environment: string;
  career_suggestions: string[];
  summary: string;
  confidence: number;
  generated_at: string;
}

export async function generatePersona(
  resumeId: string,
  targetIndustry?: string,
): Promise<PersonaResponse> {
  // 调用后端 /resume/persona 接口（MiniMax生成，可能较慢）
  const params = new URLSearchParams({ resume_id: resumeId });
  if (targetIndustry) params.set('target_industry', targetIndustry);
  return request<PersonaResponse>(`/resume/persona?${params}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
}

// ─── 关键词联想 ─────────────────────────────────────────────

export interface KeywordItem {
  keyword: string;
  category: string;
  priority: '高' | '中' | '低';
  reason: string;
}

export interface ExperienceSuggestion {
  direction: string;
  keywords: string[];
}

export interface KeywordsResponse {
  recommended_keywords: KeywordItem[];
  experience_suggestions: ExperienceSuggestion[];
}

export async function generateKeywords(
  industry: string,
  major: string,
  interests: string[],
  skills: string[],
): Promise<KeywordsResponse> {
  return request<KeywordsResponse>('/keywords/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ industry, major, interests, skills }),
  });
}

// ─── AI优化 ────────────────────────────────────────────────

export interface OptimizeChange {
  before: string;
  after: string;
  reason: string;
  type?: string;
  section?: string;
}

export interface OptimizeResponse {
  resume_id: string;
  name?: string;
  optimized_text: string;
  changes: OptimizeChange[];
  summary: string;
}

export async function optimizeResume(
  resumeId: string,
  optimizeType = 'full',
  targetIndustry?: string,
  targetKeywords?: string[],
): Promise<OptimizeResponse> {
  const params = new URLSearchParams({ resume_id: resumeId, optimize_type: optimizeType });
  if (targetIndustry) params.set('target_industry', targetIndustry);
  return request<OptimizeResponse>(`/resume/optimize?${params}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
}

// ─── 简历状态 ───────────────────────────────────────────────

export interface ResumeStatus {
  resume_id: string;
  file_name: string;
  status: 'pending' | 'parsed' | 'analyzed' | 'optimized';
  has_optimized: boolean;
  created_at: string;
  analyzed_at?: string;
}

export async function getResumeStatus(resumeId: string): Promise<ResumeStatus> {
  return request<ResumeStatus>(`/resume/${resumeId}`);
}

// ─── 历史记录 ───────────────────────────────────────────────

export interface HistoryItem {
  resume_id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  status: string;
  created_at: string;
  analyzed_at?: string;
  user_id: string;
  user_name: string;
  has_text: boolean;
  has_optimized: boolean;
  has_persona: boolean;
}

export interface HistoryListResponse {
  items: HistoryItem[];
  total: number;
  page: number;
  page_size: number;
  is_admin: boolean;
}

export async function listResumes(page = 1, pageSize = 20): Promise<HistoryListResponse> {
  return request<HistoryListResponse>(`/resume/list?page=${page}&page_size=${pageSize}`);
}

// ─── 订阅/额度 ───────────────────────────────────────────────

export type QuotaData = {
  quota_remain: number;
  quota_total: number;
  plan_type: string;
  expire_at: string | null;
};

export async function getQuota(): Promise<{code: number; message: string; data: QuotaData}> {
  const token = getToken();
  const res = await fetch(`${BASE_URL}/subscription/quota`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  return res.json();
}

export async function subscribe(
  planType: 'monthly' | 'single',
  resumeId?: string,
): Promise<{code: number; message: string; data?: any; detail?: string}> {
  const token = getToken();
  const body: Record<string, string> = { plan_type: planType };
  if (resumeId) body.resume_id = resumeId;
  const res = await fetch(`${BASE_URL}/subscription/subscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  return res.json();
}

// ─── 导出 ───────────────────────────────────────────────────

export type ExportFormat = 'pdf' | 'docx' | 'html';

export async function exportResume(
  resumeId: string,
  format: ExportFormat = 'pdf',
  useOptimized = true,
): Promise<Blob> {
  const token = getToken();
  const params = new URLSearchParams({
    resume_id: resumeId,
    format,
    use_optimized: String(useOptimized),
  });
  const res = await fetch(`${BASE_URL}/resume/export?${params}`, {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) throw new Error('导出失败');
  return res.blob();
}
