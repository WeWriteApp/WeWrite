// Script to ensure TypeScript is installed during Vercel build
const { execSync } = require('child_process');

console.log('Installing TypeScript and React types...');
try {
  execSync('npm install --save-dev typescript@5.4.2 @types/react@18.2.64 @types/react-dom@18.2.21', { stdio: 'inherit' });
  console.log('TypeScript and React types installed successfully!');
} catch (error) {
  console.error('Error installing TypeScript:', error);
  process.exit(1);
}
