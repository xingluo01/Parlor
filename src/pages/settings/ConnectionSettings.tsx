import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { generateUUID } from '../../utils/uuid';
import {
  Plus,
  Edit3,
  Trash2,
  CheckCircle,
  XCircle,
  Loader2,
} from 'lucide-react';
import { Button, Input, Modal, ConfirmDialog } from '../../components/ui';
import { connectionOps } from '../../db';
import { APIClient, DEFAULT_MODELS, fetchAvailableModels } from '../../services/api';
import type { ConnectionProfile, APIProvider, Preset } from '../../types';

// Connection Settings Component
export function ConnectionSettings({
  connections,
  onRefresh,
}: {
  connections: ConnectionProfile[];
  onRefresh: () => void;
}) {
  const { t } = useTranslation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingConnection, setEditingConnection] = useState<ConnectionProfile | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white font-serif tracking-tight">{t('settings.connection.title')}</h2>
        <Button
          size="sm"
          onClick={() => {
            setEditingConnection(null);
            setIsModalOpen(true);
          }}
        >
          <Plus className="w-4 h-4" />
          {t('settings.connection.addConnection')}
        </Button>
      </div>

      {connections.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-gray-500 mb-4">
            {t('settings.connection.noConnections')}
          </p>
          <Button onClick={() => setIsModalOpen(true)}>
            <Plus className="w-4 h-4" />
            {t('settings.connection.addConnection')}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {connections.map((conn) => (
            <ConnectionCard
              key={conn.id}
              connection={conn}
              isActive={conn.isActive}
              onSetActive={async () => {
                await connectionOps.setActive(conn.id);
                onRefresh();
              }}
              onEdit={() => {
                setEditingConnection(conn);
                setIsModalOpen(true);
              }}
              onDelete={() => setDeleteConfirm(conn.id)}
            />
          ))}
        </div>
      )}

      <ConnectionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        connection={editingConnection}
        onSave={async (data) => {
          if (editingConnection) {
            await connectionOps.update(editingConnection.id, data);
          } else {
            await connectionOps.add({
              ...data,
              id: generateUUID(),
              createdAt: Date.now(),
              updatedAt: Date.now(),
            } as ConnectionProfile);
          }
          onRefresh();
          setIsModalOpen(false);
        }}
      />

      <ConfirmDialog
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={async () => {
          if (deleteConfirm) {
            await connectionOps.delete(deleteConfirm);
            onRefresh();
            setDeleteConfirm(null);
          }
        }}
        title={t('settings.connection.deleteConnection')}
        message={t('settings.connection.deleteConnection') + '?'}
        confirmText={t('common.delete')}
        variant="danger"
      />
    </div>
  );
}

