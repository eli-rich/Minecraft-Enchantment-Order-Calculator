import { CalculatorApp } from './app/app';
import './styles/main.css';

const root = document.querySelector<HTMLElement>('#app');
if (!root) throw new Error('The application root is missing.');

new CalculatorApp(root);
