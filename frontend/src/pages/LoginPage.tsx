import { useState } from 'react';
import { login as loginApi, register as registerApi } from '../services/api';

const USER_AGREEMENT = `**用户服务协议**

1. 服务说明
   简历AI助手是由海南宙元信息技术有限公司（以下简称"本公司"）提供的在线简历分析、优化工具。我们通过人工智能技术帮助用户分析、改进简历内容。

2. 用户账户
   - 用户需保证账户信息的真实性
   - 用户账户仅限本人使用，不得转让或共享
   - 用户有责任保护账户安全，因个人保管不善导致的后果由用户自行承担

3. 服务使用规范
   - 用户上传的简历内容必须真实、准确
   - 禁止利用本服务从事任何违法活动
   - 禁止对本服务进行逆向工程、破解或非法获取数据

4. 知识产权
   - 用户保留上传简历内容的知识产权
   - 本公司保留算法和技术的所有权
   - 用户不得删除或篡改服务中的版权信息

5. 服务变更与终止
   - 本公司保留随时修改或中断服务的权利
   - 如用户违反本协议，本公司有权终止其使用资格`;

const PRIVACY_POLICY = `**隐私保护协议**

1. 信息收集
   - 简历解析服务需要用户主动上传简历文件
   - 我们收集的信息仅包括：简历文件、AI分析结果、操作日志
   - 不收集与简历解析无关的个人信息

2. 简历内容的处理
   - 简历上传后，系统会在服务器端进行解析和分析
   - 解析完成后，简历原文件将在服务器端保留7天后自动删除
   - AI分析结果保存在服务器用于生成报告

3. 数据保护
   - 您的简历内容仅用于为您提供简历分析服务
   - 本公司不会将您的简历内容出售、转让给任何第三方
   - 未经您同意，不会将您的简历内容用于任何其他目的

4. 隐私保护措施
   - 简历数据传输采用加密通道（HTTPS）
   - 服务器端实施访问控制，防止未授权访问
   - 员工访问数据需经过授权审批

5. 您的权利
   - 您有权要求删除您的简历数据
   - 您有权撤回同意并注销账户
   - 如发现数据处理侵害您的权益，可联系我们进行申诉

6. 联系方式
   如对隐私保护有任何疑问，请联系：海南宙元信息技术有限公司`;

interface Props {
  onLogin: (username: string, name: string) => void;
}

