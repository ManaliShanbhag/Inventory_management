-- PostgreSQL Database Schema for Inventory Management System
-- Database name: inventory_db

-- Drop existing tables if they exist to start fresh
DROP TABLE IF EXISTS allocations CASCADE;
DROP TABLE IF EXISTS return_requests CASCADE;
DROP TABLE IF EXISTS request_items CASCADE;
DROP TABLE IF EXISTS requests CASCADE;
DROP TABLE IF EXISTS tools CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS dc_sequence CASCADE;

-- 1. Users Table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100),
    role VARCHAR(20), -- 'manager' or 'employee'
    email VARCHAR(100) UNIQUE,
    password TEXT
);

-- 2. Tools Table
CREATE TABLE tools (
    id SERIAL PRIMARY KEY,
    tool_id VARCHAR(50) UNIQUE,
    tool_name TEXT NOT NULL,
    category VARCHAR(100) DEFAULT 'General',
    description TEXT,
    total_quantity INTEGER DEFAULT 0,
    available_quantity INTEGER DEFAULT 0,
    unit_price NUMERIC(10,2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Requests Table
CREATE TABLE requests (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    tool_id INTEGER, -- (Note: legacy column, items are stored in request_items now)
    quantity INTEGER,
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'approved', 'declined'
    request_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approval_date TIMESTAMP,
    dc_number TEXT,
    approved_quantity INTEGER DEFAULT 0,
    is_printed BOOLEAN DEFAULT false,
    client_name TEXT,
    client_address TEXT,
    attention_person TEXT,
    phone TEXT,
    po_number TEXT,
    po_date DATE,
    state TEXT,
    returnable BOOLEAN DEFAULT true,
    is_hidden BOOLEAN DEFAULT false,
    price NUMERIC(10,2) DEFAULT 0.00,
    unit_price NUMERIC(10,2) DEFAULT 0.00
);

-- 4. Request Items Table (For multi-item requests per Delivery Challan)
CREATE TABLE request_items (
    id SERIAL PRIMARY KEY,
    request_id INTEGER REFERENCES requests(id) ON DELETE CASCADE,
    tool_id INTEGER REFERENCES tools(id),
    quantity INTEGER DEFAULT 0,
    approved_quantity INTEGER DEFAULT 0,
    price NUMERIC(10,2) DEFAULT 0.00
);

-- 5. Return Requests Table
CREATE TABLE return_requests (
    id SERIAL PRIMARY KEY,
    dc_number TEXT,
    user_id INTEGER REFERENCES users(id),
    items JSONB,
    status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 6. Allocations Table (Tracks current items with employees)
CREATE TABLE allocations (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    tool_id INTEGER REFERENCES tools(id),
    quantity INTEGER DEFAULT 0,
    allocated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 7. DC Sequence Table (Generates sequential Delivery Challan numbers)
CREATE TABLE dc_sequence (
    id SERIAL PRIMARY KEY,
    last_number INTEGER DEFAULT 0
);

-- Initialize DC Sequence with a starting record
INSERT INTO dc_sequence (last_number) VALUES (0);
