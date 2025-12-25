import { Sequelize } from 'sequelize';
import { logger } from '../utils/logger';
import dotenv from 'dotenv';

dotenv.config();

async function runMigrations() {
  try {
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

    await sequelize.authenticate();
    logger.info('✅ Database connected for migrations');

    // Create tables using Sequelize sync (for initial deployment)
    await sequelize.sync({ alter: true });
    logger.info('✅ Database tables synced');

    // Create admin user
    const User = require('../database/models/User').default;
    const adminCount = await User.count({ where: { role: 'admin' } });
    
    if (adminCount === 0) {
      const adminUser = await User.create({
        email: 'admin@bidmaster.com',
        password: 'Admin@123',
        firstName: 'Admin',
        lastName: 'User',
        phone: '+1234567890',
        role: 'admin',
        isVerified: true,
        isActive: true,
        emailVerified: true,
        phoneVerified: true
      });
      logger.info(`✅ Admin user created: ${adminUser.email}`);
    }

    await sequelize.close();
    logger.info('✅ Migration completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigrations();