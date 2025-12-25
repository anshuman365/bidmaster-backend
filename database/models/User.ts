
import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../../config/database';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

interface UserAttributes {
  id: string;
  email: string;
  password: string;
  role: 'admin' | 'company' | 'bidder';
  firstName: string;
  lastName: string;
  phone: string;
  companyId: string | null;
  isVerified: boolean;
  isActive: boolean;
  profilePicture: string | null;
  address: {
    street: string;
    city: string;
    state: string;
    zipcode: string;
    country: string;
  } | null;
  kycStatus: 'pending' | 'verified' | 'rejected';
  lastLogin: Date | null;
  emailVerified: boolean;
  phoneVerified: boolean;
  twoFactorEnabled: boolean;
  loginAttempts: number;
  accountLockedUntil: Date | null;
  settings: {
    notifications: {
      email: boolean;
      push: boolean;
      sms: boolean;
    };
    privacy: {
      profileVisible: boolean;
      bidHistoryVisible: boolean;
    };
  };
  createdAt: Date;
  updatedAt: Date;
}

interface UserCreationAttributes extends Optional<UserAttributes, 
  'id' | 'companyId' | 'isVerified' | 'isActive' | 'profilePicture' | 
  'address' | 'kycStatus' | 'lastLogin' | 'emailVerified' | 
  'phoneVerified' | 'twoFactorEnabled' | 'loginAttempts' | 
  'accountLockedUntil' | 'settings' | 'createdAt' | 'updatedAt'> {}

class User extends Model<UserAttributes, UserCreationAttributes> implements UserAttributes {
  public id!: string;
  public email!: string;
  public password!: string;
  public role!: 'admin' | 'company' | 'bidder';
  public firstName!: string;
  public lastName!: string;
  public phone!: string;
  public companyId!: string | null;
  public isVerified!: boolean;
  public isActive!: boolean;
  public profilePicture!: string | null;
  public address!: { street: string; city: string; state: string; zipcode: string; country: string; } | null;
  public kycStatus!: 'pending' | 'verified' | 'rejected';
  public lastLogin!: Date | null;
  public emailVerified!: boolean;
  public phoneVerified!: boolean;
  public twoFactorEnabled!: boolean;
  public loginAttempts!: number;
  public accountLockedUntil!: Date | null;
  public settings!: { notifications: { email: boolean; push: boolean; sms: boolean; }; privacy: { profileVisible: boolean; bidHistoryVisible: boolean; }; };
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  public async comparePassword(candidatePassword: string): Promise<boolean> {
    return bcrypt.compare(candidatePassword, this.password);
  }

  public generateAuthToken(): string {
    return jwt.sign(
      { id: this.id, email: this.email, role: this.role, companyId: this.companyId },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );
  }

  public generateRefreshToken(): string {
    return jwt.sign({ id: this.id }, process.env.JWT_REFRESH_SECRET!, { expiresIn: '30d' });
  }

  public async incrementLoginAttempts(): Promise<void> {
    this.loginAttempts += 1;
    if (this.loginAttempts >= 5) {
      this.accountLockedUntil = new Date(Date.now() + 30 * 60 * 1000);
    }
    // Fix: Cast this to any to access save() if not recognized
    await (this as any).save();
  }

  public resetLoginAttempts(): void {
    this.loginAttempts = 0;
    this.accountLockedUntil = null;
  }

  public toJSON(): any {
    // Fix: Cast this to any to access get() if not recognized
    const values = Object.assign({}, (this as any).get());
    delete values.password;
    delete values.loginAttempts;
    delete values.accountLockedUntil;
    return values;
  }
}

// Fix: Cast User to any to access static init()
(User as any).init({
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    email: { type: DataTypes.STRING, allowNull: false, unique: true, validate: { isEmail: true } },
    password: { type: DataTypes.STRING, allowNull: false },
    role: { type: DataTypes.ENUM('admin', 'company', 'bidder'), allowNull: false },
    firstName: { type: DataTypes.STRING, allowNull: false },
    lastName: { type: DataTypes.STRING, allowNull: false },
    phone: { type: DataTypes.STRING, allowNull: false },
    companyId: { type: DataTypes.UUID, allowNull: true },
    isVerified: { type: DataTypes.BOOLEAN, defaultValue: false },
    isActive: { type: DataTypes.BOOLEAN, defaultValue: true },
    profilePicture: { type: DataTypes.STRING, allowNull: true },
    address: { type: DataTypes.JSONB, allowNull: true },
    kycStatus: { type: DataTypes.ENUM('pending', 'verified', 'rejected'), defaultValue: 'pending' },
    lastLogin: { type: DataTypes.DATE, allowNull: true },
    emailVerified: { type: DataTypes.BOOLEAN, defaultValue: false },
    phoneVerified: { type: DataTypes.BOOLEAN, defaultValue: false },
    twoFactorEnabled: { type: DataTypes.BOOLEAN, defaultValue: false },
    loginAttempts: { type: DataTypes.INTEGER, defaultValue: 0 },
    accountLockedUntil: { type: DataTypes.DATE, allowNull: true },
    settings: { type: DataTypes.JSONB, defaultValue: { notifications: { email: true, push: true, sms: false }, privacy: { profileVisible: true, bidHistoryVisible: true } } },
  },
  {
    sequelize,
    tableName: 'users',
    timestamps: true,
    hooks: {
      beforeCreate: async (user: User) => {
        if (user.password) {
          const salt = await bcrypt.genSalt(10);
          user.password = await bcrypt.hash(user.password, salt);
        }
      },
      beforeUpdate: async (user: User) => {
        // Fix: Cast user to any to access changed()
        if ((user as any).changed('password')) {
          const salt = await bcrypt.genSalt(10);
          user.password = await bcrypt.hash(user.password, salt);
        }
      },
    },
  }
);

export default User;
