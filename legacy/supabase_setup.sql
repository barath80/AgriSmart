-- Create Authentication Info table
CREATE TABLE IF NOT EXISTS "Authentication Info" (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  phone_number VARCHAR(255),
  password VARCHAR(255),
  email VARCHAR(255)
);

-- Create Farmer's Info table
CREATE TABLE IF NOT EXISTS "Farmer's Info" (
  id BIGINT PRIMARY KEY REFERENCES "Authentication Info"(id),
  name VARCHAR(255) NOT NULL,
  state VARCHAR(255) NOT NULL,
  city VARCHAR(255) NOT NULL
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_auth_phone ON "Authentication Info"(phone_number);
CREATE INDEX IF NOT EXISTS idx_auth_email ON "Authentication Info"(email);

-- Enable Row Level Security (optional, but recommended)
ALTER TABLE "Authentication Info" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Farmer's Info" ENABLE ROW LEVEL SECURITY;

-- Create policies to allow all operations (adjust based on your security needs)
-- For development, you can allow all operations:
CREATE POLICY "Allow all operations on Authentication Info" 
  ON "Authentication Info" 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

CREATE POLICY "Allow all operations on Farmer's Info" 
  ON "Farmer's Info" 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

