import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './AccessBoundary.vue';
import './style.css';
import './conversation-layout.css';
import './result-workspace.css';

createApp(App).use(createPinia()).mount('#app');
