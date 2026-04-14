import { useState, useEffect } from 'react';
import {
  CheckCircleIcon,
  XCircleIcon,
  ArrowPathIcon,
  CommandLineIcon,
  Cog6ToothIcon,
  KeyIcon,
  EyeIcon,
} from '@heroicons/react/24/outline';
import {
  readConfigFile,
  checkCommand,
  getHermesStatus,
} from '../api/hermes';

interface SystemCheck {
  name: string;
  installed: boolean;
  version?: string;
  checking: boolean;
}

interface WizardStep {
  id: number;
  title: string;
  description: string;
  icon: React.ReactNode;
}

const steps: WizardStep[] = [
  {
    id: 1,
    title: '环境检查',
    description: '查看当前依赖环境',
    icon: <CommandLineIcon className="w-6 h-6" />,
  },
  {
    id: 2,
    title: 'Hermes 状态',
    description: '查看 hermes-agent 状态',
    icon: <ArrowPathIcon className="w-6 h-6" />,
  },
  {
    id: 3,
    title: '当前配置',
    description: '查看已配置的模型和渠道',
    icon: <KeyIcon className="w-6 h-6" />,
  },
  {
    id: 4,
    title: '完成',
    description: '开始使用 Hermes Desktop',
    icon: <CheckCircleIcon className="w-6 h-6" />,
  },
];

