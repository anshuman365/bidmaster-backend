import { Sequelize } from 'sequelize';
import { Umzug, SequelizeStorage } from 'umzug';
import path from 'path';
import { logger } from '../utils/logger';
import dotenv from 'dotenv';

dotenv.config();

const sequelize = new Sequelize(process.env.DATABASE_URL!, {
  dialect: 'postgres',
  logging: (msg) => logger.debug(msg),
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false
    }
  }
});

const umzug = new Umzug({
  migrations: {
    glob: path.join(__dirname, '../database/migrations/*.ts'),
  },
  context: sequelize.getQueryInterface(),
  storage: new SequelizeStorage({ sequelize }),
  logger: console,
});

async function runMigrations() {
  try {
    await sequelize.authenticate();
    logger.info('Database connected for migrations');
    
    const pending = await umzug.pending();
    logger.info(`Pending migrations: ${pending.length}`);
    
    if (pending.length > 0) {
      await umzug.up();
      logger.info('All migrations completed successfully');
    } else {
      logger.info('No pending migrations');
    }
    
    await sequelize.close();
    process.exit(0);
  } catch (error) {
    logger.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigrations();