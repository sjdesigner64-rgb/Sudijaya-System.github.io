module.exports = {
  apps: [
    {
      name: 'sjgroup-backend',
      cwd: 'C:/Users/willi/Downloads/Sistem SJ Group/sjgroup-system/server',
      script: 'node_modules/ts-node-dev/lib/bin.js',
      args: '--respawn --transpile-only src/index.ts',
      watch: false,
      env: { NODE_ENV: 'development' },
    },
    {
      name: 'sjgroup-frontend',
      cwd: 'C:/Users/willi/Downloads/Sistem SJ Group/sjgroup-system',
      script: 'node_modules/vite/bin/vite.js',
      args: '--port 5173',
      watch: false,
      env: { NODE_ENV: 'development' },
    },
  ],
}
