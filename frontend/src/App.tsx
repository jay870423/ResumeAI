import React, { useState, useCallback, useEffect } from 'react';
import { Upload, FileText, Sparkles, Download, RefreshCw, CheckCircle, AlertCircle, LogOut } from 'lucide-react';
import './App.css';
import LoginPage from './pages/LoginPage';

import {
  uploadResume,
  parseResume,
  analyzeResume,
  generatePersona,
  optimizeResume,
  exportResume,
  logout,
  getStoredUser,
  listResumes,
  getQuota,
  subscribe,
  type AnalyzeResponse,
  type PersonaResponse,
  type OptimizeResponse,
  type HistoryItem,
} from './services/api';

type Step = 'upload' | 'analyzing' | 'result' | 'history';

// ─── 简历HTML排版辅助 ─────────────────────────────────────
// ─── 简历 HTML 排版解析 ────────────────────────────────────

interface ResumeSection {
  type: 'name' | 'meta' | 'section' | 'entry' | 'bullet' | 'text' | 'empty' | 'skill-tag';
  text: string;
  level?: number; // entry 层级（0=公司/学校，1=职位/时间，2+=详情）
  tag?: string;   // skill-tag 时存储标签文本
}

const SECTION_KEYWORDS = [
  '个人信息', '求职意向', '教育背景', '工作经历', '项目经验',
  '专业技能', '自我评价', '获奖荣誉', '语言能力', '兴趣爱好',
  '社团经历', '实习经历', '培训经历', '证书资质', '其他',
];

// 识别行类型
function getLineType(s: string): ResumeSection['type'] {
  if (!s) return 'empty';
  // 姓名行：纯中文2-6字，无冒号
  if (/^[\u4e00-\u9fff]{2,6}$/.test(s)) return 'name';
  // 段标题
  if (SECTION_KEYWORDS.some(kw => s.startsWith(kw) || s === kw)) return 'section';
  // 技能标签行（纯逗号/空格分隔的短词）
  if (/^[\u4e00-\u9fff\w\s,，、]+$/.test(s) && s.length < 60 && s.split(/[,，\s]+/).length >= 2) {
    const tokens = s.split(/[,，、\s]+/).filter(Boolean);
    if (tokens.every(t => t.length <= 8) && tokens.length >= 2) return 'skill-tag';
  }
  return 'text';
}

// 解析元信息行
function parseMetaLine(s: string): Array<{ label: string; value: string }> {
  const metas: Array<{ label: string; value: string }> = [];
  // 分割：支持 · ｜ / 三种分隔符
  const parts = s.split(/\s*[·｜/]\s*/);
  for (const part of parts) {
    const m = part.trim().match(/^([^\s：:]+)[：:]\s*(.+)$/);
    if (m) metas.push({ label: m[1], value: m[2] });
    else if (part.trim()) metas.push({ label: '', value: part.trim() });
  }
  return metas;
}

// 解析文本内容行
function parseTextLine(s: string): ResumeSection['type'] {
  if (s.startsWith('•') || s.startsWith('-') || s.startsWith('·')) return 'bullet';
  // 检测是否为条目起始（公司/学校/项目名，常含时间）
  if (/^[\u4e00-\u9fff]/.test(s) && /[\d]{4}/.test(s) && s.length < 80) return 'entry';
  return 'text';
}

// 核心解析函数
function parseResumeToSections(text: string): ResumeSection[] {
  if (!text) return [];
  const lines = text.split('\n');
  const sections: ResumeSection[] = [];
  let i = 0;

  while (i < lines.length) {
    const raw = lines[i];
    const s = raw.trim();
    const type = getLineType(s);

    if (type === 'empty') {
      sections.push({ type: 'empty', text: '' });
      i++;
      continue;
    }

    if (type === 'name') {
      // 姓名后跟元信息行
      sections.push({ type: 'name', text: s });
      const next = lines[i + 1]?.trim() || '';
      const nextType = getLineType(next);
      if (next && nextType !== 'section' && nextType !== 'empty') {
        sections.push({ type: 'meta', text: next });
        i += 2;
      } else {
        i++;
      }
      continue;
    }

    if (type === 'meta') {
      sections.push({ type: 'meta', text: s });
      i++;
      continue;
    }

    if (type === 'skill-tag') {
      const tags = s.split(/[,，、\s]+/).filter(Boolean);
      for (const tag of tags) {
        sections.push({ type: 'skill-tag', text: tag.trim() });
      }
      i++;
      continue;
    }

    if (type === 'section') {
      sections.push({ type: 'section', text: s });
      i++;
      continue;
    }

    if (type === 'text') {
      const textType = parseTextLine(s);
      if (textType === 'entry') {
        sections.push({ type: 'entry', text: s, level: 0 });
        // 下一行可能是职位/时间
        const next1 = lines[i + 1]?.trim() || '';
        const next1Type = getLineType(next1);
        if (next1 && next1Type !== 'section' && next1Type !== 'empty' && !next1.startsWith('•') && !next1.startsWith('-')) {
          sections.push({ type: 'entry', text: next1, level: 1 });
          i += 2;
        } else {
          i++;
        }
      } else if (textType === 'bullet') {
        sections.push({ type: 'bullet', text: s.slice(1).trim() });
        i++;
      } else {
        sections.push({ type: 'text', text: s });
        i++;
      }
      continue;
    }

    i++;
  }

  return sections;
}

