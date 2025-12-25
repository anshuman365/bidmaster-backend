import { DataTypes, Model } from 'sequelize';
import sequelize from '../../config/database';

interface CompanyAttributes {
  id: string;
  userId: string;
  name: string;
  legalName: string;
  registrationNumber: string;
  taxId: string;
  businessType: 'sole_proprietorship' | 'partnership' | 'llc' | 'corporation';
  industry: string;
  foundedYear: number;
  description: string;
  logo: string | null;
  website: string | null;
  phone: string;
  email: string;
  address: any;
  socialMedia: any;
  documents: any[];
  status: 'pending' | 'verified' | 'suspended' | 'rejected';
  verificationStatus: {
    business: boolean;
    identity: boolean;
    address: boolean;
    bank: boolean;
  };
  kycStatus: 'pending' | 'verified' | 'rejected';
  kycDocuments: any[];
  rating: number;
  totalReviews: number;
  totalAuctions: number;
  totalWonAuctions: number;
  totalRevenue: number;
  metadata: any;
  createdAt: Date;
  updatedAt: Date;
}

class Company extends Model<CompanyAttributes> implements CompanyAttributes {
  declare id: string;
  declare userId: string;
  declare name: string;
  declare legalName: string;
  declare registrationNumber: string;
  declare taxId: string;
  declare businessType: 'sole_proprietorship' | 'partnership' | 'llc' | 'corporation';
  declare industry: string;
  declare foundedYear: number;
  declare description: string;
  declare logo: string | null;
  declare website: string | null;
  declare phone: string;
  declare email: string;
  declare address: any;
  declare socialMedia: any;
  declare documents: any[];
  declare status: 'pending' | 'verified' | 'suspended' | 'rejected';
  declare verificationStatus: {
    business: boolean;
    identity: boolean;
    address: boolean;
    bank: boolean;
  };
  declare kycStatus: 'pending' | 'verified' | 'rejected';
  declare kycDocuments: any[];
  declare rating: number;
  declare totalReviews: number;
  declare totalAuctions: number;
  declare totalWonAuctions: number;
  declare totalRevenue: number;
  declare metadata: any;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

Company.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  userId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  name: {
    type: DataTypes.STRING(200),
    allowNull: false
  },
  legalName: {
    type: DataTypes.STRING(200),
    allowNull: false
  },
  registrationNumber: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true
  },
  taxId: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true
  },
  businessType: {
    type: DataTypes.ENUM('sole_proprietorship', 'partnership', 'llc', 'corporation'),
    allowNull: false
  },
  industry: {
    type: DataTypes.STRING(100),
    allowNull: false
  },
  foundedYear: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  logo: {
    type: DataTypes.STRING,
    allowNull: true
  },
  website: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: {
      isUrl: true
    }
  },
  phone: {
    type: DataTypes.STRING(20),
    allowNull: false
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      isEmail: true
    }
  },
  address: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {
      street: '',
      city: '',
      state: '',
      zipcode: '',
      country: ''
    }
  },
  socialMedia: {
    type: DataTypes.JSONB,
    defaultValue: {
      facebook: null,
      twitter: null,
      linkedin: null,
      instagram: null
    }
  },
  documents: {
    type: DataTypes.JSONB,
    defaultValue: []
  },
  status: {
    type: DataTypes.ENUM('pending', 'verified', 'suspended', 'rejected'),
    defaultValue: 'pending'
  },
  verificationStatus: {
    type: DataTypes.JSONB,
    defaultValue: {
      business: false,
      identity: false,
      address: false,
      bank: false
    }
  },
  kycStatus: {
    type: DataTypes.ENUM('pending', 'verified', 'rejected'),
    defaultValue: 'pending'
  },
  kycDocuments: {
    type: DataTypes.JSONB,
    defaultValue: []
  },
  rating: {
    type: DataTypes.DECIMAL(3, 2),
    defaultValue: 0.0
  },
  totalReviews: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  totalAuctions: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  totalWonAuctions: {
    type: DataTypes.INTEGER,
    defaultValue: 0
  },
  totalRevenue: {
    type: DataTypes.DECIMAL(15, 2),
    defaultValue: 0
  },
  metadata: {
    type: DataTypes.JSONB,
    defaultValue: {
      featured: false,
      verifiedBadge: false,
      premium: false
    }
  }
}, {
  sequelize,
  tableName: 'companies',
  timestamps: true,
  indexes: [
    { fields: ['userId'] },
    { fields: ['status'] },
    { fields: ['kycStatus'] },
    { fields: ['registrationNumber'], unique: true },
    { fields: ['taxId'], unique: true }
  ]
});

export default Company;