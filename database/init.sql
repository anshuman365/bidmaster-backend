-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum types
CREATE TYPE user_role AS ENUM ('admin', 'company', 'bidder');
CREATE TYPE auction_status AS ENUM ('draft', 'scheduled', 'live', 'paused', 'ended', 'cancelled', 'sold');
CREATE TYPE auction_category AS ENUM ('machinery', 'vehicles', 'property', 'goods', 'services');
CREATE TYPE kyc_status AS ENUM ('pending', 'verified', 'rejected');
CREATE TYPE bid_status AS ENUM ('active', 'outbid', 'winning', 'withdrawn', 'invalid');
CREATE TYPE payment_status AS ENUM ('created', 'pending', 'completed', 'failed', 'refunded');
CREATE TYPE payment_provider AS ENUM ('razorpay', 'stripe', 'paypal');

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role user_role NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  company_id UUID,
  is_verified BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  profile_picture VARCHAR(500),
  address JSONB,
  kyc_status kyc_status DEFAULT 'pending',
  last_login TIMESTAMP,
  email_verified BOOLEAN DEFAULT false,
  phone_verified BOOLEAN DEFAULT false,
  two_factor_enabled BOOLEAN DEFAULT false,
  login_attempts INTEGER DEFAULT 0,
  account_locked_until TIMESTAMP,
  settings JSONB DEFAULT '{
    "notifications": {
      "email": true,
      "push": true,
      "sms": false
    },
    "privacy": {
      "profileVisible": true,
      "bidHistoryVisible": true
    }
  }',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Companies table
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  legal_name VARCHAR(200) NOT NULL,
  registration_number VARCHAR(100) UNIQUE NOT NULL,
  tax_id VARCHAR(100) UNIQUE NOT NULL,
  business_type VARCHAR(50) NOT NULL,
  industry VARCHAR(100) NOT NULL,
  founded_year INTEGER NOT NULL,
  description TEXT NOT NULL,
  logo VARCHAR(500),
  website VARCHAR(500),
  phone VARCHAR(20) NOT NULL,
  email VARCHAR(255) NOT NULL,
  address JSONB NOT NULL,
  social_media JSONB DEFAULT '{}',
  documents JSONB DEFAULT '[]',
  status VARCHAR(50) DEFAULT 'pending',
  verification_status JSONB DEFAULT '{
    "business": false,
    "identity": false,
    "address": false,
    "bank": false
  }',
  kyc_status kyc_status DEFAULT 'pending',
  kyc_documents JSONB DEFAULT '[]',
  rating DECIMAL(3,2) DEFAULT 0.0,
  total_reviews INTEGER DEFAULT 0,
  total_auctions INTEGER DEFAULT 0,
  total_won_auctions INTEGER DEFAULT 0,
  total_revenue DECIMAL(15,2) DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Auctions table
CREATE TABLE IF NOT EXISTS auctions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  category auction_category NOT NULL,
  subcategory VARCHAR(100) NOT NULL,
  item_details JSONB NOT NULL,
  auction_config JSONB NOT NULL DEFAULT '{
    "bidIncrement": 100,
    "startingBid": 0,
    "reservePrice": null,
    "buyNowPrice": null,
    "autoExtend": true,
    "extensionTime": 300,
    "maxExtensions": 3
  }',
  timing JSONB NOT NULL DEFAULT '{
    "biddingStartsAt": null,
    "biddingEndsAt": null,
    "previewStartsAt": null,
    "previewEndsAt": null
  }',
  terms JSONB NOT NULL DEFAULT '{
    "paymentTerms": "Net 7 days",
    "shippingTerms": "Buyer responsible",
    "inspection": "Available before bidding",
    "warranty": "As is"
  }',
  status auction_status DEFAULT 'draft',
  current_highest_bid DECIMAL(15,2) DEFAULT 0,
  current_highest_bidder_id UUID REFERENCES users(id),
  total_bids INTEGER DEFAULT 0,
  total_bidders INTEGER DEFAULT 0,
  total_views INTEGER DEFAULT 0,
  total_watches INTEGER DEFAULT 0,
  winner_id UUID REFERENCES users(id),
  winner_amount DECIMAL(15,2),
  commission_amount DECIMAL(15,2),
  tax_amount DECIMAL(15,2),
  final_amount DECIMAL(15,2),
  metadata JSONB DEFAULT '{
    "featured": false,
    "promoted": false,
    "urgent": false,
    "featuredUntil": null,
    "images": []
  }',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Bids table
CREATE TABLE IF NOT EXISTS bids (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auction_id UUID REFERENCES auctions(id) ON DELETE CASCADE,
  bidder_id UUID REFERENCES users(id) ON DELETE CASCADE,
  amount DECIMAL(15,2) NOT NULL,
  is_auto_bid BOOLEAN DEFAULT false,
  max_auto_bid_amount DECIMAL(15,2),
  status bid_status DEFAULT 'active',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Payments table
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  auction_id UUID REFERENCES auctions(id) ON DELETE SET NULL,
  amount DECIMAL(15,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'USD',
  provider payment_provider NOT NULL,
  provider_order_id VARCHAR(255) UNIQUE NOT NULL,
  provider_payment_id VARCHAR(255),
  status payment_status DEFAULT 'created',
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_company_id ON users(company_id);

CREATE INDEX idx_companies_user_id ON companies(user_id);
CREATE INDEX idx_companies_status ON companies(status);
CREATE INDEX idx_companies_registration_number ON companies(registration_number);
CREATE INDEX idx_companies_tax_id ON companies(tax_id);

CREATE INDEX idx_auctions_company_id ON auctions(company_id);
CREATE INDEX idx_auctions_status ON auctions(status);
CREATE INDEX idx_auctions_category ON auctions(category);
CREATE INDEX idx_auctions_current_highest_bidder_id ON auctions(current_highest_bidder_id);
CREATE INDEX idx_auctions_winner_id ON auctions(winner_id);

CREATE INDEX idx_bids_auction_id ON bids(auction_id);
CREATE INDEX idx_bids_bidder_id ON bids(bidder_id);
CREATE INDEX idx_bids_auction_id_bidder_id ON bids(auction_id, bidder_id);
CREATE INDEX idx_bids_status ON bids(status);

CREATE INDEX idx_payments_user_id ON payments(user_id);
CREATE INDEX idx_payments_auction_id ON payments(auction_id);
CREATE INDEX idx_payments_provider_order_id ON payments(provider_order_id);
CREATE INDEX idx_payments_status ON payments(status);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_auctions_updated_at BEFORE UPDATE ON auctions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_bids_updated_at BEFORE UPDATE ON bids FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();