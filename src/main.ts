import { mount } from 'svelte';
import './app.css';
import App from './App.svelte';
import { applyTheme, readTheme } from './lib/ui/theme';

applyTheme(readTheme());

const target = document.getElementById('app');
if (!target) throw new Error('App mount target is missing.');
mount(App, { target });
