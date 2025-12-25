import { Server } from 'http';
import { Sequelize } from 'sequelize';
import app from '../src/server';

let server: Server;
let sequelize: Sequelize;

beforeAll(async () => {
  // Setup test database
  sequelize = new Sequelize('sqlite::memory:', {
    logging: false
  });
  
  // Import and sync models
  const models = require('../src/database/models').default;
  await sequelize.sync({ force: true });
  
  // Start server
  server = (app as any).httpServer;
});

afterAll(async () => {
  await sequelize.close();
  if (server) {
    server.close();
  }
});

export { server, sequelize };