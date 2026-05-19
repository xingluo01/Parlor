import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import zh from './locales/zh.json';
import en from './locales/en.json';

i18n.use(initReactI18next).init({
  resources: {
    zh: { translation: zh },
    en: { translation: en },
  },
  lng: 'zh',           // 默认中文
  fallbackLng: 'en',   // 回退英文
  interpolation: {
    escapeValue: false, // React 已处理 XSS
    prefix: '{',
    suffix: '}',
  },
});

export default i18n;