// 渲染元信息行为胶囊标签
function renderMetaCapsules(text: string): string {
  const metas = parseMetaLine(text);
  if (metas.length === 0) return `<span class="rph-meta-plain">${text}</span>`;
  return metas.map(m =>
    m.label
      ? `<span class="rph-capsule"><span class="rph-capsule-label">${m.label}</span><span class="rph-capsule-value">${m.value}</span></span>`
      : `<span class="rph-capsule rph-capsule-plain">${m.value}</span>`
  ).join('');
}

// 生成 HTML
function formatResumeHtml(text: string): string {
  if (!text) return '';
  const sections = parseResumeToSections(text);
  const htmlParts: string[] = [];
  let i = 0;
  let sectionBlockOpen = false;

  while (i < sections.length) {
    const sec = sections[i];
    const { type, text: s, level } = sec;

    if (type === 'empty') { i++; continue; }

    if (type === 'name') {
      // 先关闭可能打开的 section-block
      if (sectionBlockOpen) {
        htmlParts.push('</div></div>');
        sectionBlockOpen = false;
      }
      htmlParts.push('<div class="rph-header">');
      htmlParts.push(`<div class="rph-name-wrap"><span class="rph-name-star">✦</span><h1 class="rph-name">${s}</h1><span class="rph-name-star">✦</span></div>`);
      const nextMeta = sections[i + 1];
      if (nextMeta?.type === 'meta') {
        htmlParts.push(`<div class="rph-capsule-row">${renderMetaCapsules(nextMeta.text)}</div>`);
        i++;
      }
      htmlParts.push('<div class="rph-header-divider"></div>');
      htmlParts.push('</div>');
      i++;
      continue;
    }

    if (type === 'section') {
      // 关闭上一个 section-block
      if (sectionBlockOpen) {
        htmlParts.push('</div></div>');
      }
      htmlParts.push('<div class="rph-section-block">');
      htmlParts.push(`<div class="rph-section-header"><span class="rph-section-icon">▶</span><h2 class="rph-section-title">${s}</h2></div>`);
      htmlParts.push('<div class="rph-section-body">');
      sectionBlockOpen = true;
      i++;
      continue;
    }

    if (type === 'entry') {
      if (level === 0) {
        htmlParts.push('<div class="rph-entry"><div class="rph-entry-org">' + s + '</div>');
      } else {
        htmlParts.push('<div class="rph-entry-meta">' + s + '</div></div>');
      }
      i++;
      continue;
    }

    if (type === 'bullet') {
      htmlParts.push('<div class="rph-bullet-item"><span class="rph-bullet">•</span><span class="rph-bullet-text">' + s + '</span></div>');
      i++;
      continue;
    }

    if (type === 'skill-tag') {
      htmlParts.push('<span class="rph-skill-tag">' + s + '</span>');
      i++;
      continue;
    }

    if (type === 'text') {
      htmlParts.push('<div class="rph-text-line">' + s + '</div>');
      i++;
      continue;
    }

    i++;
  }

  // 闭合最后打开的 section-block
  if (sectionBlockOpen) {
    htmlParts.push('</div></div>');
  }

  return htmlParts.join('');
}

// ─── App 主组件 ───────────────────────────────────────────