export default function LoginPage({ onLogin }: Props) {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [showAgreement, setShowAgreement] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('请输入用户名和密码');
      return;
    }
    if (isRegister) {
      if (!name.trim()) {
        setError('请输入姓名');
        return;
      }
      if (password !== confirmPassword) {
        setError('两次输入的密码不一致');
        return;
      }
      if (password.length < 6) {
        setError('密码长度不能少于6位');
        return;
      }
      if (!agreed) {
        setError('请先阅读并同意《用户服务协议》和《隐私保护协议》');
        return;
      }
    }
    if (!agreed && !isRegister) {
      // Login doesn't require agreement for now
    }
    setError('');
    setLoading(true);
    try {
      if (isRegister) {
        const data = await registerApi(username, password, name);
        localStorage.setItem('resume_token', data.token);
        localStorage.setItem('resume_user', JSON.stringify({ username: data.username, name: data.name }));
        onLogin(data.username, data.name);
      } else {
        const data = await loginApi(username, password);
        localStorage.setItem('resume_token', data.token);
        localStorage.setItem('resume_user', JSON.stringify({ username: data.username, name: data.name }));
        onLogin(data.username, data.name);
      }
    } catch (err: any) {
      setError(err.message || (isRegister ? '注册失败' : '登录失败，请检查用户名和密码'));
    } finally {
      setLoading(false);
    }
  };

  const switchMode = () => {
    setIsRegister(v => !v);
    setError('');
    setUsername('');
    setPassword('');
    setName('');
    setConfirmPassword('');
    setAgreed(false);
  };

  const modalStyle: React.CSSProperties = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000, padding: '16px',
  };
  const cardStyle: React.CSSProperties = {
    background: '#fff', borderRadius: '16px', padding: '32px 24px',
    width: '100%', maxWidth: '480px', maxHeight: '90vh', overflow: 'auto',
    boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
  };

  return (
    <div style={{
      minHeight: '100vh', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
    }}>
      {/* 登录/注册表单 */}
      <div style={cardStyle}>
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <div style={{
            width: '56px', height: '56px', background: 'linear-gradient(135deg, #667eea, #764ba2)',
            borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 12px', fontSize: '28px',
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              <circle cx="12" cy="7" r="4"/>
            </svg>
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, margin: '0 0 4px', color: '#1a1a2e' }}>
            {isRegister ? '注册账号' : '简历AI助手'}
          </h1>
          <p style={{ fontSize: '13px', color: '#888', margin: 0 }}>
            {isRegister ? '创建账户，开始智能简历分析' : '登录后开始智能简历分析'}
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          {isRegister && (
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#333', display: 'block', marginBottom: '6px' }}>
                姓名
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="请输入真实姓名"
                style={{
                  width: '100%', padding: '11px 14px', border: '1.5px solid #e5e7eb',
                  borderRadius: '10px', fontSize: '14px', outline: 'none', boxSizing: 'border-box',
                  transition: 'border-color 0.2s',
                }}
                onFocus={e => (e.target.style.borderColor = '#667eea')}
                onBlur={e => (e.target.style.borderColor = '#e5e7eb')}
              />
            </div>
          )}

          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '13px', fontWeight: 600, color: '#333', display: 'block', marginBottom: '6px' }}>
              用户名
            </label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="请输入用户名"
              style={{
                width: '100%', padding: '11px 14px', border: '1.5px solid #e5e7eb',
                borderRadius: '10px', fontSize: '14px', outline: 'none', boxSizing: 'border-box',
                transition: 'border-color 0.2s',
              }}
              onFocus={e => (e.target.style.borderColor = '#667eea')}
              onBlur={e => (e.target.style.borderColor = '#e5e7eb')}
            />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '13px', fontWeight: 600, color: '#333', display: 'block', marginBottom: '6px' }}>
              密码
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder={isRegister ? '密码至少6位' : '请输入密码'}
              style={{
                width: '100%', padding: '11px 14px', border: '1.5px solid #e5e7eb',
                borderRadius: '10px', fontSize: '14px', outline: 'none', boxSizing: 'border-box',
                transition: 'border-color 0.2s',
              }}
              onFocus={e => (e.target.style.borderColor = '#667eea')}
              onBlur={e => (e.target.style.borderColor = '#e5e7eb')}
            />
          </div>

          {isRegister && (
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#333', display: 'block', marginBottom: '6px' }}>
                确认密码
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="请再次输入密码"
                style={{
                  width: '100%', padding: '11px 14px', border: '1.5px solid #e5e7eb',
                  borderRadius: '10px', fontSize: '14px', outline: 'none', boxSizing: 'border-box',
                  transition: 'border-color 0.2s',
                }}
                onFocus={e => (e.target.style.borderColor = '#667eea')}
                onBlur={e => (e.target.style.borderColor = '#e5e7eb')}
              />
            </div>
          )}

          {/* 协议勾选 - 仅注册时显示 */}
          {isRegister && (
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={e => setAgreed(e.target.checked)}
                  style={{ marginTop: '3px', accentColor: '#667eea', width: '16px', height: '16px', flexShrink: 0 }}
                />
                <span style={{ fontSize: '12px', color: '#555', lineHeight: 1.5 }}>
                  我已阅读并同意
                  <button type="button" onClick={() => setShowAgreement(true)} style={{ color: '#667eea', background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', padding: 0, textDecoration: 'underline' }}>《用户服务协议》</button>
                  和
                  <button type="button" onClick={() => setShowPrivacy(true)} style={{ color: '#667eea', background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', padding: 0, textDecoration: 'underline' }}>《隐私保护协议》</button>
                </span>
              </label>
            </div>
          )}

          {error && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 12px', color: '#dc2626', fontSize: '13px', marginBottom: '16px' }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '12px', background: loading ? '#a5a5a5' : 'linear-gradient(135deg, #667eea, #764ba2)',
              color: '#fff', border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer', transition: 'opacity 0.2s',
            }}
          >
            {loading ? (isRegister ? '注册中...' : '登录中...') : (isRegister ? '注册' : '登录')}
          </button>

          <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '13px', color: '#666' }}>
            {isRegister ? '已有账号？' : '还没有账号？'}
            <button
              type="button"
              onClick={switchMode}
              style={{
                color: '#667eea', background: 'none', border: 'none', cursor: 'pointer',
                fontSize: '13px', fontWeight: 600, padding: '0 4px', textDecoration: 'underline',
              }}
            >
              {isRegister ? '立即登录' : '立即注册'}
            </button>
          </div>

          {!isRegister && (
            <div style={{ textAlign: 'center', marginTop: '12px', fontSize: '12px', color: '#aaa' }}>
              试用账号: admin / resume2025
            </div>
          )}
        </form>
      </div>

      {/* 用户协议弹窗 */}
      {showAgreement && (
        <div style={modalStyle} onClick={() => setShowAgreement(false)}>
          <div style={cardStyle} onClick={e => e.stopPropagation()}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px', color: '#1a1a2e' }}>用户服务协议</h2>
            <div style={{ fontSize: '13px', color: '#555', lineHeight: 1.8, whiteSpace: 'pre-wrap', maxHeight: '60vh', overflow: 'auto', marginBottom: '20px' }}>
              {USER_AGREEMENT}
            </div>
            <button
              onClick={() => setShowAgreement(false)}
              style={{ width: '100%', padding: '11px', background: '#667eea', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}
            >
              我已知晓
            </button>
          </div>
        </div>
      )}

      {/* 隐私协议弹窗 */}
      {showPrivacy && (
        <div style={modalStyle} onClick={() => setShowPrivacy(false)}>
          <div style={cardStyle} onClick={e => e.stopPropagation()}>
            <h2 style={{ fontSize: '18px', fontWeight: 700, marginBottom: '16px', color: '#1a1a2e' }}>隐私保护协议</h2>
            <div style={{ fontSize: '13px', color: '#555', lineHeight: 1.8, whiteSpace: 'pre-wrap', maxHeight: '60vh', overflow: 'auto', marginBottom: '20px' }}>
              {PRIVACY_POLICY}
            </div>
            <button
              onClick={() => setShowPrivacy(false)}
              style={{ width: '100%', padding: '11px', background: '#667eea', color: '#fff', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}
            >
              我已知晓
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
