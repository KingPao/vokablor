import { registerRoute, startRouter } from './router.js';
import { renderLoginPage, renderRegisterPage } from './pages/auth.js';
import { renderVocabularyPage } from './pages/vocabulary.js';
import { renderTrainingPage } from './pages/training.js';
import { renderReadingPage } from './pages/reading.js';
import { renderSpeakingPage } from './pages/speaking.js';
import { renderAiProviderSettingsPage } from './pages/settings-ai-provider.js';
import { renderConversationPage } from './pages/conversation.js';
import { startOfflineSync } from './sw/offline-sync.js';

registerRoute('/not-found', (root) => {
  root.innerHTML = '<p>Page not found.</p>';
});

registerRoute('/', (root) => {
  root.innerHTML = '<p><a href="#/login">Log in</a> or <a href="#/register">create an account</a> to get started.</p>';
});

registerRoute('/login', renderLoginPage);
registerRoute('/register', renderRegisterPage);
registerRoute('/vocabulary', renderVocabularyPage);
registerRoute('/training', renderTrainingPage);
registerRoute('/vocabulary/:id/reading', renderReadingPage);
registerRoute('/speaking', renderSpeakingPage);
registerRoute('/settings/ai-provider', renderAiProviderSettingsPage);
registerRoute('/conversation', renderConversationPage);

startRouter();
startOfflineSync();

if ('serviceWorker' in navigator) {
  void import('virtual:pwa-register').then(({ registerSW }) => registerSW({ immediate: true }));
}