function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [userName, setUserName] = useState('');
  const [step, setStep] = useState<Step>('upload');
  const [resumeId, setResumeId] = useState('');
  const [fileName, setFileName] = useState('');
  const [analyzeResult, setAnalyzeResult] = useState<AnalyzeResponse | null>(null);
  const [persona, setPersona] = useState<PersonaResponse | null>(null);
  const [optimizeResult, setOptimizeResult] = useState<OptimizeResponse | null>(null);
  const [analyzeStep, setAnalyzeStep] = useState('');
  const [error, setError] = useState('');
  const [isOptimized, setIsOptimized] = useState(false);
  const [activeTab, setActiveTab] = useState<'analysis' | 'persona' | 'optimize'>('analysis');
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [showContact, setShowContact] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyList, setHistoryList] = useState<HistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showQuota, setShowQuota] = useState(false);
  // 初始化 sub：直接读 localStorage，避免 useEffect 时序导致短暂 null
  const storedUser = getStoredUser();
  const storedSub = storedUser?.username === 'admin'
    ? { quota_remain: 9999, quota_total: 9999, plan_type: 'free' }
    : (storedUser ? { quota_remain: 0, quota_total: 0, plan_type: 'free' } : null);
  const [sub, setSub] = useState<{quota_remain:number;quota_total:number;plan_type:string}|null>(storedSub);
  const [subscribing, setSubscribing] = useState(false);

  useEffect(() => {
    const stored = getStoredUser();
    if (stored) {
      setLoggedIn(true);
      setUserName(stored.name);
      setIsAdmin(stored.username === 'admin');
      // admin 直接硬编码额度，普通用户查 API
      if (stored.username === 'admin') {
        setSub({ quota_remain: 9999, quota_total: 9999, plan_type: 'free' });
      } else {
        getQuota().then(data => { if (data.data) setSub(data.data); }).catch(() => {});
      }
    }
  }, []);

  const handleLogin = (_username: string, name: string, _?: string) => {
    setLoggedIn(true);
    setUserName(name);
    setIsAdmin(_username === 'admin');
    // admin 直接硬编码额度，不依赖异步请求
    if (_username === 'admin') {
      setSub({ quota_remain: 9999, quota_total: 9999, plan_type: 'free' });
    } else {
      getQuota().then(data => { if (data.data) setSub(data.data); }).catch(() => {});
    }
  };

  const handleLogout = () => {
    logout();
    setLoggedIn(false);
    setUserName('');
    setStep('upload');
    setResumeId('');
    setFileName('');
    setAnalyzeResult(null);
    setPersona(null);
    setOptimizeResult(null);
    setIsOptimized(false);
    setError('');
    setAnalyzeStep('');
    setActiveTab('analysis');
    setShowContact(false);
    setSub(null);
  };

  const runAnalysis = useCallback(async (rid: string) => {
    try {
      setAnalyzeStep('正在解析简历文本...');
      await parseResume(rid);
      setAnalyzeStep('正在分析简历优势与劣势...');
      const analyzeRes = await analyzeResume(rid);
      setAnalyzeResult(analyzeRes);
      setAnalyzeStep('正在生成职场人格画像...');
      try {
        const personaRes = await generatePersona(rid);
        setPersona(personaRes);
      } catch { /* persona failure is non-blocking */ }
      setAnalyzeStep('分析完成');
      setStep('result');
    } catch (e: any) {
      setError(e.message || '分析失败');
      setStep('upload');
    }
  }, []);

  const handleFileUpload = useCallback(async (file: File) => {
    if ((sub?.quota_remain ?? 0) <= 0) {
      setError('额度不足，请先订阅');
      setShowQuota(true);
      return;
    }
    setError('');
    setFileName(file.name);
    try {
      const uploadRes = await uploadResume(file);
      setResumeId(uploadRes.resume_id);
      setStep('analyzing');
      runAnalysis(uploadRes.resume_id);
    } catch (e: any) {
      setError(e.message || '上传失败');
    }
  }, [runAnalysis]);

  const handleOptimize = useCallback(async () => {
    if (!resumeId) return;
    setError('');
    setIsOptimizing(true);
    try {
      const res = await optimizeResume(resumeId, 'full');
      setOptimizeResult(res);
      setIsOptimized(true);
    } catch (e: any) {
      setError(e.message || '优化失败');
    } finally {
      setIsOptimizing(false);
    }
  }, [resumeId]);

  const handleExport = useCallback(async (format: 'pdf' | 'docx' | 'html') => {
    try {
      const blob = await exportResume(resumeId, format, isOptimized);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${fileName.replace(/\.[^.]+$/, '')}_optimized.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setError(e.message || '导出失败');
    }
  }, [resumeId, fileName, isOptimized]);

  const handleReset = useCallback(() => {
    setStep('upload');
    setResumeId('');
    setFileName('');
    setAnalyzeResult(null);
    setPersona(null);
    setOptimizeResult(null);
    setIsOptimized(false);
    setError('');
    setAnalyzeStep('');
    setActiveTab('analysis');
    setShowContact(false);
  }, []);

  const handleShowHistory = useCallback(async (page = 1) => {
    setHistoryLoading(true);
    setStep('history');
    try {
      const data = await listResumes(page, 20);
      setHistoryList(data.items);
      setHistoryTotal(data.total);
      setHistoryPage(page);
    } catch (e: any) {
      setError(e.message || '加载历史记录失败');
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const handleSubscribe = useCallback(async (planType: 'monthly'|'single') => {
    setSubscribing(true);
    try {
      const data = await subscribe(planType, planType === 'single' ? resumeId : undefined);
      if (data.code === 0 || data.code === 200) {
        await getQuota().then(d => { if (d.data) setSub(d.data); });
        setShowQuota(false);
      } else {
        setError(data.detail || data.message || '订阅失败');
      }
    } catch (e: any) {
      setError(e.message || '订阅失败');
    } finally {
      setSubscribing(false);
    }
  }, []);

  const handleHistoryResume = useCallback(async (item: HistoryItem) => {
    setError('');
    // Restore state from history item
    setFileName(item.file_name);
    setStep('analyzing');
    // Run full analysis flow (upload -> parse -> analyze -> persona)
    try {
      await parseResume(item.resume_id);
      const analyzeRes = await analyzeResume(item.resume_id);
      setAnalyzeResult(analyzeRes);
      try {
        const personaRes = await generatePersona(item.resume_id);
        setPersona(personaRes);
      } catch { /* persona optional */ }
      if (item.has_optimized) {
        try {
          const optRes = await optimizeResume(item.resume_id, 'full');
          setOptimizeResult(optRes);
          setIsOptimized(true);
        } catch { /* no optimize yet */ }
      }
      setResumeId(item.resume_id);
      setStep('result');
    } catch (e: any) {
      setError(e.message || '加载简历失败');
      setStep('upload');
    }
  }, []);

  if (!loggedIn) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <div className="logo">
            <Sparkles size={24} />
            <span>简历AI</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {loggedIn && (
              <button
                onClick={() => setShowQuota(true)}
                style={{
                  background: (sub?.quota_remain ?? 0) > 0 ? '#48bb78' : '#fc8181',
                  color: 'white', border: 'none', borderRadius: 12,
                  padding: '4px 12px', fontSize: 12, cursor: 'pointer', fontWeight: 600,
                }}
              >
                剩余{sub?.quota_remain ?? 0}份
              </button>
            )}
            <button
              onClick={() => handleShowHistory()}
              style={{ background: 'none', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-light)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', padding: '4px 10px', borderRadius: '6px' }}
            >
              📋 历史记录
            </button>
            <span style={{ fontSize: '13px', color: 'var(--text-light)' }}>{userName}</span>
            <button
              onClick={handleLogout}
              title="退出登录"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-light)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', padding: '4px 8px', borderRadius: '6px' }}
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </header>

      <main className="main">
        {step === 'upload' && <UploadView onFileUpload={handleFileUpload} error={error} />}
        {step === 'analyzing' && <AnalyzingView step={analyzeStep} />}
        {step === 'history' && (
          <HistoryView
            items={historyList}
            total={historyTotal}
            page={historyPage}
            loading={historyLoading}
            isAdmin={isAdmin}
            onLoad={handleShowHistory}
            onResume={handleHistoryResume}
            onBack={() => setStep('upload')}
          />
        )}
        {step === 'result' && analyzeResult && (
          <ResultView
            analyzeResult={analyzeResult}
            persona={persona}
            optimizeResult={optimizeResult}
            isOptimized={isOptimized}
            activeTab={activeTab}
            onTabChange={setActiveTab}
            onOptimize={handleOptimize}
            onExport={handleExport}
            onReset={handleReset}
            error={error}
            isOptimizing={isOptimizing}
          />
        )}
      </main>

      {/* 订阅弹窗 */}
      {showQuota && (
        <QuotaModal
          onClose={() => setShowQuota(false)}
          onSubscribe={handleSubscribe}
        />
      )}

      <footer style={{ padding: '20px 16px 16px', fontSize: '12px', color: 'var(--text-light)', borderTop: '1px solid var(--border)', marginTop: '8px', textAlign: 'center' }}>
        <div style={{ marginBottom: '4px', fontWeight: 500, cursor: 'pointer' }} onClick={() => setShowContact(v => !v)}>
          联系我们 {showContact ? '▲' : '▼'}
        </div>
        {showContact && (
          <img src="/footer-contact.jpg" alt="联系我们" style={{ width: '80px', marginBottom: '8px', borderRadius: '6px' }} />
        )}
        <div>© 2025 海南宙元信息技术有限公司</div>
      </footer>
    </div>
  );
}

// ─── 上传视图 ───────────────────────────────────────────────

function UploadView({ onFileUpload, error }: { onFileUpload: (f: File) => void; error: string }) {
  const [dragging, setDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) { setSelectedFile(file); onFileUpload(file); }
  }, [onFileUpload]);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { setSelectedFile(file); onFileUpload(file); }
  };

  return (
    <div className="upload-view">
      <div className="hero">
        <h1>3秒看出简历问题，AI帮你改</h1>
        <p>上传简历，AI分析 + 生成职场人格画像 + 一键优化</p>
      </div>
      <div
        className={`drop-zone ${dragging ? 'dragging' : ''}`}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => document.getElementById('file-input')?.click()}
      >
        <input id="file-input" type="file" accept=".pdf,.docx,.png,.jpg,.jpeg" onChange={handleFileInput} style={{ display: 'none' }} />
        <div className="drop-icon"><Upload size={48} /></div>
        <div className="drop-text">
          <strong>点击上传或拖拽简历文件</strong>
          <span>支持 PDF、Word、图片（扫描件）</span>
        </div>
        {selectedFile && <div className="selected-file"><FileText size={16} /><span>{selectedFile.name}</span></div>}
      </div>
      {error && <div className="error-msg"><AlertCircle size={16} /><span>{error}</span></div>}
    </div>
  );
}

