import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, Upload, Trash2 } from 'lucide-react';
import { Button, ConfirmDialog } from '../../components/ui';
import { backupOps } from '../../db';

// Backup Settings Component
export function BackupSettings({
  onQuickBackup,
  onFullBackup,
}: {
  onQuickBackup: () => void;
  onFullBackup: () => void;
}) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [nukeConfirm, setNukeConfirm] = useState(false);
  const [isNuking, setIsNuking] = useState(false);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const backup = JSON.parse(text);

      if (backup.exportType === 'full') {
        await backupOps.restoreFullBackup(backup);
      } else {
        await backupOps.restoreQuickBackup(backup);
      }

      window.location.reload();
    } catch (error) {
      console.error('Restore failed:', error);
    }
  };

  return (
    <div>
      <h2 className="text-lg font-semibold text-white mb-4 font-serif tracking-tight">{t('settings.backup.title')}</h2>

      <div className="space-y-6">
        {/* Backup Section */}
        <div>
          <h3 className="text-sm font-medium text-gray-300 mb-3">{t('settings.backup.createBackup')}</h3>
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" onClick={onQuickBackup}>
              <Download className="w-4 h-4" />
              {t('settings.backup.quickBackup')}
            </Button>
            <Button variant="secondary" onClick={onFullBackup}>
              <Download className="w-4 h-4" />
              {t('settings.backup.fullBackup')}
            </Button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {t('settings.backup.quickBackupDesc')}
          </p>
        </div>

        {/* Restore Section */}
        <div>
          <h3 className="text-sm font-medium text-gray-300 mb-3">{t('settings.backup.restoreBackup')}</h3>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImport}
            className="hidden"
          />
          <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
            <Upload className="w-4 h-4" />
            {t('common.import')}
          </Button>
          <p className="text-xs text-gray-500 mt-2">
            {t('settings.backup.restoreWarning')}
          </p>
        </div>

        {/* Danger Zone */}
        <div className="border border-red-500/30 rounded-xl p-4 bg-red-500/5">
          <h3 className="text-sm font-medium text-red-400 mb-1">{t('characterDetail.dangerZone')}</h3>
          <p className="text-xs text-gray-500 mb-3">
            {t('settings.backup.deleteEverythingDesc')}
          </p>
          <Button
            variant="danger"
            size="sm"
            onClick={() => setNukeConfirm(true)}
            isLoading={isNuking}
          >
            <Trash2 className="w-4 h-4" />
            {t('settings.backup.deleteEverything')}
          </Button>
        </div>
      </div>

      <ConfirmDialog
        isOpen={nukeConfirm}
        onClose={() => setNukeConfirm(false)}
        onConfirm={async () => {
          setIsNuking(true);
          try {
            await backupOps.nukeAllData();
            window.location.reload();
          } finally {
            setIsNuking(false);
            setNukeConfirm(false);
          }
        }}
        title={t('settings.backup.deleteEverything')}
        message={t('settings.backup.deleteEverythingConfirm')}
        confirmText={t('common.yes')}
        variant="danger"
      />
    </div>
  );
}
