const path = require('path');

module.exports = {
  apps: [
    {
      name: 'empty-queue-app',
      cwd: path.resolve(__dirname, 'server'),
      script: 'src/index.js',
      node_args: '--enable-source-maps',
      env: {
        NODE_ENV: 'production',
        PORT: '4000',
      },
    },
  ],
};