// ─── 分析中视图 ─────────────────────────────────────────────

function AnalyzingView({ step }: { step: string }) {
  return (
    <div className="analyzing-view">
      <div className="analyzing-card">
        <RefreshCw size={48} className="spin" />
        <h2>{step || '准备分析...'}</h2>
        <div className="loading-dots"><span /><span /><span /></div>
      </div>
    </div>
  );
}

// ─── 结果视图 ───────────────────────────────────────────────

function ResultView({
  analyzeResult, persona, optimizeResult, isOptimized, isOptimizing,
  activeTab, onTabChange, onOptimize, onExport, onReset, error,
}: {
  analyzeResult: AnalyzeResponse; persona: PersonaResponse | null;
  optimizeResult: OptimizeResponse | null; isOptimized: boolean;
  isOptimizing: boolean;
  activeTab: 'analysis' | 'persona' | 'optimize';
  onTabChange: (t: 'analysis' | 'persona' | 'optimize') => void;
  onOptimize: () => void; onExport: (f: 'pdf' | 'docx' | 'html') => void;
  onReset: () => void; error: string;
}) {
  const score = analyzeResult.score;
  return (
    <div className="result-view">
      <div className="overview-bar">
        <div className="overview-item">
          <CheckCircle size={20} color="#10B981" /><span>简历分析完成</span>
        </div>
        {persona && (
          <div className="persona-badge">
            <span className="mbti-tag">{persona.mbti_type}</span>
            <span>{persona.type_label}</span>
          </div>
        )}
      </div>
      <div className="score-cards">
        <ScoreCard label="完整度" score={score.completeness} color="#3182CE" />
        <ScoreCard label="结构化" score={score.structure} color="#805AD5" />
        <ScoreCard label="关键词" score={score.keywords} color="#DD6B20" />
      </div>
      <div className="tabs">
        {(['analysis', 'persona', 'optimize'] as const).map(t => (
          <button key={t} className={`tab ${activeTab === t ? 'active' : ''}`} onClick={() => onTabChange(t)}>
            {t === 'analysis' ? '分析报告' : t === 'persona' ? '人格画像' : '优化简历'}
          </button>
        ))}
      </div>
      <div className="tab-content">
        {activeTab === 'analysis' && <AnalysisTab result={analyzeResult} />}
        {activeTab === 'persona' && persona && <PersonaTab persona={persona} />}
        {activeTab === 'optimize' && (
          <OptimizeTab result={optimizeResult} isOptimized={isOptimized} isOptimizing={isOptimizing} onOptimize={onOptimize} onExport={onExport} />
        )}
      </div>
      {error && <div className="error-msg"><AlertCircle size={16} /><span>{error}</span></div>}
      <div className="result-actions">
        <button className="btn btn-outline" onClick={onReset}><RefreshCw size={16} />重新上传</button>
      </div>
    </div>
  );
}

