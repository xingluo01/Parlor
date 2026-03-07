import { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Upload, Trash2, FileText, Database } from 'lucide-react';
import { Button } from '../components/ui';
import { dataBankOps } from '../db';
import { generateUUID } from '../utils/uuid';
import { chunkDocument } from '../services/documentChunker';
import type { DataBankDocument } from '../types';

type ScopeOption = 'global' | 'character' | 'chat';

export function DataBankPage() {
  const [documents, setDocuments] = useState<DataBankDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [scope, setScope] = useState<ScopeOption>('global');
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function loadDocuments() {
      try {
        const docs = await dataBankOps.getAll();
        setDocuments(docs);
      } catch (error) {
        console.error('Failed to load data bank documents:', error);
      } finally {
        setIsLoading(false);
      }
    }
    loadDocuments();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const content = await readFileContent(file);
        const docId = generateUUID();
        const chunks = chunkDocument(content, docId);
        const now = Date.now();

        const doc: DataBankDocument = {
          id: docId,
          name: file.name,
          content,
          scope,
          chunkCount: chunks.length,
          createdAt: now,
          updatedAt: now,
        };

        await dataBankOps.add(doc);
        setDocuments(prev => [doc, ...prev]);
      }
    } catch (error) {
      console.error('Failed to upload document:', error);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const readFileContent = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  };

  const handleDelete = async (id: string) => {
    try {
      await dataBankOps.delete(id);
      setDocuments(prev => prev.filter(d => d.id !== id));
    } catch (error) {
      console.error('Failed to delete document:', error);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const scopeBadgeColor = (s: string) => {
    switch (s) {
      case 'global': return 'bg-parlor-500/15 text-parlor-300';
      case 'character': return 'bg-blue-500/15 text-blue-300';
      case 'chat': return 'bg-green-500/15 text-green-300';
      default: return 'bg-gray-500/15 text-gray-300';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-parlor-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-dark-200">
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Database className="w-6 h-6 text-parlor-500" />
            <h1 className="text-2xl sm:text-3xl font-bold text-white font-serif tracking-tight">Data Bank</h1>
          </div>
        </div>

        {/* Upload Controls */}
        <div className="glass p-4 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-400">Scope:</label>
            <select
              value={scope}
              onChange={(e) => setScope(e.target.value as ScopeOption)}
              className="bg-dark-50 border border-glass-border rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-parlor-500"
            >
              <option value="global">Global</option>
              <option value="character">Character</option>
              <option value="chat">Chat</option>
            </select>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.md,.json"
            multiple
            onChange={handleFileUpload}
            className="hidden"
          />
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="flex items-center gap-2"
          >
            <Upload className="w-4 h-4" />
            {isUploading ? 'Uploading...' : 'Upload Files'}
          </Button>
          <span className="text-xs text-gray-500">.txt, .md, .json</span>
        </div>

        {/* Document List */}
        {documents.length === 0 ? (
          <div className="glass p-12 text-center">
            <FileText className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-500">
              No documents uploaded. Upload text or markdown files to use as reference context.
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {documents.map((doc) => (
              <motion.div
                key={doc.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="glass p-4 flex items-center gap-4"
              >
                <FileText className="w-8 h-8 text-parlor-500 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-white font-medium truncate">{doc.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${scopeBadgeColor(doc.scope)}`}>
                      {doc.scope}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500">
                    <span>{doc.chunkCount ?? 0} chunks</span>
                    <span>{formatDate(doc.createdAt)}</span>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(doc.id)}
                  className="p-2 text-gray-500 hover:text-red-400 transition-colors rounded-lg hover:bg-red-500/10"
                  title="Delete document"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default DataBankPage;
