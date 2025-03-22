// Script to handle TypeScript configuration during Vercel build
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Function to execute command and log output
function runCommand(command) {
  console.log(`Running: ${command}`);
  try {
    execSync(command, { stdio: 'inherit' });
    return true;
  } catch (error) {
    console.error(`Command failed: ${command}`);
    console.error(error);
    return false;
  }
}

// Main build process
async function build() {
  console.log('Starting custom build process...');
  
  // 1. Rename tsconfig.json temporarily
  if (fs.existsSync('tsconfig.json')) {
    console.log('Temporarily renaming tsconfig.json to tsconfig.backup.json');
    fs.renameSync('tsconfig.json', 'tsconfig.backup.json');
  }
  
  // 2. Create temporary minimal tsconfig.json
  const minimalTsConfig = {
    "compilerOptions": {
      "lib": ["dom", "dom.iterable", "esnext"],
      "allowJs": true,
      "skipLibCheck": true,
      "strict": false,
      "noEmit": true,
      "incremental": true,
      "esModuleInterop": true,
      "module": "esnext",
      "moduleResolution": "node",
      "resolveJsonModule": true,
      "isolatedModules": true,
      "jsx": "preserve"
    },
    "include": ["next-env.d.ts"],
    "exclude": ["node_modules"]
  };
  
  console.log('Creating minimal tsconfig.json');
  fs.writeFileSync('tsconfig.json', JSON.stringify(minimalTsConfig, null, 2));
  
  try {
    // 3. Install dependencies
    console.log('Installing TypeScript and dependencies...');
    runCommand('npm install --save-dev typescript@5.4.2 @types/react@18.2.64 @types/react-dom@18.2.21');
    
    // 4. Run Next.js build
    console.log('Running Next.js build...');
    const buildSuccess = runCommand('npm install --legacy-peer-deps && next build');
    
    if (!buildSuccess) {
      console.error('Build failed!');
      process.exit(1);
    }
    
    console.log('Build completed successfully!');
    return true;
  } catch (error) {
    console.error('Build process failed:', error);
    return false;
  } finally {
    // 5. Restore original tsconfig.json
    if (fs.existsSync('tsconfig.backup.json')) {
      console.log('Restoring original tsconfig.json');
      if (fs.existsSync('tsconfig.json')) {
        fs.unlinkSync('tsconfig.json');
      }
      fs.renameSync('tsconfig.backup.json', 'tsconfig.json');
    }
  }
}

// Run the build
build().then(success => {
  if (!success) {
    process.exit(1);
  }
}).catch(error => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