export default function InstallWizard({ onComplete }: { onComplete: () => void }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [checks, setChecks] = useState<SystemCheck[]>([
    { name: 'Git', installed: false, checking: true },
    { name: 'Python', installed: false, checking: true },
    { name: 'Node.js', installed: false, checking: true },
  ]);
  const [hermesInstalled, setHermesInstalled] = useState(false);
  const [hermesVersion, setHermesVersion] = useState<string | null>(null);
  const [hermesPath, setHermesPath] = useState<string | null>(null);
  const [configContent, setConfigContent] = useState<string>('');
  const [envContent, setEnvContent] = useState<string>('');

  useEffect(() => {
    checkAll();
  }, []);

  const checkAll = async () => {
    // Check system deps via Rust backend using the login-shell environment.
    const tools = [
      { name: 'Git', command: 'git' },
      { name: 'Python', command: 'python3' },
      { name: 'Node.js', command: 'node' },
    ];

    for (let i = 0; i < tools.length; i++) {
      const tool = tools[i];
      try {
        const result = await checkCommand(tool.command);

        setChecks(prev => {
          const updated = [...prev];
          updated[i] = { 
            ...updated[i], 
            installed: result.installed, 
            version: result.version ? `v${result.version}` : undefined, 
            checking: false 
          };
          return updated;
        });
      } catch (error) {
        console.error(`Error checking ${tool.name}:`, error);
        setChecks(prev => {
          const updated = [...prev];
          updated[i] = { ...updated[i], installed: false, version: undefined, checking: false };
          return updated;
        });
      }
    }

    // Check hermes via backend to avoid frontend shell scope / PATH differences.
    try {
      const status = await getHermesStatus();
      setHermesInstalled(status.installed);
      setHermesVersion(status.version ? `v${status.version}` : null);
      setHermesPath(status.path);
    } catch (error) {
      console.error('Error checking hermes:', error);
      setHermesInstalled(false);
      setHermesVersion(null);
      setHermesPath(null);
    }

    // Read existing config
    try {
      const config = await readConfigFile('config.yaml');
      setConfigContent(config);
    } catch {}

    try {
      const env = await readConfigFile('.env');
      // Mask sensitive values
      const masked = env.split('\n').map(line => {
        if (line.includes('KEY=') || line.includes('SECRET=') || line.includes('TOKEN=')) {
          const [key] = line.split('=');
          return `${key}=••••••••`;
        }
        return line;
      }).join('\n');
      setEnvContent(masked);
    } catch {}
  };



  const renderStep1 = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold" style={{ color: 'var(--color-fg)' }}>
        系统环境检查
      </h3>
      <p className="text-sm" style={{ color: 'var(--color-fg-secondary)' }}>
        Hermes Desktop 需要以下依赖才能正常运行
      </p>
      
      <div className="space-y-3">
        {checks.map((check) => (
          <div key={check.name} className="card flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              {check.checking ? (
                <ArrowPathIcon className="w-5 h-5 animate-spin" style={{ color: 'var(--color-accent)' }} />
              ) : check.installed ? (
                <CheckCircleIcon className="w-5 h-5" style={{ color: 'var(--color-success)' }} />
              ) : (
                <XCircleIcon className="w-5 h-5" style={{ color: 'var(--color-error)' }} />
              )}
              <div>
                <p className="font-medium" style={{ color: 'var(--color-fg)' }}>{check.name}</p>
                {check.version && (
                  <p className="text-xs" style={{ color: 'var(--color-fg-secondary)' }}>{check.version}</p>
                )}
              </div>
            </div>
            {!check.installed && !check.checking && (
              <span className="badge badge-error">未安装</span>
            )}
            {check.installed && (
              <span className="badge badge-success">已安装</span>
            )}
          </div>
        ))}
      </div>
      
      <div className="flex gap-3 pt-4">
        <button onClick={checkAll} className="btn-secondary flex items-center gap-2">
          <ArrowPathIcon className="w-4 h-4" />
          重新检查
        </button>
        <button onClick={() => setCurrentStep(2)} className="btn-primary flex-1">
          下一步
        </button>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold" style={{ color: 'var(--color-fg)' }}>
        Hermes Agent 状态
      </h3>
      
      <div className="card p-6">
        <div className="flex items-center gap-4 mb-4">
          {hermesInstalled ? (
            <CheckCircleIcon className="w-12 h-12" style={{ color: 'var(--color-success)' }} />
          ) : (
            <XCircleIcon className="w-12 h-12" style={{ color: 'var(--color-error)' }} />
          )}
          <div>
            <p className="text-lg font-semibold" style={{ color: 'var(--color-fg)' }}>
              hermes-agent
            </p>
            {hermesVersion && (
              <p className="text-sm" style={{ color: 'var(--color-fg-secondary)' }}>
                {hermesVersion}
              </p>
            )}
            {!hermesInstalled && (
              <p className="text-sm" style={{ color: 'var(--color-error)' }}>
                未检测到 hermes-agent，当前检测使用后端登录 shell 环境
              </p>
            )}
          </div>
        </div>

        {hermesInstalled && (
          <div className="space-y-2 pt-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
            <div className="flex items-center justify-between">
              <span className="text-sm" style={{ color: 'var(--color-fg-secondary)' }}>配置目录</span>
              <span className="text-sm font-mono" style={{ color: 'var(--color-fg)' }}>~/.hermes/</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm" style={{ color: 'var(--color-fg-secondary)' }}>可执行路径</span>
              <span className="text-sm font-mono text-right break-all" style={{ color: 'var(--color-fg)' }}>
                {hermesPath || '未找到'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm" style={{ color: 'var(--color-fg-secondary)' }}>配置文件</span>
              <span className="text-sm" style={{ color: configContent ? 'var(--color-success)' : 'var(--color-warning)' }}>
                {configContent ? '✓ 已配置' : '未配置'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm" style={{ color: 'var(--color-fg-secondary)' }}>环境变量</span>
              <span className="text-sm" style={{ color: envContent ? 'var(--color-success)' : 'var(--color-warning)' }}>
                {envContent ? '✓ 已配置' : '未配置'}
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-3 pt-4">
        <button onClick={() => setCurrentStep(1)} className="btn-secondary">
          上一步
        </button>
        <button onClick={() => setCurrentStep(3)} className="btn-primary flex-1">
          下一步
        </button>
      </div>
    </div>
  );

  const renderStep3 = () => {
    // Parse config for model info
    let provider = '';
    let model = '';
    if (configContent) {
      const providerMatch = configContent.match(/provider:\s*(\S+)/);
      const modelMatch = configContent.match(/default:\s*(\S+)/);
      if (providerMatch) provider = providerMatch[1];
      if (modelMatch) model = modelMatch[1];
    }

    // Parse env for channels
    const channels: string[] = [];
    if (envContent) {
      if (envContent.includes('FEISHU_APP_ID')) channels.push('飞书');
      if (envContent.includes('WEIXIN_ACCOUNT_ID')) channels.push('微信');
      if (envContent.includes('TELEGRAM_BOT_TOKEN')) channels.push('Telegram');
      if (envContent.includes('DISCORD_BOT_TOKEN')) channels.push('Discord');
      if (envContent.includes('SLACK_BOT_TOKEN')) channels.push('Slack');
      if (envContent.includes('WHATSAPP')) channels.push('WhatsApp');
    }

    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold" style={{ color: 'var(--color-fg)' }}>
          当前配置
        </h3>
        <p className="text-sm" style={{ color: 'var(--color-fg-secondary)' }}>
          以下是你当前的 hermes-agent 配置
        </p>

        {/* Model Config */}
        <div className="card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <KeyIcon className="w-5 h-5" style={{ color: 'var(--color-accent)' }} />
            <h4 className="font-medium" style={{ color: 'var(--color-fg)' }}>AI 模型</h4>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm" style={{ color: 'var(--color-fg-secondary)' }}>提供商</span>
            <span className="text-sm font-medium" style={{ color: 'var(--color-fg)' }}>
              {provider || '未配置'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm" style={{ color: 'var(--color-fg-secondary)' }}>模型</span>
            <span className="text-sm font-medium" style={{ color: 'var(--color-fg)' }}>
              {model || '未配置'}
            </span>
          </div>
        </div>

        {/* Channels */}
        <div className="card p-4 space-y-3">
          <div className="flex items-center gap-2">
            <EyeIcon className="w-5 h-5" style={{ color: 'var(--color-accent)' }} />
            <h4 className="font-medium" style={{ color: 'var(--color-fg)' }}>消息渠道</h4>
          </div>
          {channels.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {channels.map(ch => (
                <span key={ch} className="badge badge-success">{ch}</span>
              ))}
            </div>
          ) : (
            <p className="text-sm" style={{ color: 'var(--color-fg-secondary)' }}>
              暂无配置的消息渠道
            </p>
          )}
        </div>

        {/* Raw Config Preview */}
        {configContent && (
          <details className="card p-4">
            <summary className="cursor-pointer text-sm font-medium" style={{ color: 'var(--color-fg-secondary)' }}>
              查看完整配置
            </summary>
            <pre className="mt-3 text-xs font-mono p-3 rounded-lg overflow-auto max-h-48" 
                 style={{ backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-fg)' }}>
              {configContent}
            </pre>
          </details>
        )}

        <div className="flex gap-3 pt-4">
          <button onClick={() => setCurrentStep(2)} className="btn-secondary">
            上一步
          </button>
          <button onClick={() => setCurrentStep(4)} className="btn-primary flex-1">
            确认并继续
          </button>
        </div>
      </div>
    );
  };

  const renderStep4 = () => (
    <div className="space-y-4 text-center">
      <div className="w-20 h-20 rounded-full mx-auto flex items-center justify-center" style={{ backgroundColor: 'var(--color-accent-muted)' }}>
        <CheckCircleIcon className="w-10 h-10" style={{ color: 'var(--color-success)' }} />
      </div>
      
      <h3 className="text-xl font-semibold" style={{ color: 'var(--color-fg)' }}>
        检查完成！
      </h3>
      <p className="text-sm" style={{ color: 'var(--color-fg-secondary)' }}>
        Hermes Desktop 已准备就绪
      </p>
      
      <button onClick={onComplete} className="btn-primary w-full mt-4">
        <Cog6ToothIcon className="w-4 h-4 inline mr-2" />
        开始使用
      </button>
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: 'var(--color-bg)' }}>
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
        <div className="text-4xl mb-3">🥂</div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--color-fg)' }}>
            Hermes Desktop
        </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-fg-secondary)' }}>
            欢迎使用，让我们检查一下环境
          </p>
        </div>
        
        {/* Progress Steps */}
        <div className="flex items-center justify-between mb-8">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors`}
                style={{
                  backgroundColor: currentStep >= step.id ? 'var(--color-accent)' : 'var(--color-bg-tertiary)',
                  color: currentStep >= step.id ? 'var(--color-bg)' : 'var(--color-fg-tertiary)',
                }}
              >
                {currentStep > step.id ? (
                  <CheckCircleIcon className="w-5 h-5" />
                ) : (
                  step.icon
                )}
              </div>
              {index < steps.length - 1 && (
                <div
                  className="w-12 h-0.5 mx-2"
                  style={{
                    backgroundColor: currentStep > step.id ? 'var(--color-accent)' : 'var(--color-border)',
                  }}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <div className="card p-6">
          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
          {currentStep === 3 && renderStep3()}
          {currentStep === 4 && renderStep4()}
        </div>
      </div>
    </div>
  );
}
