-- Supabase Database Schema for Subbu Decorators Inventory Management System
-- Run these queries in your Supabase SQL Editor

-- ============================================
-- TABLE 1: Items (Inventory Items)
-- ============================================
CREATE TABLE items (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  total_quantity INTEGER NOT NULL DEFAULT 0,
  assigned_quantity INTEGER NOT NULL DEFAULT 0,
  category TEXT NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  color TEXT,
  size TEXT,
  condition TEXT NOT NULL DEFAULT 'Excellent',
  location TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- ============================================
-- TABLE 2: Functions (Event Bookings)
-- ============================================
CREATE TABLE functions (
  id BIGSERIAL PRIMARY KEY,
  function_name TEXT NOT NULL,
  client_name TEXT NOT NULL,
  client_phone TEXT NOT NULL,
  function_date DATE NOT NULL,
  return_date DATE NOT NULL,
  actual_return_date DATE,
  venue TEXT,
  status TEXT NOT NULL DEFAULT 'Ongoing',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- ============================================
-- TABLE 3: Function Items (Junction Table)
-- ============================================
CREATE TABLE function_items (
  id BIGSERIAL PRIMARY KEY,
  function_id BIGINT NOT NULL REFERENCES functions(id) ON DELETE CASCADE,
  item_id BIGINT NOT NULL REFERENCES items(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  UNIQUE(function_id, item_id)
);

-- ============================================
-- INDEXES for Performance
-- ============================================
CREATE INDEX idx_items_category ON items(category);
CREATE INDEX idx_items_name ON items(name);
CREATE INDEX idx_functions_status ON functions(status);
CREATE INDEX idx_functions_date ON functions(function_date);
CREATE INDEX idx_function_items_function ON function_items(function_id);
CREATE INDEX idx_function_items_item ON function_items(item_id);

-- ============================================
-- ROW LEVEL SECURITY (RLS) - Optional
-- Enable if you want user-level access control
-- ============================================
-- ALTER TABLE items ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE functions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE function_items ENABLE ROW LEVEL SECURITY;

-- For now, we'll allow all operations (you can customize this later)
-- CREATE POLICY "Allow all operations on items" ON items FOR ALL USING (true);
-- CREATE POLICY "Allow all operations on functions" ON functions FOR ALL USING (true);
-- CREATE POLICY "Allow all operations on function_items" ON function_items FOR ALL USING (true);

-- ============================================
-- TRIGGERS for updated_at timestamp
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc', NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_items_updated_at
  BEFORE UPDATE ON items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_functions_updated_at
  BEFORE UPDATE ON functions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- SAMPLE DATA (Optional - for testing)
-- ============================================
INSERT INTO items (name, total_quantity, assigned_quantity, category, price, color, size, condition, location) VALUES
  ('Floral Wall Backdrop', 3, 0, 'Backdrops', 12500.00, 'Pink & White', '8x8 ft', 'Excellent', 'Warehouse A'),
  ('Gold Sequin Backdrop', 2, 0, 'Backdrops', 16500.00, 'Gold', '10x10 ft', 'Good', 'Warehouse A'),
  ('Balloon Arch Kit', 5, 0, 'Props', 6200.00, 'Mixed', 'Standard', 'Excellent', 'Storage B'),
  ('LED Ring Light', 4, 0, 'Lighting', 9900.00, 'White', '18 inch', 'Excellent', 'Equipment Room');

-- ============================================
-- HELPFUL QUERIES
-- ============================================

-- View all items with availability
-- SELECT
--   id,
--   name,
--   total_quantity,
--   assigned_quantity,
--   (total_quantity - assigned_quantity) as available,
--   category,
--   price
-- FROM items
-- ORDER BY name;

-- View ongoing functions with items
-- SELECT
--   f.id,
--   f.function_name,
--   f.client_name,
--   f.function_date,
--   f.status,
--   i.name as item_name,
--   fi.quantity
-- FROM functions f
-- JOIN function_items fi ON f.id = fi.function_id
-- JOIN items i ON fi.item_id = i.id
-- WHERE f.status = 'Ongoing'
-- ORDER BY f.function_date DESC;

-- Get total inventory value
-- SELECT SUM(total_quantity * price) as total_value FROM items;