function ScoreCard({ label, score, color }: { label: string; score: number; color: string }) {
  const percent = Math.round(score * 10);
  return (
    <div className="score-card">
      <div className="score-ring" style={{ '--color': color, '--percent': `${percent}%` } as React.CSSProperties}>
        <span className="score-num">{score.toFixed(1)}</span>
      </div>
      <span className="score-label">{label}</span>
    </div>
  );
}

function AnalysisTab({ result }: { result: AnalyzeResponse }) {
  return (
    <div className="analysis-tab">
      <div className="info-row">
        <span className="info-name">{result.basic_info.name}</span>
        <span className="info-item">{result.basic_info.education}</span>
        <span className="info-item">{result.basic_info.experience_years}年经验</span>
        {result.basic_info.current_industry && <span className="info-item">{result.basic_info.current_industry}</span>}
      </div>
      <div className="section-grid">
        <div className="section strength-section">
          <h3><span className="dot green" />优势亮点</h3>
          {result.strengths.map((s, i) => (
            <div key={i} className="item-card strength"><strong>{s.title}</strong><p>{s.evidence}</p></div>
          ))}
        </div>
        <div className="section weakness-section">
          <h3><span className="dot orange" />待改进点</h3>
          {result.weaknesses.map((w, i) => (
            <div key={i} className="item-card weakness"><strong>{w.title}</strong><p>{w.detail}</p><span className="risk-tag">风险：{w.risk}</span></div>
          ))}
        </div>
      </div>
      {result.optimization_suggestions.length > 0 && (
        <div className="section suggestions-section">
          <h3><span className="dot blue" />优化建议</h3>
          {result.optimization_suggestions.map((s, i) => (
            <div key={i} className="item-card suggestion">
              <div className="suggestion-section">{s.section}</div>
              <div className="suggestion-current">现状：{s.current}</div>
              <div className="suggestion-tip">建议：{s.suggestion}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PersonaTab({ persona }: { persona: PersonaResponse }) {
  const dims = persona.dimensions;
  return (
    <div className="persona-tab">
      <div className="mbti-header">
        <div className="mbti-main-tag">{persona.mbti_type}</div>
        <div className="mbti-label">{persona.type_label}</div>
        <p className="mbti-desc">{persona.type_description}</p>
      </div>
      <div className="dimension-cards">
        {[
          { key: 'communication_style', label: '沟通风格', icon: '💬', dim: dims.communication_style },
          { key: 'decision_mode', label: '决策模式', icon: '⚖️', dim: dims.decision_mode },
          { key: 'collaboration', label: '协作方式', icon: '🤝', dim: dims.collaboration },
          { key: 'motivation', label: '内驱力', icon: '🚀', dim: dims.motivation },
        ].map(item => (
          <div key={item.key} className="dimension-card">
            <div className="dim-header">
              <span className="dim-icon">{item.icon}</span>
              <span className="dim-label">{item.label}</span>
              <span className="dim-value">{item.dim.value}</span>
            </div>
            <p className="dim-detail">{item.dim.detail}</p>
          </div>
        ))}
      </div>
      <div className="persona-tips">
        <div className="tip-section">
          <h4>💪 优势</h4>
          <div className="tip-tags">
            {persona.strengths.map((s, i) => <span key={i} className="tag tag-green">{s}</span>)}
          </div>
        </div>
        <div className="tip-section">
          <h4>📌 局限</h4>
          <div className="tip-tags">
            {persona.weaknesses.map((w, i) => <span key={i} className="tag tag-orange">{w}</span>)}
          </div>
        </div>
      </div>
    </div>
  );
}

function OptimizeTab({
  result, isOptimized, isOptimizing, onOptimize, onExport,
}: {
  result: OptimizeResponse | null; isOptimized: boolean; isOptimizing: boolean;
  onOptimize: () => void; onExport: (f: 'pdf' | 'docx' | 'html') => void;
}) {
  if (isOptimizing) {
    return (
      <div className="optimize-loading">
        <div className="optimize-loading-spinner" />
        <h3>AI 正在优化简历...</h3>
        <p>预计需要 15-25 秒，请耐心等待</p>
      </div>
    );
  }
  if (!isOptimized || !result) {
    return (
      <div className="optimize-empty">
        <div className="optimize-empty-icon"><Sparkles size={36} /></div>
        <h2>AI 优化简历</h2>
        <p className="optimize-empty-desc">自动改写、量化表达、结构调整，让你的简历更有竞争力</p>
        <button className="btn btn-primary btn-lg" onClick={onOptimize}>
          <Sparkles size={18} />一键 AI 优化
        </button>
      </div>
    );
  }

  // 计算优化统计
  const improvedCount = result.changes.filter(c => c.type === 'improvement' || c.type === 'added').length;
  const quantifiedCount = result.changes.filter(c => c.type === 'quantified' || c.type === 'quantify').length;

  return (
    <div className="optimize-tab">
      {/* 摘要卡 */}
      <div className="opt-summary-card">
        <div className="opt-summary-left">
          <div className="opt-summary-icon">✨</div>
          <div className="opt-summary-info">
            <div className="opt-summary-title">简历已优化</div>
            <div className="opt-summary-sub">{result.summary}</div>
          </div>
        </div>
        <div className="opt-summary-stats">
          {improvedCount > 0 && (
            <div className="opt-stat">
              <span className="opt-stat-num">{improvedCount}</span>
              <span className="opt-stat-label">处优化</span>
            </div>
          )}
          {quantifiedCount > 0 && (
            <div className="opt-stat">
              <span className="opt-stat-num">{quantifiedCount}</span>
              <span className="opt-stat-label">处量化</span>
            </div>
          )}
          <div className="opt-stat">
            <span className="opt-stat-num">{result.changes.length}</span>
            <span className="opt-stat-label">处改动</span>
          </div>
        </div>
      </div>

      {/* 操作区 */}
      <div className="opt-actions">
        <button className="btn btn-primary opt-btn-pdf" onClick={() => onExport('pdf')}>
          <Download size={15} />导出 PDF
        </button>
        <button className="btn btn-outline opt-btn-docx" onClick={() => onExport('docx')}>
          <Download size={15} />导出 Word
        </button>
        <button className="btn btn-outline opt-btn-html" onClick={() => onExport('html')}>
          <Download size={15} />导出 HTML
        </button>
        <button className="btn btn-ghost opt-btn-refresh" onClick={onOptimize}>
          <RefreshCw size={14} />重新优化
        </button>
      </div>

      {/* 改动明细 */}
      {result.changes.length > 0 && (
        <div className="opt-section">
          <div className="opt-section-header">
            <span className="opt-section-title">📝 优化明细</span>
            <span className="opt-section-count">{result.changes.length} 处</span>
          </div>
          <div className="opt-changes">
            {result.changes.map((c, i) => {
              const typeLabel =
                c.type === 'improvement' || c.type === 'added' ? '优化' :
                c.type === 'quantified' || c.type === 'quantify' ? '量化' :
                c.type === 'removed' ? '删除' : '改写';
              const typeColor =
                c.type === 'improvement' || c.type === 'added' ? 'green' :
                c.type === 'quantified' || c.type === 'quantify' ? 'blue' :
                c.type === 'removed' ? 'red' : 'purple';
              return (
                <div key={i} className="opt-change-card" style={{ marginBottom: '12px', border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden', background: '#fff', transition: 'box-shadow 0.15s' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc', flexWrap: 'wrap' }}>
                    <span style={{ background: typeColor === 'green' ? '#dcfce7' : typeColor === 'blue' ? '#dbeafe' : typeColor === 'red' ? '#fee2e2' : '#f3e8ff', color: typeColor === 'green' ? '#15803d' : typeColor === 'blue' ? '#1d4ed8' : typeColor === 'red' ? '#dc2626' : '#7c3aed', borderRadius: '6px', padding: '3px 9px', fontSize: '12px', fontWeight: 700 }}>{typeLabel}</span>
                    {c.section && <span style={{ color: '#718096', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '4px', padding: '2px 7px', fontSize: '11px' }}>{c.section}</span>}
                  </div>
                  <div className="opt-change-body">
                    <div className="opt-col-group opt-col-orig">
                      <div className="opt-col-label">原文</div>
                      <div className="opt-col-text">{c.before}</div>
                    </div>
                    <div className="opt-col-arrow">→</div>
                    <div className="opt-col-group opt-col-new">
                      <div className="opt-col-label">优化后</div>
                      <div className="opt-col-text">{c.after}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 预览区 */}
      <div className="opt-section">
        <div className="opt-section-header">
          <span className="opt-section-title">📄 优化后简历</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="opt-copy-btn"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(result.optimized_text);
                  const btn = document.activeElement as HTMLButtonElement | null;
                  if (btn) {
                    btn.textContent = '✅ 已复制';
                    setTimeout(() => { btn.textContent = '📋 复制'; }, 1500);
                  }
                } catch (e) {
                  const ta = document.createElement('textarea');
                  ta.value = result.optimized_text;
                  ta.style.position = 'fixed';
                  ta.style.opacity = '0';
                  document.body.appendChild(ta);
                  ta.select();
                  document.execCommand('copy');
                  document.body.removeChild(ta);
                  const btn = document.activeElement as HTMLButtonElement | null;
                  if (btn) {
                    btn.textContent = '✅ 已复制';
                    setTimeout(() => { btn.textContent = '📋 复制'; }, 1500);
                  }
                }
              }}
              title="复制简历文本"
            >
              📋 复制
            </button>
            <button
              className="opt-copy-btn"
              style={{ background: '#f0f9ff', color: '#0369a1', border: '1px solid #bae6fd' }}
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              title="返回简历页顶部"
            >
              ↑ 返回简历页
            </button>
          </div>
        </div>
        <div className="opt-preview">
          <div className="resume-preview-html">
            <div className="rph-name">{result.name || '优化后简历'}</div>
            <div className="rph-meta">优化后简历 · 简历AI助手</div>
            <div className="rph-divider" />
            <div className="rph-content" dangerouslySetInnerHTML={{ __html: formatResumeHtml(result.optimized_text) }} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── 历史记录页面 ───────────────────────────────────────────

function HistoryView({
  items,
  total,
  page,
  loading,
  isAdmin,
  onLoad,
  onResume,
  onBack,
}: {
  items: HistoryItem[];
  total: number;
  page: number;
  loading: boolean;
  isAdmin: boolean;
  onLoad: (p: number) => void;
  onResume: (item: HistoryItem) => void;
  onBack: () => void;
}) {
  const pageSize = 20;
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="history-view">
      <div className="history-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={onBack}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)', fontSize: '14px', padding: '4px 8px', borderRadius: '6px' }}
          >
            ← 返回
          </button>
          <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 600 }}>📋 简历历史记录</h2>
          {isAdmin && <span style={{ background: '#fee2e2', color: '#dc2626', borderRadius: '4px', padding: '2px 8px', fontSize: '12px', fontWeight: 600 }}>管理员视图</span>}
        </div>
        <span style={{ fontSize: '13px', color: 'var(--text-light)' }}>共 {total} 条记录</span>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-light)' }}>
          加载中...
        </div>
      ) : items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-light)' }}>
          暂无历史记录
        </div>
      ) : (
        <>
          <div className="history-list">
            {items.map(item => (
              <div key={item.resume_id} className="history-item">
                <div className="history-item-left">
                  <div className="history-item-icon">📄</div>
                  <div className="history-item-info">
                    <div className="history-item-name">{item.file_name}</div>
                    <div className="history-item-meta">
                      {isAdmin && item.user_name && (
                        <span className="history-user-tag">👤 {item.user_name}</span>
                      )}
                      <span>{(() => {
                        // 加 +08:00 明确告知浏览器这是北京时间，再用 Asia/Shanghai 时区格式化
                        return new Date(item.created_at + '+08:00').toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
                      })()}</span>
                      <span className={`history-status history-status-${item.status}`}>
                        {item.status === 'optimized' ? '✅ 已优化' :
                         item.status === 'analyzed' ? '🔍 已分析' :
                         item.status === 'parsed' ? '📝 已解析' : '⏳ 待处理'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="history-item-tags">
                  {item.has_text && <span className="history-tag">📝 文本</span>}
                  {item.has_optimized && <span className="history-tag history-tag-green">✨ 优化</span>}
                  {item.has_persona && <span className="history-tag history-tag-purple">🧠 人格</span>}
                </div>
                <button
                  className="btn btn-primary"
                  style={{ padding: '6px 16px', fontSize: '13px', borderRadius: '8px' }}
                  onClick={() => onResume(item)}
                >
                  查看详情 →
                </button>
              </div>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="history-pagination">
              <button
                className="btn btn-outline"
                disabled={page <= 1}
                onClick={() => onLoad(page - 1)}
              >
                ← 上一页
              </button>
              <span style={{ fontSize: '13px', color: 'var(--text-light)' }}>
                第 {page} / {totalPages} 页
              </span>
              <button
                className="btn btn-outline"
                disabled={page >= totalPages}
                onClick={() => onLoad(page + 1)}
              >
                下一页 →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── 订阅弹窗（独立组件，避免 HistoryView 作用域问题）─────────────

function QuotaModal({ onClose, onSubscribe }: { onClose: () => void; onSubscribe: (plan: 'monthly' | 'single') => void }) {
  return (
    <div className="quota-overlay" onClick={onClose}>
      <div className="quota-modal" onClick={e => e.stopPropagation()}>
        <button className="quota-close" onClick={onClose} style={{ position: 'absolute', top: 12, right: 16, background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>×</button>
        <h3 style={{ margin: '0 0 20px', fontSize: 18, textAlign: 'center', fontWeight: 700 }}>
          提升分析额度
        </h3>
        <div className="quota-plan" onClick={() => onSubscribe('monthly')}>
          <div className="quota-plan-name">月度订阅</div>
          <div className="quota-plan-price">¥299<span style={{ fontSize: 13, fontWeight: 400, color: '#666' }}>/月</span></div>
          <div className="quota-plan-desc">50份简历分析 / 30天有效 / 适合持续优化</div>
        </div>
        <div className="quota-plan" style={{ border: '1px solid #d1d5db', background: '#fff' }} onClick={() => onSubscribe('single')}>
          <div className="quota-plan-name">单次购买</div>
          <div className="quota-plan-price">¥19.9<span style={{ fontSize: 13, fontWeight: 400, color: '#666' }}>/份</span></div>
          <div className="quota-plan-desc">1份简历分析 / 购买后永久有效</div>
        </div>
        <p style={{ marginTop: 16, fontSize: 12, color: '#999', textAlign: 'center' }}>
          点击套餐即表示同意 <span style={{ color: '#6366f1', cursor: 'pointer' }}>《订阅协议》</span>
        </p>
      </div>
    </div>
  );
}

export default App;
