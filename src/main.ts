import { mount } from 'svelte';
import './app.css';
import App from './App.svelte';

const media = matchMedia('(prefers-color-scheme: dark)');
const applySystemTheme = () => { document.documentElement.dataset.theme = media.matches ? 'dark' : 'light'; };
applySystemTheme();
media.addEventListener('change', applySystemTheme);

const target = document.getElementById('app');
if (!target) throw new Error('App mount target is missing.');
mount(App, { target });
