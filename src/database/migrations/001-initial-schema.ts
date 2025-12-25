import { QueryInterface, DataTypes } from 'sequelize';

export async function up(queryInterface: QueryInterface): Promise<void> {
  // Enable UUID extension
  await queryInterface.sequelize.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
  
  // Create enum types
  await queryInterface.sequelize.query(`
    DO $$ BEGIN
      CREATE TYPE user_role AS ENUM ('admin', 'company', 'bidder');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `);
  
  await queryInterface.sequelize.query(`
    DO $$ BEGIN
      CREATE TYPE auction_status AS ENUM ('draft', 'scheduled', 'live', 'paused', 'ended', 'cancelled', 'sold');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `);
  
  // Create users table
  await queryInterface.createTable('users', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true
    },
    password: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    role: {
      type: DataTypes.ENUM('admin', 'company', 'bidder'),
      allowNull: false
    },
    firstName: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    lastName: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: false
    },
    companyId: {
      type: DataTypes.UUID,
      allowNull: true
    },
    isVerified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    profilePicture: {
      type: DataTypes.STRING(500),
      allowNull: true
    },
    address: {
      type: DataTypes.JSONB,
      allowNull: true
    },
    kycStatus: {
      type: DataTypes.ENUM('pending', 'verified', 'rejected'),
      defaultValue: 'pending'
    },
    lastLogin: {
      type: DataTypes.DATE,
      allowNull: true
    },
    emailVerified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    phoneVerified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    twoFactorEnabled: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    loginAttempts: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    accountLockedUntil: {
      type: DataTypes.DATE,
      allowNull: true
    },
    settings: {
      type: DataTypes.JSONB,
      defaultValue: {
        notifications: {
          email: true,
          push: true,
          sms: false
        },
        privacy: {
          profileVisible: true,
          bidHistoryVisible: true
        }
      }
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  });
  
  // Create other tables similarly...
  
  // Create indexes
  await queryInterface.addIndex('users', ['email']);
  await queryInterface.addIndex('users', ['role']);
  await queryInterface.addIndex('users', ['companyId']);
  
  logger.info('✅ Initial migration completed');
}

export async function down(queryInterface: QueryInterface): Promise<void> {
  await queryInterface.dropTable('users');
  // Drop other tables...
  
  await queryInterface.sequelize.query('DROP TYPE IF EXISTS user_role');
  await queryInterface.sequelize.query('DROP TYPE IF EXISTS auction_status');
}