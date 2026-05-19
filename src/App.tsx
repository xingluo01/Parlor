import { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/layout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { initializeDatabase, settingsOps } from './db';
import { applyTheme, getTheme } from './utils/themes';
import { startAutoSync } from './services/sync';

// Lazy-load route-level components for smaller initial bundle
const HomePage = lazy(() => import('./pages/HomePage'));
const CharactersPage = lazy(() => import('./pages/CharactersPage'));
const CharacterDetailPage = lazy(() => import('./pages/CharacterDetailPage'));
const CharacterEditorPage = lazy(() => import('./pages/CharacterEditorPage'));
const CharacterImportPage = lazy(() => import('./pages/CharacterImportPage'));
const ChatsPage = lazy(() => import('./pages/ChatsPage'));
const ChatPage = lazy(() => import('./pages/ChatPage'));
const PersonasPage = lazy(() => import('./pages/PersonasPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const LorebookPage = lazy(() => import('./pages/LorebookPage'));
const GroupChatPage = lazy(() => import('./pages/GroupChatPage'));
const GroupChatEditorPage = lazy(() => import('./pages/GroupChatEditorPage'));
const DataBankPage = lazy(() => import('./pages/DataBankPage'));
const CharacterMarketPage = lazy(() => import('./pages/CharacterMarketPage'));
const ImageGeneratorPage = lazy(() => import('./pages/ImageGeneratorPage'));
const NovelParserPage = lazy(() => import('./pages/NovelParserPage'));

function RouteSpinner() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-parlor-500" />
    </div>
  );
}

function App() {
  useEffect(() => {
    initializeDatabase().then(() => {
      // Load and apply saved theme after DB is ready
      settingsOps.get().then(s => {
        if (s?.activeTheme) {
          applyTheme(getTheme(s.activeTheme, s.customTheme));
        }
        // Start auto-sync if configured
        if (s?.syncEnabled && s.syncRemoteUrl && s.syncIntervalMinutes) {
          startAutoSync(s.syncRemoteUrl, s.syncIntervalMinutes);
        }
      }).catch(() => {});
    });
  }, []);

  return (
    <ErrorBoundary>
    <BrowserRouter>
      <Suspense fallback={<RouteSpinner />}>
      <Routes>
        <Route path="/" element={<Layout />}>
          {/* Home page */}
          <Route index element={<HomePage />} />

          {/* Characters */}
          <Route path="characters" element={<CharactersPage />} />
          <Route path="characters/new" element={<CharacterEditorPage />} />
          <Route path="characters/import" element={<CharacterImportPage />} />
          <Route path="characters/:id" element={<CharacterDetailPage />} />
          <Route path="characters/:id/edit" element={<CharacterEditorPage />} />

          {/* Chats */}
          <Route path="chats" element={<ChatsPage />} />
          <Route path="chat/:id" element={<ChatPage />} />

          {/* Group Chats */}
          <Route path="groups" element={<ChatsPage />} />
          <Route path="groups/new" element={<GroupChatEditorPage />} />
          <Route path="groups/:id/edit" element={<GroupChatEditorPage />} />
          <Route path="group/:id" element={<GroupChatPage />} />

          {/* Personas */}
          <Route path="personas" element={<PersonasPage />} />

          {/* Lorebook */}
          <Route path="lorebook" element={<LorebookPage />} />

          {/* Data Bank */}
          <Route path="databank" element={<DataBankPage />} />

          {/* Character Market */}
          <Route path="markets" element={<CharacterMarketPage />} />

          {/* Image Generator */}
          <Route path="image-gen" element={<ImageGeneratorPage />} />

          {/* Novel Parser */}
          <Route path="novel-parser" element={<NovelParserPage />} />

          {/* Settings */}
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
      </Suspense>
    </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
