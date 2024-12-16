import { defineConfig } from 'vite';
import fs from 'fs';
import path from 'path';

export default defineConfig({
  server: {
    port: 5173,
  },
  plugins: [
    {
      name: 'mock-backend',
      configureServer(server) {
        server.middlewares.use('/gamedata', (req, res) => {
          const charactersDir = path.join(__dirname, 'data', 'characters');
          const dimensionsDir = path.join(__dirname, 'data', 'dimensions');

          const characters = fs.readdirSync(charactersDir).map((file) => {
            return JSON.parse(fs.readFileSync(path.join(charactersDir, file), 'utf-8'));
          });

          const dimensions = fs.readdirSync(dimensionsDir).map((file) => {
            return JSON.parse(fs.readFileSync(path.join(dimensionsDir, file), 'utf-8'));
          });

          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ characters, dimensions }));
        });
      },
    },
  ],
});