// Connection Card Component
function ConnectionCard({
  connection,
  isActive,
  onSetActive,
  onEdit,
  onDelete,
}: {
  connection: ConnectionProfile;
  isActive: boolean;
  onSetActive: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null);

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);

    // Create a temporary preset for testing
    const testPreset: Preset = {
      id: 'test',
      name: 'Test',
      temperature: 0.7,
      topP: 1,
      frequencyPenalty: 0,
      presencePenalty: 0,
      maxTokens: 50,
      isDefault: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const client = new APIClient(connection, testPreset);
    const result = await client.testConnection();
    setTestResult(result);
    setIsTesting(false);
  };

  return (
    <div className={`glass-sm p-4 ${isActive ? 'border-parlor-500/50 bg-parlor-500/5' : ''}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-white">{connection.name}</h3>
            {isActive && (
              <span className="text-xs bg-green-500/20 text-green-400 px-2 py-0.5 rounded-full">
                {t('common.enabled')}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {connection.provider.charAt(0).toUpperCase() + connection.provider.slice(1)} • {connection.model}
          </p>
          {testResult && (
            <div className={`flex items-center gap-2 mt-2 text-sm ${testResult.success ? 'text-green-400' : 'text-red-400'}`}>
              {testResult.success ? (
                <>
                  <CheckCircle className="w-4 h-4" />
                  {t('settings.connection.connectionSuccess')}
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4" />
                  {testResult.error}
                </>
              )}
            </div>
          )}
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleTest}
            disabled={isTesting}
          >
            {isTesting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              t('settings.connection.testConnection')
            )}
          </Button>
          {!isActive && (
            <Button variant="secondary" size="sm" onClick={onSetActive}>
              {t('settings.connection.setActive')}
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onEdit}>
            <Edit3 className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={onDelete}>
            <Trash2 className="w-4 h-4 text-red-400" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// Connection Modal
export function ConnectionModal({
  isOpen,
  onClose,
  connection,
  onSave,
}: {
  isOpen: boolean;
  onClose: () => void;
  connection: ConnectionProfile | null;
  onSave: (data: Partial<ConnectionProfile>) => Promise<void>;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [provider, setProvider] = useState<APIProvider>('deepseek');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('');
  const [endpoint, setEndpoint] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [availableModels, setAvailableModels] = useState<{ id: string; name?: string }[]>([]);
  const [showCustomModel, setShowCustomModel] = useState(false);

  // Fetch models when provider or apiKey changes (debounced to avoid per-keystroke requests)
  useEffect(() => {
    const shouldLoad = provider === 'deepseek' && apiKey;
    if (!shouldLoad) return;
    const timer = setTimeout(() => loadModels(), 500);
    return () => clearTimeout(timer);
  }, [provider, apiKey, endpoint]);

  // Load models when opening modal for existing connection
  useEffect(() => {
    if (connection) {
      setName(connection.name);
      setProvider(connection.provider);
      setApiKey(connection.apiKey);
      setModel(connection.model);
      setEndpoint(connection.endpoint || '');
      // Load models for existing connection
      if (connection.provider === 'deepseek' && connection.apiKey) {
        loadModelsForConnection(connection.provider, connection.apiKey, connection.endpoint);
      }
    } else {
      setName('');
      setProvider('deepseek');
      setApiKey('');
      setModel(DEFAULT_MODELS.deepseek[0]);
      setEndpoint('');
      setAvailableModels(DEFAULT_MODELS.deepseek.map(id => ({ id })));
    }
    setShowCustomModel(false);
  }, [connection, isOpen]);

  const loadModelsForConnection = async (prov: APIProvider, key: string, customEndpoint?: string) => {
    setIsLoadingModels(true);
    try {
      const models = await fetchAvailableModels({
        provider: prov,
        apiKey: key,
        endpoint: customEndpoint,
        model: '',
        id: '',
        name: '',
        isActive: false,
        createdAt: 0,
        updatedAt: 0,
      });
      setAvailableModels(models);
      // If current model not in list, show custom input
      if (connection && !models.find(m => m.id === connection.model)) {
        setShowCustomModel(true);
      }
    } catch (error) {
      console.error('Failed to load models:', error);
      setAvailableModels(DEFAULT_MODELS[prov]?.map(id => ({ id })) || []);
    } finally {
      setIsLoadingModels(false);
    }
  };

  const loadModels = async () => {
    if (provider !== 'deepseek' || !apiKey.trim()) return;
    await loadModelsForConnection(provider, apiKey, endpoint);
  };

  const handleProviderChange = (newProvider: APIProvider) => {
    setProvider(newProvider);
    if (newProvider === 'deepseek') {
      setAvailableModels(DEFAULT_MODELS.deepseek.map(id => ({ id })));
      setModel(DEFAULT_MODELS.deepseek[0]);
    } else {
      setAvailableModels([]);
      setModel('');
    }
    setShowCustomModel(false);
    if (newProvider !== 'custom') setEndpoint('');
  };

  const handleSave = async () => {
    if (!name.trim() || !model.trim()) return;

    setIsLoading(true);
    try {
      await onSave({
        name: name.trim(),
        provider,
        apiKey,
        model: model.trim(),
        endpoint: provider === 'custom' ? endpoint : undefined,
        isActive: connection?.isActive || false,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={connection ? t('settings.connection.saveConnection') : t('settings.connection.addConnection')}
      size="md"
    >
      <div className="space-y-4">
        <Input
          label={t('settings.connection.addConnection')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('settings.connection.connectionNamePlaceholder')}
        />

        <div>
            <label className="block text-sm font-medium text-gray-300 mb-1.5">
              {t('settings.connection.provider')}
            </label>
          <select
            value={provider}
            onChange={(e) => handleProviderChange(e.target.value as APIProvider)}
            className="w-full px-4 py-2.5 rounded-lg bg-dark-100 border border-glass-border text-white focus:outline-none focus:border-parlor-500/50"
          >
            <option value="deepseek">DeepSeek</option>
            <option value="custom">Custom Endpoint</option>
          </select>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-sm font-medium text-gray-300">{t('settings.connection.apiKey')}</label>
            {(provider === 'deepseek' && apiKey) && !isLoadingModels && (
              <button
                type="button"
                onClick={loadModels}
                className="text-xs text-parlor-400 hover:text-parlor-300"
              >
                {t('settings.connection.fetchModels')}
              </button>
            )}
          </div>
          <Input
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={provider === 'custom' ? t('settings.connection.apiKeyOptional') : 'sk-...'}
            type="password"
          />
        </div>

        {provider === 'custom' && (
          <Input
            label={t('settings.connection.endpoint')}
            value={endpoint}
            onChange={(e) => setEndpoint(e.target.value)}
            placeholder="http://localhost:1234/v1/chat/completions"
          />
        )}

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1.5">
            {t('settings.connection.model')}
          </label>
          {isLoadingModels ? (
            <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-dark-100 border border-glass-border">
              <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
              <span className="text-gray-400">{t('common.loading')}</span>
            </div>
          ) : availableModels.length > 0 ? (
            <>
              <select
                value={showCustomModel ? '_custom' : model}
                onChange={(e) => {
                  if (e.target.value === '_custom') {
                    setShowCustomModel(true);
                    setModel('');
                  } else {
                    setShowCustomModel(false);
                    setModel(e.target.value);
                  }
                }}
                className="w-full px-4 py-2.5 rounded-lg bg-dark-100 border border-glass-border text-white focus:outline-none focus:border-parlor-500/50"
              >
                {availableModels.map((m) => (
                  <option key={m.id} value={m.id}>{m.name || m.id}</option>
                ))}
                <option value="_custom">{t('settings.connection.customModel')}</option>
              </select>
              {showCustomModel && (
                <Input
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder={t('settings.connection.enterModelName')}
                  className="mt-2"
                  autoFocus
                />
              )}
            </>
          ) : (
            <Input
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="model-name"
            />
          )}
        </div>

        <div className="flex gap-3 justify-end pt-2">
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSave} isLoading={isLoading} disabled={!name.trim() || !model.trim()}>
            {connection ? t('common.save') : t('common.create')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
